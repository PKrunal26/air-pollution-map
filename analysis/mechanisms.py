"""Targeted tests of the likely causes behind the strongest correlations. Writes analysis/mechanisms.json."""
import json, sys, numpy as np
from pathlib import Path
from PIL import Image

ROOT = Path(sys.argv[1]); OUT = Path(sys.argv[2]); DATA = ROOT / 'public/data'

def load(name):
    m = json.load(open(DATA / f'{name}.json')); g = m['grid']; n = g['width']*g['height']
    raw = np.fromfile(DATA / m['dataFile'], dtype='<f4')
    return m, {k: raw[i*n:(i+1)*n].reshape(g['height'], g['width']).astype(np.float64) for i, k in enumerate(m['fieldOrder'])}
gm, G = load('global-air-native'); em, E = load('europe-air-native'); wm, W = load('weather-native')
lat = -90+.4*np.arange(451); lon = -180+.4*np.arange(900); LAT, LON = np.meshgrid(lat, lon, indexing='ij'); area = np.cos(np.radians(LAT)).clip(0)
wi = np.rint((lat+90)/.25).astype(int); wj = np.rint((lon+180)/.25).astype(int) % 1440
T = W['temperature_2m'][np.ix_(wi, wj)]; RH = W['relative_humidity_2m'][np.ix_(wi, wj)]
WS = np.hypot(W['wind_u_component_10m'], W['wind_v_component_10m'])[np.ix_(wi, wj)]
spec = np.asarray(Image.open(ROOT/'public/earth-specular.jpg').convert('L'), dtype=float); sh, sw = spec.shape
land = spec[np.ix_(np.clip(((90-lat)/180*sh).astype(int),0,sh-1), np.clip(((lon+180)/360*sw).astype(int),0,sw-1))] < 128
solar = (3+LON/15) % 24; day = (solar > 6) & (solar < 18)

def rank(x, w):
    o = np.argsort(x, kind='stable'); r = np.empty_like(x); r[o] = np.cumsum(w[o]) - w[o]/2; return r
def rho(a, b, m, w=None):
    a, b = a[m], b[m]; w = (area if w is None else w)[m]
    ra, rb = rank(a, w), rank(b, w); w = w/w.sum()
    ma, mb = (ra*w).sum(), (rb*w).sum()
    return float(((ra-ma)*(rb-mb)*w).sum()/np.sqrt(((ra-ma)**2*w).sum()*((rb-mb)**2*w).sum()))
def box(la0, la1, lo0, lo1): return (LAT >= la0) & (LAT <= la1) & (LON >= lo0) & (LON <= lo1)
R = lambda v: round(v, 3)
out = {}

# 1. Sea spray: emission in CAMS scales with wind (whitecaps). Shape of the ocean relationship.
ocean = ~land & (np.abs(LAT) < 70)
bins = np.arange(0, 20.5, 1.0); mids, med = [], []
for a, b in zip(bins[:-1], bins[1:]):
    m = ocean & (WS >= a) & (WS < b)
    if m.sum() > 500: mids.append((a+b)/2); med.append(float(np.median(G['sea_salt_aerosol'][m])))
mids, med = np.array(mids), np.array(med); ok = (mids >= 3) & (mids <= 15)
slope = np.polyfit(np.log10(mids[ok]), np.log10(med[ok]), 1)[0]
out['seaSalt'] = {'curve': [[float(x), round(y, 1)] for x, y in zip(mids, med)], 'loglogSlope': R(float(slope)),
                 'pmFromSaltOcean': R(rho(G['pm2_5'], G['sea_salt_aerosol'], ocean)),
                 'saltShareOfPm10Ocean': R(float(np.median((G['sea_salt_aerosol']/np.maximum(G['pm10'], .1))[ocean & (G['pm10'] > 1)])))}

# 2. Combustion: PM2.5–CO by fire season region (Oct = southern-hemisphere burning season).
regs = {'Southern Africa (fire season)': (-35, 0, 10, 42), 'Amazon & Cerrado (fire season)': (-25, 5, -75, -35), 'Sahara & Sahel (dust)': (12, 35, -17, 35), 'India & Bangladesh': (8, 30, 68, 92), 'Eastern China': (22, 42, 105, 122), 'Europe': (36, 60, -10, 30)}
out['combustion'] = [{'region': k, 'pmCo': R(rho(G['pm2_5'], G['carbon_monoxide'], land & box(*v))), 'pmDust': R(rho(G['pm2_5'], G['dust'], land & box(*v))), 'coHcho': R(rho(G['carbon_monoxide'], G['formaldehyde'], land & box(*v)))} for k, v in regs.items()]
eland = None
elat = 30.05+.1*np.arange(420); elon = -24.95+.1*np.arange(700); ELAT, ELON = np.meshgrid(elat, elon, indexing='ij')
eland = spec[np.ix_(np.clip(((90-elat)/180*sh).astype(int),0,sh-1), np.clip(((elon+180)/360*sw).astype(int),0,sw-1))] < 128
earea = np.cos(np.radians(ELAT))
erho = lambda a, b, m=eland: rho(E[a], E[b], m, earea)
out['europeSources'] = {
 'pmResidentialEC': R(erho('pm2_5', 'residential_elementary_carbon')), 'coResidentialEC': R(erho('carbon_monoxide', 'residential_elementary_carbon')),
 'pmOrganic': R(erho('pm2_5', 'pm2_5_total_organic_matter')), 'pmSIA': R(erho('pm2_5', 'secondary_inorganic_aerosol')),
 'nh3SIA': R(erho('ammonia', 'secondary_inorganic_aerosol')), 'no2SIA': R(erho('nitrogen_dioxide', 'secondary_inorganic_aerosol')), 'so2SIA': R(erho('sulphur_dioxide', 'secondary_inorganic_aerosol')),
 'siaShareOfPm25': R(float(np.median((E['secondary_inorganic_aerosol']/np.maximum(E['pm2_5'], .1))[eland & (E['pm2_5'] > 2)]))),
 'organicShareOfPm25': R(float(np.median((E['pm2_5_total_organic_matter']/np.maximum(E['pm2_5'], .1))[eland & (E['pm2_5'] > 2)]))),
}

