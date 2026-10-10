"""Spatial correlation study of the Air Atlas snapshot (CAMS global + Europe, ECMWF weather)."""
import json, sys, numpy as np
from pathlib import Path
from PIL import Image
from scipy.cluster.hierarchy import linkage, leaves_list
from scipy.spatial.distance import squareform

ROOT = Path(sys.argv[1]); OUT = Path(sys.argv[2])
DATA = ROOT / 'public/data'
rng = np.random.default_rng(7)

def load(name):
    m = json.load(open(DATA / f'{name}.json'))
    g = m['grid']; n = g['width'] * g['height']
    raw = np.fromfile(DATA / m['dataFile'], dtype='<f4')
    f = {k: raw[i*n:(i+1)*n].reshape(g['height'], g['width']).astype(np.float64) for i, k in enumerate(m['fieldOrder'])}
    return m, f

gm, G = load('global-air-native'); em, E = load('europe-air-native'); wm, W = load('weather-native')
H, Wd = 451, 900
lat = -90 + 0.4*np.arange(H); lon = -180 + 0.4*np.arange(Wd)
LAT, LON = np.meshgrid(lat, lon, indexing='ij')
area = np.cos(np.radians(LAT)).clip(0)

# weather -> 0.4° grid (nearest; 0.4 is not a multiple of 0.25)
wi = np.rint((lat+90)/0.25).astype(int); wj = np.rint((lon+180)/0.25).astype(int) % 1440
Wg = {k: v[np.ix_(wi, wj)] for k, v in W.items()}
Wg['wind_speed_10m'] = np.hypot(Wg.pop('wind_u_component_10m'), Wg.pop('wind_v_component_10m'))

# land mask from the globe's ocean specular map (bright = water)
spec = np.asarray(Image.open(ROOT/'public/earth-specular.jpg').convert('L'), dtype=np.float64)
sh, sw = spec.shape
si = np.clip(((90-lat)/180*sh).astype(int), 0, sh-1); sj = np.clip(((lon+180)/360*sw).astype(int), 0, sw-1)
land = spec[np.ix_(si, sj)] < 128

# local solar hour at snapshot (03:00 UTC) — the snapshot is a single instant
solar_hour = (3 + LON/15) % 24
day = (solar_hour > 6) & (solar_hour < 18)

LABEL = {'pm2_5':'PM2.5','pm10':'PM10','nitrogen_dioxide':'NO₂','nitrogen_monoxide':'NO','ozone':'O₃','dust':'Dust','carbon_monoxide':'CO','sulphur_dioxide':'SO₂','aerosol_optical_depth':'AOD','uv_index':'UV index','uv_index_clear_sky':'UV clear-sky','formaldehyde':'HCHO','glyoxal':'Glyoxal','peroxyacyl_nitrates':'PAN','sea_salt_aerosol':'Sea salt','temperature_2m':'Temperature','relative_humidity_2m':'Rel. humidity','wind_speed_10m':'Wind speed','ammonia':'NH₃','non_methane_volatile_organic_compounds':'NMVOC','pm10_wildfires':'PM10 wildfire','secondary_inorganic_aerosol':'Sec. inorganic aerosol','residential_elementary_carbon':'Residential EC','total_elementary_carbon':'Total EC','pm2_5_total_organic_matter':'PM2.5 organic','alder_pollen':'Alder pollen','birch_pollen':'Birch pollen','grass_pollen':'Grass pollen','mugwort_pollen':'Mugwort pollen','olive_pollen':'Olive pollen','ragweed_pollen':'Ragweed pollen'}
LOGGED = lambda k: k not in ('temperature_2m','relative_humidity_2m','wind_speed_10m','uv_index','uv_index_clear_sky')

def tf(k, x):
    if not LOGGED(k): return x
    pos = x[x > 0]
    eps = np.percentile(pos, 1) if pos.size else 1e-9
    return np.log10(x + eps)

