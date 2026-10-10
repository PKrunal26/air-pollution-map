"""Download a 3-hourly sequence of complete CAMS global grids for the time bar (pip install omfiles numpy).
Usage: python scripts/fetch-air-frames.py 2026-10-08T12:00 2026-10-09T00:00 2026-10-11T00:00 /absolute/cache/path
Arguments: model run, first and last valid hour (inclusive, 3-hour steps), cache for the original OM files.
Run from the site checkout. Values are the provider's floats stored as float16 (layer-major, little-endian);
no interpolation between hours happens here. The run must still be on the bucket (old runs expire).
"""
import argparse, datetime as dt, gzip, hashlib, json, pathlib, urllib.request
import numpy as np
from omfiles import OmFileReader

parser = argparse.ArgumentParser()
parser.add_argument('run')
parser.add_argument('first')
parser.add_argument('last')
parser.add_argument('cache', type=pathlib.Path)
args = parser.parse_args()
utc = lambda s: dt.datetime.fromisoformat(s).replace(tzinfo=dt.timezone.utc)
run, first, last = utc(args.run), utc(args.first), utc(args.last)
step = dt.timedelta(hours=3)
assert first <= last and (last - first) % step == dt.timedelta(0)
args.cache.mkdir(parents=True, exist_ok=True)
base = 'https://openmeteo.s3.amazonaws.com/data_spatial/cams_global/'
catalog = json.loads(pathlib.Path('src/camsFields.json').read_text())
fields = [f for f in catalog if f['coverage'] == 'global']
variables = [f['id'] for f in fields]
units = {f['id']: f['unit'] for f in fields}
out = pathlib.Path('public/data')
snapshot = json.loads((out/'global-air-native.json').read_text())
assert snapshot['fieldOrder'] == variables
snapshot_values = np.frombuffer((out/snapshot['dataFile']).read_bytes(), '<f4').reshape(len(variables), 451, 900)

frames, maxima, index = [], {v: 0.0 for v in variables}, None
valid = first
while valid <= last:
    source = base + run.strftime('%Y/%m/%d/%H%MZ/') + valid.strftime('%Y-%m-%dT%H%M.om')
    cache_file = args.cache / (run.strftime('%Y-%m-%dT%H%MZ-') + valid.strftime('%Y-%m-%dT%H%M.om'))
    if not cache_file.exists():
        cache_file.write_bytes(urllib.request.urlopen(source, timeout=60).read())
    layers, missing = [], {}
    with OmFileReader(str(cache_file)) as root:
        assert root.get_child_by_name('valid_time').read_scalar() == int(valid.timestamp())
        assert root.get_child_by_name('forecast_reference_time').read_scalar() == int(run.timestamp())
        assert 'BBOX[-90.0,-180.0,90.0,179.6]' in root.get_child_by_name('crs_wkt').read_scalar()
        for name in variables:
            reader = root.get_child_by_name(name)
            assert reader.shape == (451, 900), (valid, name)
            assert reader.get_child_by_name('unit').read_scalar() == units[name]
            array = reader.read_array((...))
            # A few provider cells can be NaN; they stay NaN (missing, never zero) and are counted.
            gaps = int(np.isnan(array).sum())
            assert gaps < 1000 and np.all(np.isfinite(array[~np.isnan(array)])), (valid, name)
            assert np.nanmin(array) >= 0 and np.nanmax(array) < 65504, (valid, name)
            if gaps: missing[name] = gaps
            maxima[name] = max(maxima[name], float(np.nanmax(array)))
            layers.append(array.astype('<f4'))
    stack = np.stack(layers)
    if int(valid.timestamp() * 1000) == snapshot['validAt']:
        # The exact float32 snapshot and this frame come from the same run and hour.
        assert np.array_equal(stack, snapshot_values, equal_nan=True)
        index = len(frames)
    blob = stack.astype('<f2').tobytes(order='C')
    name = f'air-frame-{len(frames):02d}.bin'
    compressed = gzip.compress(blob, compresslevel=9, mtime=0)
    (out/(name + '.gz')).write_bytes(compressed)
    frames.append({'validAt': int(valid.timestamp() * 1000), 'source': source,
                   'sourceSha256': hashlib.sha256(cache_file.read_bytes()).hexdigest(),
                   'dataFile': name, 'compressedFile': name + '.gz', 'byteLength': len(blob),
                   'compressedByteLength': len(compressed), 'sha256': hashlib.sha256(blob).hexdigest(), 'missing': missing})
    print(valid.isoformat(), len(compressed))
    valid += step

assert index is not None, 'the sequence must include the snapshot hour'
manifest = {
    'schema': 1, 'kind': 'modeled', 'domain': 'cams_global',
    'provider': 'CAMS / ECMWF via Open-Meteo AWS Open Data', 'documentation': 'https://github.com/open-meteo/open-data',
    'licence': 'CC BY 4.0', 'referenceTime': int(run.timestamp() * 1000), 'stepHours': 3, 'snapshotIndex': index,
    'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
    'grid': snapshot['grid'], 'encoding': 'float16-le, layer-major', 'fieldOrder': variables, 'units': units,
    'maxima': maxima, 'frames': frames,
}
(out/'air-frames.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
print(len(frames), 'frames, snapshot index', index)
