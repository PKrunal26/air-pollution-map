"""Download the Europe-only CAMS fields for every hour of the time bar (pip install omfiles numpy).
Usage: python scripts/fetch-europe-frames.py 2026-10-08T00:00 /absolute/cache/path
Argument: the CAMS Europe model run of public/data/europe-air-native.json. Hours follow public/data/air-frames.json one
for one, so both timelines share frame indexes. Values are the provider's floats stored as float16 (layer-major,
little-endian, rows flipped to south-to-north like the snapshot). The run must still be on the bucket.
"""
import argparse, datetime as dt, gzip, hashlib, json, pathlib, urllib.request
import numpy as np
from omfiles import OmFileReader

parser = argparse.ArgumentParser()
parser.add_argument('run')
parser.add_argument('cache', type=pathlib.Path)
args = parser.parse_args()
run = dt.datetime.fromisoformat(args.run).replace(tzinfo=dt.timezone.utc)
args.cache.mkdir(parents=True, exist_ok=True)
base = 'https://openmeteo.s3.amazonaws.com/data_spatial/cams_europe/'
catalog = json.loads(pathlib.Path('src/camsFields.json').read_text())
variables = [f['id'] for f in catalog if f['coverage'] == 'europe']
units = {f['id']: f['unit'] for f in catalog if f['coverage'] == 'europe'}
out = pathlib.Path('public/data')
global_frames = json.loads((out/'air-frames.json').read_text())
snapshot = json.loads((out/'europe-air-native.json').read_text())
assert snapshot['referenceTime'] == int(run.timestamp() * 1000)
snapshot_values = np.frombuffer((out/snapshot['dataFile']).read_bytes(), '<f4').reshape(len(snapshot['fieldOrder']), 420, 700)

frames, maxima = [], {v: 0.0 for v in variables}
for k, entry in enumerate(global_frames['frames']):
    valid = dt.datetime.fromtimestamp(entry['validAt'] / 1000, dt.timezone.utc)
    source = base + run.strftime('%Y/%m/%d/%H%MZ/') + valid.strftime('%Y-%m-%dT%H%M.om')
    cache_file = args.cache / ('europe-' + run.strftime('%Y-%m-%dT%H%MZ-') + valid.strftime('%Y-%m-%dT%H%M.om'))
    if not cache_file.exists():
        cache_file.write_bytes(urllib.request.urlopen(source, timeout=60).read())
    layers = []
    with OmFileReader(str(cache_file)) as root:
        assert root.get_child_by_name('valid_time').read_scalar() == int(valid.timestamp())
        assert root.get_child_by_name('forecast_reference_time').read_scalar() == int(run.timestamp())
        assert '71.95,-24.95,30.049995,44.95' in root.get_child_by_name('crs_wkt').read_scalar()
        for name in variables:
            reader = root.get_child_by_name(name)
            assert reader.shape == (420, 700), (valid, name)
            assert reader.get_child_by_name('unit').read_scalar() == units[name]
            array = reader.read_array((...))[::-1]
            assert np.all(np.isfinite(array)) and array.min() >= 0 and array.max() < 65504, (valid, name)
            maxima[name] = max(maxima[name], float(array.max()))
            layers.append(array.astype('<f4'))
    stack = np.stack(layers)
    if entry['validAt'] == snapshot['validAt']:
        # The snapshot hour comes from the same run, so it must match the float32 snapshot exactly.
        assert k == global_frames['snapshotIndex']
        assert np.array_equal(stack, np.stack([snapshot_values[snapshot['fieldOrder'].index(v)] for v in variables]))
    blob = stack.astype('<f2').tobytes(order='C')
    name = f'europe-frame-{k:02d}.bin'
    compressed = gzip.compress(blob, compresslevel=9, mtime=0)
    (out/(name + '.gz')).write_bytes(compressed)
    frames.append({'validAt': entry['validAt'], 'source': source,
                   'sourceSha256': hashlib.sha256(cache_file.read_bytes()).hexdigest(),
                   'dataFile': name, 'compressedFile': name + '.gz', 'byteLength': len(blob),
                   'compressedByteLength': len(compressed), 'sha256': hashlib.sha256(blob).hexdigest()})
    print(valid.isoformat(), len(compressed))

manifest = {
    'schema': 1, 'kind': 'modeled', 'domain': 'cams_europe',
    'provider': 'CAMS European ensemble via Open-Meteo AWS Open Data', 'documentation': 'https://github.com/open-meteo/open-data',
    'licence': 'CC BY 4.0', 'referenceTime': int(run.timestamp() * 1000), 'stepHours': 3, 'snapshotIndex': global_frames['snapshotIndex'],
    'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
    'grid': snapshot['grid'], 'encoding': 'float16-le, layer-major', 'fieldOrder': variables, 'units': units,
    'maxima': maxima, 'frames': frames,
}
(out/'europe-frames.json').write_text(json.dumps(manifest, separators=(',', ':')) + '\n')
print(len(frames), 'frames')