def wcorr(X, w):
    w = w/w.sum(); mu = (X*w[:,None]).sum(0); Xc = X-mu
    C = (Xc*w[:,None]).T @ Xc; s = np.sqrt(np.diag(C)); s[s == 0] = np.inf
    return C/np.outer(s, s)

def wrank(x, w):
    o = np.argsort(x, kind='stable'); cw = np.cumsum(w[o]); r = np.empty_like(x)
    r[o] = cw - w[o]/2
    # ties: average
    xs = x[o]; b = np.r_[True, xs[1:] != xs[:-1]]; gid = np.cumsum(b)-1
    sums = np.bincount(gid, r[o]); cnt = np.bincount(gid)
    r[o] = (sums/cnt)[gid]
    return r/w.sum()

def matrix(keys, F, mask, w, rank=False):
    X = np.column_stack([F[k][mask] for k in keys]); ww = w[mask]
    X = np.column_stack([wrank(X[:,i], ww) for i in range(X.shape[1])]) if rank else np.column_stack([tf(k, X[:,i]) for i, k in enumerate(keys)])
    return wcorr(X, ww)

def order(R):
    D = 1-np.abs(R); np.fill_diagonal(D, 0); D = (D+D.T)/2
    return leaves_list(linkage(squareform(D, checks=False), 'average', optimal_ordering=True)).tolist()

def partial(R):
    P = np.linalg.pinv(R); d = np.sqrt(np.diag(P)); Q = -P/np.outer(d, d); np.fill_diagonal(Q, 1); return Q

def r2(a): return np.round(a, 3).tolist()

# ---------------- global ----------------
gkeys = [k for k in gm['fieldOrder']] + ['temperature_2m','relative_humidity_2m','wind_speed_10m']
GF = {**G, **Wg}
everywhere = np.ones_like(land)
mats = {}
for name, mask in [('all', everywhere), ('land', land), ('ocean', ~land)]:
    mats[name] = {'pearsonLog': matrix(gkeys, GF, mask, area), 'spearman': matrix(gkeys, GF, mask, area, rank=True)}
glob_order = order(mats['all']['spearman'])
part = partial(mats['all']['pearsonLog'])

