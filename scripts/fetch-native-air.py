"""Download one complete CAMS native grid (pip install omfiles numpy).
Usage: python scripts/fetch-native-air.py 2026-10-09T03:00 /absolute/cache/path
Run from the site checkout. No forecast interpolation or synthetic samples.
"""
import argparse, datetime as dt, hashlib, json, pathlib, urllib.request
import numpy as np
from omfiles import OmFileReader

parser = argparse.ArgumentParser()
parser.add_argument('hour')
parser.add_argument('cache', type=pathlib.Path)
args = parser.parse_args()
valid = dt.datetime.fromisoformat(args.hour).replace(tzinfo=dt.timezone.utc)
assert valid.minute == valid.second == 0
args.cache.mkdir(parents=True, exist_ok=True)
base = 'https://openmeteo.s3.amazonaws.com/data_spatial/cams_global/'
metadata = json.loads(urllib.request.urlopen(base+'latest.json', timeout=30).read())
assert metadata['completed'] is True
assert valid.strftime('%Y-%m-%dT%H:%MZ') in metadata['valid_times']
run = dt.datetime.fromisoformat(metadata['reference_time'].replace('Z','+00:00'))
source = base+run.strftime('%Y/%m/%d/%H%MZ/')+valid.strftime('%Y-%m-%dT%H%M.om')
cache_file = args.cache / (run.strftime('%Y-%m-%dT%H%MZ-')+valid.strftime('%Y-%m-%dT%H%M.om'))
if not cache_file.exists():
    cache_file.write_bytes(urllib.request.urlopen(source, timeout=60).read())
catalog = json.loads(pathlib.Path('src/camsFields.json').read_text())
fields = [f for f in catalog if f['coverage'] == 'global']
variables = [f['id'] for f in fields]
units = {f['id']: f['unit'] for f in fields}
arrays, stats = [], {}
with OmFileReader(str(cache_file)) as root:
    assert root.get_child_by_name('valid_time').read_scalar() == int(valid.timestamp())
    assert root.get_child_by_name('forecast_reference_time').read_scalar() == int(run.timestamp())
    assert root.get_child_by_name('coordinates').read_scalar() == 'lat lon'
    crs = root.get_child_by_name('crs_wkt').read_scalar()
    assert 'BBOX[-90.0,-180.0,90.0,179.6]' in crs
    for name in variables:
        reader = root.get_child_by_name(name)
        assert reader.shape == (451,900)
        assert reader.get_child_by_name('unit').read_scalar() == units[name]
        array = reader.read_array((...))
        assert np.all(np.isfinite(array)) and np.all(array >= 0)
        arrays.append(array.astype('<f4').tobytes(order='C'))
        stats[name] = {'min':float(array.min()),'max':float(array.max()),'count':int(array.size)}
blob = b''.join(arrays)
asset = pathlib.Path('public/data')
asset.mkdir(parents=True,exist_ok=True)
snapshot = {
    'schema':5,'units':units,'kind':'modeled','domain':'cams_global',
    'provider':'CAMS / ECMWF via Open-Meteo AWS Open Data','source':source,
    'documentation':'https://github.com/open-meteo/open-data','licence':'CC BY 4.0',
    'validAt':int(valid.timestamp()*1000),'referenceTime':int(run.timestamp()*1000),
    'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
    'grid':{'width':900,'height':451,'step':0.4,'latStart':-90,'lonStart':-180,'order':'south-to-north, west-to-east'},
    'encoding':'float32-le, layer-major','fieldOrder':variables,'dataFile':'global-air-native.bin',
    'byteLength':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),
    'sourceSha256':hashlib.sha256(cache_file.read_bytes()).hexdigest(),'statistics':stats,
}
(asset/'global-air-native.bin').write_bytes(blob)
(asset/'global-air-native.json').write_text(json.dumps(snapshot,separators=(',',':')))
print(json.dumps(snapshot,indent=2))