# 3. Night-time titration NO + O3 -> NO2. If it holds, Ox = O3 + NO2 (in ppb) should not fall with NO2.
o3ppb, no2ppb = E['ozone']/1.96, E['nitrogen_dioxide']/1.88; ox = o3ppb + no2ppb
polluted = eland & (E['nitrogen_dioxide'] > 5)
q = np.percentile(E['nitrogen_dioxide'][eland], [50, 90, 99])
def band_mean(x, lo, hi): m = eland & (E['nitrogen_dioxide'] >= lo) & (E['nitrogen_dioxide'] < hi); return float(np.average(x[m], weights=earea[m]))
edges = [0, 1, 2, 5, 10, 20, 40, 1e9]
out['titration'] = {'no2O3': R(erho('nitrogen_dioxide', 'ozone')), 'no2Ox': R(rho(E['nitrogen_dioxide'], ox, eland, earea)),
 'bands': [{'no2': f'{a:g}–{b:g}' if b < 1e8 else f'≥ {a:g}', 'o3': round(band_mean(o3ppb, a, b), 1), 'no2ppb': round(band_mean(no2ppb, a, b), 1), 'ox': round(band_mean(ox, a, b), 1)} for a, b in zip(edges[:-1], edges[1:])],
 'noNo2Day': R(rho(G['nitrogen_monoxide'], G['nitrogen_dioxide'], land & day)), 'noNo2Night': R(rho(G['nitrogen_monoxide'], G['nitrogen_dioxide'], land & ~day)),
 'noNightMedian': float(np.median(G['nitrogen_monoxide'][land & ~day & (G['nitrogen_dioxide'] > 5)])), 'noDayMedian': float(np.median(G['nitrogen_monoxide'][land & day & (G['nitrogen_dioxide'] > 5)]))}

# 4. Formaldehyde and heat (biogenic isoprene). Control for latitude, fire (CO) and daylight.
bands = []
for a in range(-40, 60, 20):
    m = land & (LAT >= a) & (LAT < a+20) & (G['carbon_monoxide'] < np.percentile(G['carbon_monoxide'][land], 75))
    if m.sum() > 2000: bands.append({'band': f'{a}° to {a+20}°', 'rho': R(rho(G['formaldehyde'], T, m))})
m = land & (G['formaldehyde'] > 0.2) & (T > 0) & (G['carbon_monoxide'] < np.percentile(G['carbon_monoxide'][land], 75))
k = np.polyfit(T[m], np.log2(G['formaldehyde'][m]), 1)[0]
out['hcho'] = {'withinLatitude': bands, 'doublingDegC': R(float(1/k)) if k > 0 else None, 'dayRho': R(rho(G['formaldehyde'], T, land & day)), 'nightRho': R(rho(G['formaldehyde'], T, land & ~day))}

# 5. Ventilation: is NO2 lower where it is windy within the same place, or only because windy places are remote?
TI = ((LAT+90)//5).astype(int); TJ = ((LON+180)//5).astype(int)
def within(a, b, m, minn=60):
    vals = []
    for i in np.unique(TI[m]):
        for j in np.unique(TJ[m & (TI == i)]):
            mm = m & (TI == i) & (TJ == j)
            if mm.sum() >= minn and np.ptp(a[mm]) > 0 and np.ptp(b[mm]) > 0:
                vals.append(np.corrcoef(np.argsort(np.argsort(a[mm])), np.argsort(np.argsort(b[mm])))[0, 1])
    return R(float(np.median(vals))), len(vals)
out['ventilation'] = {k: {'global': R(rho(G[f], WS, land)), 'withinTile': within(G[f], WS, land)[0], 'tiles': within(G[f], WS, land)[1]} for k, f in [('NO₂', 'nitrogen_dioxide'), ('CO', 'carbon_monoxide'), ('PM2.5', 'pm2_5')]}

# 6. UV: the 0.99 is mostly night (both zero).
dl = day & (G['uv_index_clear_sky'] > 0.5)
out['uv'] = {'all': R(rho(G['uv_index'], G['uv_index_clear_sky'], np.ones_like(land))), 'daylit': R(rho(G['uv_index'], G['uv_index_clear_sky'], dl)),
 'cloudLossMedian': R(float(np.median(1 - G['uv_index'][dl]/G['uv_index_clear_sky'][dl]))), 'nightShare': R(float(np.average(G['uv_index_clear_sky'] < .05, weights=area)))}

# 7. Dust vs fine PM given PM10: part–whole arithmetic, not a physical effect.
m = land & (G['pm10'] > 1)
out['dustSplit'] = {'pm25DustRaw': R(rho(G['pm2_5'], G['dust'], land)), 'coarseDust': R(rho(G['pm10']-G['pm2_5'], G['dust'], m)), 'fineShareDusty': R(float(np.median((G['pm2_5']/G['pm10'])[m & (G['dust'] > 50)]))), 'fineShareClean': R(float(np.median((G['pm2_5']/G['pm10'])[m & (G['dust'] < 5)])))}

OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1)); print(json.dumps(out, ensure_ascii=False, indent=1))