# block bootstrap (15°×15° blocks) for 95% CI on Spearman ρ, all cells
bi = ((LAT+90)//15).astype(int); bj = ((LON+180)//15).astype(int); block = (bi*24+bj).ravel()
ub = np.unique(block); Xall = np.column_stack([tf(k, GF[k].ravel()) for k in gkeys]); wall = area.ravel()
idx_by_block = [np.flatnonzero(block == b) for b in ub]
boots = []
for _ in range(300):
    pick = rng.choice(len(ub), len(ub))
    ii = np.concatenate([idx_by_block[p] for p in pick])
    Xi, wi_ = Xall[ii], wall[ii]
    # rank inside each resample so the interval is for Spearman ρ, the headline statistic
    boots.append(wcorr(np.column_stack([wrank(Xi[:, k], wi_) for k in range(Xi.shape[1])]), wi_))
boots = np.array(boots); lo, hi = np.percentile(boots, [2.5, 97.5], axis=0)

# ---------------- regional heterogeneity ----------------
REG = {'North America':(15,70,-170,-50),'South America':(-56,15,-82,-34),'Europe':(35,71,-25,45),'Africa':(-35,35,-20,52),'Middle East':(12,42,35,63),'South Asia':(5,36,63,92),'East Asia':(18,54,92,146),'Southeast Asia':(-11,18,92,141),'Oceania':(-47,-10,112,180)}
PAIRS = [('pm2_5','carbon_monoxide'),('pm2_5','nitrogen_dioxide'),('pm2_5','dust'),('pm2_5','aerosol_optical_depth'),('nitrogen_dioxide','ozone'),('nitrogen_dioxide','sulphur_dioxide'),('formaldehyde','glyoxal'),('carbon_monoxide','formaldehyde'),('ozone','temperature_2m'),('pm2_5','relative_humidity_2m'),('pm2_5','wind_speed_10m'),('sea_salt_aerosol','wind_speed_10m')]
regional = []
for rn, (la0, la1, lo0, lo1) in REG.items():
    m = land & (LAT >= la0) & (LAT <= la1) & (LON >= lo0) & (LON <= lo1)
    row = {'region': rn, 'cells': int(m.sum())}
    for a, b in PAIRS:
        row[f'{a}|{b}'] = round(float(matrix([a, b], GF, m, area, rank=True)[0,1]), 3)
    regional.append(row)
pairs_global = {f'{a}|{b}': {k: round(float(matrix([a,b], GF, msk, area, rank=True)[0,1]),3) for k, msk in [('all',everywhere),('land',land),('ocean',~land)]} for a, b in PAIRS}

# day vs night (snapshot is one instant: day side = Asia/Pacific)
daynight = {f'{a}|{b}': {k: round(float(matrix([a,b], GF, msk, area, rank=True)[0,1]),3) for k, msk in [('day',land&day),('night',land&~day)]} for a, b in [('nitrogen_dioxide','ozone'),('ozone','temperature_2m'),('formaldehyde','glyoxal'),('nitrogen_monoxide','nitrogen_dioxide')]}

# ---------------- density plots (area-weighted 2D hist, log axes) ----------------
STEP = {}
def step(k):
    if k not in STEP:
        u = np.unique(GF[k].ravel()[::7]); d = np.diff(u); d = d[d > 1e-6]
        STEP[k] = float(np.round(d.min(), 4)) if d.size and k not in ('temperature_2m','relative_humidity_2m','wind_speed_10m') else 0.0
    return STEP[k]
def dq(k, x):
    s = step(k)
    return np.clip(x + rng.uniform(-s/2, s/2, x.shape), s/4 if s else 0, None) if s else x
def hist2(a, b, mask=everywhere, n=56):
    x = tf(a, dq(a, GF[a][mask])); y = tf(b, dq(b, GF[b][mask])); w = area[mask]
    xr = np.percentile(x, [0.5, 99.5]); yr = np.percentile(y, [0.5, 99.5])
    Hh, xe, ye = np.histogram2d(x, y, bins=n, range=[xr, yr], weights=w)
    # land/ocean split share per bin for colour hint
    Hl, _, _ = np.histogram2d(x, y, bins=[xe, ye], weights=w*land[mask])
    return {'x': a, 'y': b, 'xlog': LOGGED(a), 'ylog': LOGGED(b), 'xr': r2(xr), 'yr': r2(yr), 'h': np.round(Hh/Hh.max(), 4).tolist(), 'land': np.round(np.divide(Hl, Hh, out=np.zeros_like(Hh), where=Hh>0), 2).tolist(), 'rs': round(float(matrix([a,b],GF,mask,area,rank=True)[0,1]),3)}
SCAT = [('pm2_5','pm10'),('pm2_5','carbon_monoxide'),('pm2_5','aerosol_optical_depth'),('nitrogen_dioxide','ozone'),('formaldehyde','glyoxal'),('sea_salt_aerosol','wind_speed_10m'),('dust','pm10'),('ozone','temperature_2m')]
scatters = [hist2(a, b) for a, b in SCAT]

# PM2.5/PM10 ratio
ratio = np.divide(G['pm2_5'], G['pm10'], out=np.full_like(G['pm10'], np.nan), where=G['pm10']>0.5)
def wq(x, w, qs):
    ok = np.isfinite(x); x, w = x[ok], w[ok]; o = np.argsort(x); c = np.cumsum(w[o])/w[ok.sum() and o].sum() if False else np.cumsum(w[o])/w[o].sum()
    return [float(np.round(x[o][np.searchsorted(c, q)], 3)) for q in qs]
ratio_stats = {k: wq(ratio[m], area[m], [.1,.25,.5,.75,.9]) for k, m in [('land',land),('ocean',~land),('dusty land (dust>50)',land&(G['dust']>50))]}

# ---------------- Europe (25 fields, 0.1°) ----------------
elat = 30.05+0.1*np.arange(420); elon = -24.95+0.1*np.arange(700)
ELAT, ELON = np.meshgrid(elat, elon, indexing='ij'); earea = np.cos(np.radians(ELAT))
esi = np.clip(((90-elat)/180*sh).astype(int),0,sh-1); esj = np.clip(((elon+180)/360*sw).astype(int),0,sw-1)
eland = spec[np.ix_(esi, esj)] < 128
ekeys = [k for k in em['fieldOrder'] if not k.endswith('_pollen') or E[k][eland].max() > 0.5]
pollen_dropped = [k for k in em['fieldOrder'] if k not in ekeys]
eR = matrix(ekeys, E, eland, earea, rank=True); e_order = order(eR)

# global vs European model agreement on shared fields (Europe land cells)
gi = np.clip(np.rint((elat+90)/0.4).astype(int),0,H-1); gj = np.rint((elon+180)/0.4).astype(int) % Wd
shared = [k for k in em['fieldOrder'] if k in G]
agree = []
for k in shared:
    a = G[k][np.ix_(gi, gj)][eland]; b = E[k][eland]; w = earea[eland]
    rs = wcorr(np.column_stack([wrank(a,w), wrank(b,w)]), w)[0,1]
    ratio_med = np.median(b[a>0]/a[a>0]) if (a>0).any() else float('nan')
    agree.append({'id': k, 'spearman': round(float(rs),3), 'medianRatio': round(float(ratio_med),3), 'meanGlobal': round(float(np.average(a,weights=w)),3), 'meanEurope': round(float(np.average(b,weights=w)),3)})

# ---------------- variability (CV) ----------------
def cv(x, w): mu = np.average(x, weights=w); return float(np.sqrt(np.average((x-mu)**2, weights=w))/mu) if mu else None
variability = [{'id': k, 'cv': round(cv(GF[k].ravel(), area.ravel()), 3), 'mean': round(float(np.average(GF[k], weights=area)), 3), 'p99': wq(GF[k].ravel(), area.ravel(), [.99])[0]} for k in gkeys if LOGGED(k)]

top = []
R = mats['all']['spearman']; Rl = mats['all']['pearsonLog']
for i in range(len(gkeys)):
    for j in range(i+1, len(gkeys)):
        top.append({'a': gkeys[i], 'b': gkeys[j], 'spearman': round(float(R[i,j]),3), 'pearsonLog': round(float(Rl[i,j]),3), 'ci': [round(float(lo[i,j]),3), round(float(hi[i,j]),3)], 'partial': round(float(part[i,j]),3), 'land': round(float(mats['land']['spearman'][i,j]),3), 'ocean': round(float(mats['ocean']['spearman'][i,j]),3)})
top.sort(key=lambda d: -abs(d['spearman']))

# ---------------- local correlation maps (5° tiles) ----------------
T = 5; th, tw = 180//T, 360//T
def tiles(a, b, mask=None, minn=40):
    res = np.full((th, tw), np.nan)
    ti = np.minimum(((LAT+90)//T).astype(int), th-1); tj = np.minimum(((LON+180)//T).astype(int), tw-1)
    xa, xb = GF[a], GF[b]
    for i in range(th):
        rows = (ti[:,0] == i)
        for j in range(tw):
            cols = (tj[0] == j)
            sa = xa[np.ix_(rows, cols)].ravel(); sb = xb[np.ix_(rows, cols)].ravel()
            if mask is not None:
                mm = mask[np.ix_(rows, cols)].ravel(); sa, sb = sa[mm], sb[mm]
            if sa.size < minn or np.ptp(sa) == 0 or np.ptp(sb) == 0: continue
            ra = np.argsort(np.argsort(sa)); rb = np.argsort(np.argsort(sb))
            res[i, j] = np.corrcoef(ra, rb)[0, 1]
    return [[None if np.isnan(v) else round(float(v), 2) for v in row] for row in res]
TI = np.minimum(((LAT+90)//T).astype(int), th-1); TJ = np.minimum(((LON+180)//T).astype(int), tw-1); TID = (TI*tw+TJ).ravel()
def tilemean(x):
    return np.bincount(TID, x.ravel(), th*tw)/np.bincount(TID, None, th*tw)
def tilemedian(x):
    flat = x.ravel(); out = np.full(th*tw, np.nan)
    o = np.argsort(TID, kind='stable'); bounds = np.searchsorted(TID[o], np.arange(th*tw+1))
    for t_ in range(th*tw):
        v = flat[o[bounds[t_]:bounds[t_+1]]]; v = v[np.isfinite(v)]
        if v.size >= 20: out[t_] = np.median(v)
    return out.reshape(th, tw)
L2 = np.minimum(((LAT+90)//2).astype(int), 89).ravel()*180 + np.minimum(((LON+180)//2).astype(int), 179).ravel()
landfrac2 = np.round(np.bincount(L2, land.ravel().astype(float), 90*180)/np.bincount(L2, None, 90*180), 2).reshape(90, 180).tolist()
rt = np.where(G['pm10'] > 0.5, G['pm2_5']/np.maximum(G['pm10'], 1e-9), np.nan)
rtile = tilemedian(rt)
pm10tile = tilemean(G['pm10']).reshape(th, tw)
maps = {
 'tile': T,
 'land': landfrac2,
 'pmco': tiles('pm2_5', 'carbon_monoxide'),
 'pmsalt': tiles('pm2_5', 'sea_salt_aerosol'),
 'no2o3': tiles('nitrogen_dioxide', 'ozone'),
 'hchot': tiles('formaldehyde', 'temperature_2m'),
 'ratio': [[None if not np.isfinite(v) else round(float(v), 2) for v in row] for row in rtile],
 'pm10': np.round(pm10tile, 1).tolist(),
}
steps = {k: step(k) for k in gkeys}

out = {
 'meta': {'validAt': gm['validAt'], 'globalSource': gm['source'], 'europeSource': em['source'], 'weatherSource': wm['source'], 'globalCells': H*Wd, 'landShare': round(float(np.average(land, weights=area)),3), 'europeCells': int(eland.sum()), 'blocks': int(len(ub)), 'boot': 300, 'pollenDropped': pollen_dropped},
 'labels': LABEL, 'units': {**gm['units'], **em['units'], **wm['units'], 'wind_speed_10m': 'm/s'},
 'global': {'keys': gkeys, 'order': glob_order, 'spearman': r2(mats['all']['spearman']), 'pearsonLog': r2(mats['all']['pearsonLog']), 'land': r2(mats['land']['spearman']), 'ocean': r2(mats['ocean']['spearman']), 'partial': r2(part)},
 'pairs': top, 'pairsGlobal': pairs_global, 'regional': regional, 'regionalPairs': [f'{a}|{b}' for a,b in PAIRS], 'dayNight': daynight,
 'scatters': scatters, 'ratio': ratio_stats, 'variability': variability,
 'maps': maps, 'steps': steps, 'europe': {'keys': ekeys, 'order': e_order, 'spearman': r2(eR)}, 'agreement': agree,
}
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',',':')))
print('ok', OUT.stat().st_size)
for t in top[:25]: print(f"{LABEL[t['a']]:>14} ~ {LABEL[t['b']]:<14} rs={t['spearman']:+.2f} rlog={t['pearsonLog']:+.2f} CI={t['ci']} partial={t['partial']:+.2f} land={t['land']:+.2f} ocean={t['ocean']:+.2f}")
print(json.dumps(pairs_global, indent=0)[:1500]); print(regional); print(daynight); print(ratio_stats); print(agree); print(variability); print(pollen_dropped)
