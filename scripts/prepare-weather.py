"""Extract four native ECMWF IFS 0.25-degree fields via HTTP ranges.
Usage: /path/to/om-venv/bin/python scripts/prepare-weather.py 2026-10-09T03:00
"""
import argparse,datetime as dt,hashlib,json,pathlib,urllib.request,time
import numpy as np
from omfiles import OmFileReader
p=argparse.ArgumentParser();p.add_argument('hour');p.add_argument('--file');p.add_argument('--run');args=p.parse_args()
valid=dt.datetime.fromisoformat(args.hour).replace(tzinfo=dt.timezone.utc)
base='https://openmeteo.s3.amazonaws.com/data_spatial/ecmwf_ifs025/'
m=json.loads(urllib.request.urlopen(base+'latest.json',timeout=30).read())
assert m['completed'] and valid.strftime('%Y-%m-%dT%H:%MZ') in m['valid_times']
run=dt.datetime.fromisoformat((args.run or m['reference_time']).replace('Z','+00:00'))
url=base+run.strftime('%Y/%m/%d/%H%MZ/')+valid.strftime('%Y-%m-%dT%H%M.om')
class Remote:
 def __init__(self):self.memo={}
 def size(self,path):
  with urllib.request.urlopen(urllib.request.Request(path,method='HEAD'),timeout=30) as r:return int(r.headers['Content-Length'])
 def cat_file(self,path,start=None,end=None,**kwargs):
  key=(start,end)
  if key not in self.memo:
   for attempt in range(3):
    try:
     request=urllib.request.Request(path,headers={'Range':f'bytes={start or 0}-{end-1 if end else ""}'})
     with urllib.request.urlopen(request,timeout=60) as response:
      assert response.status==206,'Server must honor byte ranges'
      self.memo[key]=response.read()
     break
    except Exception:
     if attempt==2:raise
     time.sleep(1)
  return self.memo[key]
names=['temperature_2m','relative_humidity_2m','wind_u_component_10m','wind_v_component_10m']
units=['°C','%','m/s','m/s'];arrays=[];stats={}
with (OmFileReader(args.file) if args.file else OmFileReader.from_fsspec(Remote(),url)) as root:
 assert root.get_child_by_name('valid_time').read_scalar()==int(valid.timestamp())
 assert root.get_child_by_name('forecast_reference_time').read_scalar()==int(run.timestamp())
 assert root.get_child_by_name('coordinates').read_scalar()=='lat lon'
 assert 'BBOX[-90.0,-180.0,90.0,179.75]' in root.get_child_by_name('crs_wkt').read_scalar()
 for name,unit in zip(names,units):
  reader=root.get_child_by_name(name);assert reader.shape==(721,1440)
  actual=reader.get_child_by_name('unit').read_scalar()
  print(name,actual,flush=True)
  assert actual==unit,(actual,unit)
  a=reader.read_array((...));assert np.isfinite(a).all()
  if name=='relative_humidity_2m':assert a.min()>=0 and a.max()<=100
  if name=='temperature_2m':assert a.min()>-100 and a.max()<70
  if name.startswith('wind_'):assert np.abs(a).max()<150
  arrays.append(a.astype('<f4').tobytes(order='C'));stats[name]={'min':float(a.min()),'max':float(a.max()),'count':int(a.size)}
  print(stats[name],flush=True)
blob=b''.join(arrays);out=pathlib.Path('public/data')
meta={'schema':1,'kind':'modeled','domain':'ecmwf_ifs025','provider':'ECMWF IFS via Open-Meteo AWS Open Data','source':url,'documentation':'https://github.com/open-meteo/open-data','licence':'CC BY 4.0','validAt':int(valid.timestamp()*1000),'referenceTime':int(run.timestamp()*1000),'retrievedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'grid':{'width':1440,'height':721,'step':.25,'latStart':-90,'lonStart':-180,'order':'south-to-north, west-to-east'},'fieldOrder':names,'units':dict(zip(names,units)),'encoding':'float32-le, layer-major','dataFile':'weather-native.bin','byteLength':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'statistics':stats}
(out/'weather-native.bin').write_bytes(blob);(out/'weather-native.json').write_text(json.dumps(meta,separators=(',',':')))
print(json.dumps(meta,indent=2))
