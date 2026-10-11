"""Monthly means of the Europe-only fields from the Open-Meteo CAMS Europe time-series archive (pip install omfiles numpy).
Usage:
  python scripts/fetch-europe-history.py field ammonia /absolute/cache   # one field -> cache/europe-monthly-<field>.npz
  python scripts/fetch-europe-history.py build /absolute/cache           # -> public/data/europe-history*
The archive stores hourly 700x420 grids (north-to-south rows) in files of 193 hours
(data/cams_europe/<field>/chunk_N.om, hour = N*193 + i). Months follow public/data/air-history.json one for one, so
both timelines share frame indexes; months with no Europe data are null, and fields whose archive starts later are
NaN before it. Monthly means are averaged over 4x4 blocks to the 0.4° spacing of the global history (175x105). Run fetch-air-history.py build first. Each chunk is downloaded, added to
per-cell sums, then deleted.
"""
import datetime as dt, gzip, hashlib, json, pathlib, sys, urllib.request
import numpy as np
from omfiles import OmFileReader

BASE = 'https://openmeteo.s3.amazonaws.com/data/cams_europe/'
CHUNK = 193
out = pathlib.Path('public/data')
catalog = json.loads(pathlib.Path('src/camsFields.json').read_text())
fields = [f['id'] for f in catalog if f['coverage'] == 'europe']
units = {f['id']: f['unit'] for f in catalog if f['coverage'] == 'europe'}
history = json.loads((out / 'air-history.json').read_text())
months = [(f['validAt'] // 3600000, f['endAt'] // 3600000) for f in history['frames']]
meta = json.loads(urllib.request.urlopen(BASE + 'static/meta.json', timeout=30).read())
assert meta['chunk_time_length'] == CHUNK and meta['temporal_resolution_seconds'] == 3600
assert 'BBOX[71.95,-24.95,30.049995,44.95]' in meta['crs_wkt']
mode, cache = sys.argv[1], pathlib.Path(sys.argv[-1])
cache.mkdir(parents=True, exist_ok=True)

def chunks(field):
    listing = urllib.request.urlopen(f'https://openmeteo.s3.amazonaws.com/?list-type=2&prefix=data/cams_europe/{field}/&max-keys=1000', timeout=60).read().decode()
    assert '<IsTruncated>false</IsTruncated>' in listing
    return sorted(int(k.split('chunk_')[1].split('.')[0]) for k in listing.split('<Key>')[1:] if 'chunk_' in k.split('<')[0])

if mode == 'field':
    field = sys.argv[2]
    assert field in fields
    start_h, stop_h = months[0][0], months[-1][1]
    sums = np.zeros((len(months), 420, 700)); counts = np.zeros((len(months), 420, 700), np.uint16); negative = np.zeros(len(months), np.int64)
    month_of = lambda h: next((k for k, (a, b) in enumerate(months) if a <= h < b), None)
    for n in [n for n in chunks(field) if start_h // CHUNK <= n <= (stop_h - 1) // CHUNK]:
        path = cache / f'europe-{field}-{n}.om'
        if not path.exists():
            path.write_bytes(urllib.request.urlopen(f'{BASE}{field}/chunk_{n}.om', timeout=300).read())
        with OmFileReader(str(path)) as r:
            assert r.shape == (420, 700, CHUNK)
            data = r.read_array((slice(None), slice(None), slice(None)))[::-1]
        for i in range(CHUNK):
            k = month_of(n * CHUNK + i)
            if k is None: continue
            # Provider artefacts (negative values) are skipped like NaN, not clamped.
            x = data[:, :, i]; ok = np.isfinite(x) & (x >= 0)
            negative[k] += int((x < 0).sum())
            sums[k][ok] += x[ok]; counts[k] += ok
        path.unlink()
        print(field, n, flush=True)
    np.savez(cache / f'europe-monthly-{field}.npz', sums=sums, counts=counts, negative=negative)
    sys.exit()

# build: one float16 frame per month with data, layer-major in catalogue order; null where the archive has no month
loaded = {f: np.load(cache / f'europe-monthly-{f}.npz') for f in fields}
frames = []
for k, (a, b) in enumerate(months):
    hours = b - a; layers, coverage, skipped = [], {}, {}
    for f in fields:
        s, c = loaded[f]['sums'][k], loaded[f]['counts'][k].astype(float)
        assert c.max() <= hours
        mean = np.where(c > 0, s / np.maximum(c, 1), np.nan)
        # Cells with under 90% of the month's hours stay missing rather than becoming a biased mean.
        mean[c < .9 * hours] = np.nan
        assert np.isnan(mean).all() or np.nanmax(mean) < 65504
        coverage[f] = round(float(c.sum() / (hours * c.size)), 5)
        skipped[f] = int(loaded[f]['negative'][k])
        # 0.4° blocks: mean of the block's valid cells; a block with fewer than half valid stays missing.
        blocks = mean.reshape(105, 4, 175, 4)
        valid = np.isfinite(blocks).sum(axis=(1, 3))
        block = np.where(valid >= 8, np.nansum(blocks, axis=(1, 3)) / np.maximum(valid, 1), np.nan)
        layers.append(block.astype('<f4'))
    # Fields whose archive starts later stay NaN (missing, drawn as nothing) in the months before it starts.
    if max(coverage.values()) < .9:
        frames.append(None)
        print(dt.datetime.fromtimestamp(a * 3600, dt.timezone.utc).strftime('%Y-%m'), 'no data', coverage)
        continue
    blob = np.stack(layers).astype('<f2').tobytes(order='C')
    name = f'europe-month-{k:02d}.bin'
    compressed = gzip.compress(blob, compresslevel=9, mtime=0)
    (out / (name + '.gz')).write_bytes(compressed)
    frames.append({'validAt': a * 3600000, 'endAt': b * 3600000, 'hours': hours, 'coverage': coverage, 'negativeSkipped': skipped,
                   'dataFile': name, 'compressedFile': name + '.gz', 'byteLength': len(blob),
                   'compressedByteLength': len(compressed), 'sha256': hashlib.sha256(blob).hexdigest()})
    print(dt.datetime.fromtimestamp(a * 3600, dt.timezone.utc).strftime('%Y-%m'), len(compressed))
manifest = {
    'schema': 1, 'kind': 'modeled', 'domain': 'cams_europe', 'statistic': 'monthly mean',
    'provider': 'CAMS European ensemble via Open-Meteo AWS Open Data', 'source': BASE, 'documentation': 'https://github.com/open-meteo/open-data',
    'licence': 'CC BY 4.0', 'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'step': 'month',
    'grid': {'width': 175, 'height': 105, 'step': .4, 'latStart': 30.2, 'lonStart': -24.8, 'order': 'south-to-north, west-to-east'},
    'encoding': 'float16-le, layer-major', 'fieldOrder': fields, 'units': units, 'frames': frames,
}
(out / 'europe-history.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
print(sum(f is not None for f in frames), 'of', len(frames), 'months')
