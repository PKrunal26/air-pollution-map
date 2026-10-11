"""Download one complete CAMS Europe native grid, every field the site shows for Europe (pip install omfiles numpy).
Usage: python scripts/fetch-europe-native.py 2026-10-09T03:00 /absolute/cache/path [--run 2026-10-08T00:00]
Without --run the newest completed run is used. Run from the site checkout. Rows are flipped to south-to-north;
values are otherwise the provider's floats. Run compress-native.py afterwards.
"""
import argparse, datetime as dt, hashlib, json, pathlib, urllib.request
import numpy as np
from omfiles import OmFileReader

parser = argparse.ArgumentParser()
parser.add_argument('hour')
parser.add_argument('cache', type=pathlib.Path)
parser.add_argument('--run')
args = parser.parse_args()
utc = lambda s: dt.datetime.fromisoformat(s.replace('Z', '+00:00')).replace(tzinfo=dt.timezone.utc)
valid = utc(args.hour)
args.cache.mkdir(parents=True, exist_ok=True)
base = 'https://openmeteo.s3.amazonaws.com/data_spatial/cams_europe/'
if args.run:
    run = utc(args.run)
else:
    latest = json.loads(urllib.request.urlopen(base + 'latest.json', timeout=30).read())
    assert latest['completed'] is True and valid.strftime('%Y-%m-%dT%H:%MZ') in latest['valid_times']
    run = utc(latest['reference_time'])
source = base + run.strftime('%Y/%m/%d/%H%MZ/') + valid.strftime('%Y-%m-%dT%H%M.om')
cache_file = args.cache / ('europe-' + run.strftime('%Y-%m-%dT%H%MZ-') + valid.strftime('%Y-%m-%dT%H%M.om'))
if not cache_file.exists():
    cache_file.write_bytes(urllib.request.urlopen(source, timeout=60).read())
catalog = json.loads(pathlib.Path('src/camsFields.json').read_text())
fields = [f for f in catalog if f['id'] not in ['aerosol_optical_depth', 'uv_index', 'uv_index_clear_sky']]
arrays, stats, units = [], {}, {}
with OmFileReader(str(cache_file)) as root:
    assert root.get_child_by_name('valid_time').read_scalar() == int(valid.timestamp())
    assert root.get_child_by_name('forecast_reference_time').read_scalar() == int(run.timestamp())
    assert root.get_child_by_name('coordinates').read_scalar() == 'lat lon'
    assert 'BBOX[71.95,-24.95,30.049995,44.95]' in root.get_child_by_name('crs_wkt').read_scalar()
    for f in fields:
        reader = root.get_child_by_name(f['id'])
        assert reader.shape == (420, 700), f['id']
        unit = reader.get_child_by_name('unit').read_scalar()
        assert unit == f['unit'], (f['id'], unit, f['unit'])
        values = reader.read_array((...))[::-1, :]
        assert np.isfinite(values).all() and (values >= 0).all(), f['id']
        arrays.append(values.astype('<f4').tobytes(order='C')); units[f['id']] = unit
        stats[f['id']] = {'min': float(values.min()), 'max': float(values.max()), 'count': int(values.size)}
blob = b''.join(arrays)
out = pathlib.Path('public/data')
meta = {
    'schema': 6, 'kind': 'modeled', 'domain': 'cams_europe', 'provider': 'CAMS European ensemble via Open-Meteo AWS Open Data',
    'source': source, 'documentation': 'https://open-meteo.com/en/docs/air-quality-api', 'licence': 'CC BY 4.0',
    'validAt': int(valid.timestamp() * 1000), 'referenceTime': int(run.timestamp() * 1000),
    'retrievedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
    'grid': {'width': 700, 'height': 420, 'step': .1, 'latStart': 30.05, 'lonStart': -24.95, 'order': 'south-to-north, west-to-east'},
    'encoding': 'float32-le, layer-major', 'fieldOrder': [f['id'] for f in fields], 'units': units, 'dataFile': 'europe-air-native.bin',
    'byteLength': len(blob), 'sha256': hashlib.sha256(blob).hexdigest(),
    'sourceSha256': hashlib.sha256(cache_file.read_bytes()).hexdigest(), 'statistics': stats,
}
(out / 'europe-air-native.bin').write_bytes(blob)
(out / 'europe-air-native.json').write_text(json.dumps(meta, separators=(',', ':')) + '\n')
print('europe', valid.isoformat(), 'run', run.isoformat(), len(fields), 'fields')
