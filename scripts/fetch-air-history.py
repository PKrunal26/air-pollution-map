"""Monthly means from the Open-Meteo CAMS global time-series archive (pip install omfiles numpy).
Usage:
  python scripts/fetch-air-history.py field pm2_5 /absolute/cache    # one field -> cache/monthly-<field>.npz
  python scripts/fetch-air-history.py build pm2_5,dust,nitrogen_dioxide /absolute/cache   # -> public/data/air-history*
  python scripts/fetch-air-history.py month pm2_5,dust,nitrogen_dioxide /absolute/cache   # adds missing months to it
The archive stores hourly 900x451 grids in files of 217 hours (data/cams_global/<field>/chunk_N.om, hour = N*217 + i).
Each chunk is downloaded, added to per-cell monthly sums and counts (NaN hours skipped), then deleted.
Only complete calendar months from August 2022 to the last month before the archive's end are kept. The month mode
downloads only the months the published history lacks (none most days), for the scheduled refresh.
"""
import datetime as dt, gzip, hashlib, json, pathlib, sys, urllib.request
import numpy as np
from omfiles import OmFileReader

BASE = 'https://openmeteo.s3.amazonaws.com/data/cams_global/'
CHUNK = 217
mode, fields, cache = sys.argv[1], sys.argv[2].split(','), pathlib.Path(sys.argv[3])
cache.mkdir(parents=True, exist_ok=True)
meta = json.loads(urllib.request.urlopen(BASE + 'static/meta.json', timeout=30).read())
assert meta['chunk_time_length'] == CHUNK and meta['temporal_resolution_seconds'] == 3600
end_hour = meta['data_end_time'] // 3600
end = dt.datetime.fromtimestamp(end_hour * 3600, dt.timezone.utc)
first = dt.datetime(2022, 8, 1, tzinfo=dt.timezone.utc)
months = []
m = first
while True:
    nxt = (m.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    if nxt > end: break
    months.append((m, nxt))
    m = nxt
hour = lambda t: int(t.timestamp()) // 3600
catalog = {f['id']: f for f in json.loads(pathlib.Path('src/camsFields.json').read_text())}
out = pathlib.Path('public/data')

def accumulate(field, ks):
    """Per-cell sums and counts of valid hours for the months ks (indexes into months), one chunk at a time."""
    sums = np.zeros((len(ks), 451, 900)); counts = np.zeros((len(ks), 451, 900), np.uint16); negative = np.zeros(len(ks), np.int64)
    spans = [(hour(months[k][0]), hour(months[k][1])) for k in ks]
    month_of = lambda h: next((i for i, (a, b) in enumerate(spans) if a <= h < b), None)
    for n in sorted({n for a, b in spans for n in range(a // CHUNK, (b - 1) // CHUNK + 1)}):
        path = cache / f'{field}-{n}.om'
        if not path.exists():
            path.write_bytes(urllib.request.urlopen(f'{BASE}{field}/chunk_{n}.om', timeout=300).read())
        with OmFileReader(str(path)) as r:
            assert r.shape == (451, 900, CHUNK)
            data = r.read_array((slice(None), slice(None), slice(None)))
        for i in range(CHUNK):
            k = month_of(n * CHUNK + i)
            if k is None: continue
            # The archive has rare negative values (provider artefacts); like NaN they are skipped, not clamped.
            x = data[:, :, i]; ok = np.isfinite(x) & (x >= 0)
            negative[k] += int((x < 0).sum())
            sums[k][ok] += x[ok]; counts[k] += ok
        path.unlink()
        print(field, n, flush=True)
    return sums, counts, negative

def write_frame(k, per_field):
    """One float16 frame for month k, layer-major in the given field order; per_field[f] = (sums, counts, negative)."""
    a, b = months[k]
    hours = hour(b) - hour(a); layers, coverage, skipped = [], {}, {}
    for f in fields:
        s, c, neg = per_field[f]; c = c.astype(float)
        assert c.max() <= hours
        mean = np.where(c > 0, s / np.maximum(c, 1), np.nan)
        # Cells with under 90% of the month's hours stay missing rather than becoming a biased mean.
        mean[c < .9 * hours] = np.nan
        assert np.nanmax(mean) < 65504
        coverage[f] = round(float(c.sum() / (hours * c.size)), 5)
        skipped[f] = int(neg)
        layers.append(mean.astype('<f4'))
    blob = np.stack(layers).astype('<f2').tobytes(order='C')
    name = f'air-month-{k:02d}.bin'
    compressed = gzip.compress(blob, compresslevel=9, mtime=0)
    (out / (name + '.gz')).write_bytes(compressed)
    print(a.strftime('%Y-%m'), len(compressed), coverage)
    return {'validAt': int(a.timestamp() * 1000), 'endAt': int(b.timestamp() * 1000), 'hours': hours,
            'coverage': coverage, 'negativeSkipped': skipped, 'dataFile': name, 'compressedFile': name + '.gz', 'byteLength': len(blob),
            'compressedByteLength': len(compressed), 'sha256': hashlib.sha256(blob).hexdigest()}

def write_manifest(frames):
    manifest = {
        'schema': 1, 'kind': 'modeled', 'domain': 'cams_global', 'statistic': 'monthly mean',
        'provider': 'CAMS / ECMWF via Open-Meteo AWS Open Data', 'source': BASE, 'documentation': 'https://github.com/open-meteo/open-data',
        'licence': 'CC BY 4.0', 'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'step': 'month',
        'grid': {'width': 900, 'height': 451, 'step': 0.4, 'latStart': -90, 'lonStart': -180, 'order': 'south-to-north, west-to-east'},
        'encoding': 'float16-le, layer-major', 'fieldOrder': fields, 'units': {f: catalog[f]['unit'] for f in fields}, 'frames': frames,
    }
    (out / 'air-history.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
    print(len(frames), 'months')

if mode == 'field':
    (field,) = fields
    sums, counts, negative = accumulate(field, range(len(months)))
    np.savez(cache / f'monthly-{field}.npz', sums=sums, counts=counts, negative=negative)
elif mode == 'build':
    loaded = {f: np.load(cache / f'monthly-{f}.npz') for f in fields}
    write_manifest([write_frame(k, {f: (loaded[f]['sums'][k], loaded[f]['counts'][k], loaded[f]['negative'][k]) for f in fields}) for k in range(len(months))])
elif mode == 'month':
    published = json.loads((out / 'air-history.json').read_text())
    if published['fieldOrder'] != fields:
        # The workflow's list grew (e.g. pm10, carbon_monoxide) before the history was rebuilt with it: keep adding
        # months for the published fields so the daily refresh still deploys, until `rebuild_history` is run.
        assert fields[:len(published['fieldOrder'])] == published['fieldOrder'], (published['fieldOrder'], fields)
        print('warning: published history has', ','.join(published['fieldOrder']), '- run the workflow with',
              'rebuild_history to add', ','.join(fields[len(published['fieldOrder']):]), flush=True)
        fields = published['fieldOrder']
    frames = list(published['frames'])
    assert [f['validAt'] for f in frames] == [int(a.timestamp() * 1000) for a, _ in months[:len(frames)]]
    for k in range(len(frames), len(months)):
        frames.append(write_frame(k, {f: tuple(x[0] for x in accumulate(f, [k])) for f in fields}))
    if len(frames) > len(published['frames']):
        write_manifest(frames)
    else:
        print('history is up to date:', len(frames), 'months')
