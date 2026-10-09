"""Preserve all available native CAMS fields from matching, saved spatial files.
Usage: python scripts/expand-cams.py --global-file /cache/global.om --europe-file /cache/europe.om
Requires omfiles and numpy. Source paths/runs/times must match the existing metadata.
"""
import argparse, datetime as dt, hashlib, json, pathlib
import numpy as np
from omfiles import OmFileReader
p=argparse.ArgumentParser()
p.add_argument('--global-file',required=True);p.add_argument('--europe-file',required=True)
a=p.parse_args()
catalog=json.loads(pathlib.Path('src/camsFields.json').read_text())
for domain,file,schema in [('global',a.global_file,5),('europe',a.europe_file,6)]:
 out=pathlib.Path('public/data');stem='global-air-native' if domain=='global' else 'europe-air-native'
 meta=json.loads((out/(stem+'.json')).read_text())
 fields=[f for f in catalog if f['coverage']=='global'] if domain=='global' else [f for f in catalog if f['id'] not in ['aerosol_optical_depth','uv_index','uv_index_clear_sky']]
 arrays=[];stats={};units={}
 with OmFileReader(file) as root:
  assert root.get_child_by_name('valid_time').read_scalar()*1000==meta['validAt']
  assert root.get_child_by_name('forecast_reference_time').read_scalar()*1000==meta['referenceTime']
  assert root.get_child_by_name('coordinates').read_scalar()=='lat lon'
  crs=root.get_child_by_name('crs_wkt').read_scalar()
  assert ('BBOX[-90.0,-180.0,90.0,179.6]' if domain=='global' else 'BBOX[71.95,-24.95,30.049995,44.95]') in crs,crs
  for f in fields:
   id=f['id'];r=root.get_child_by_name(id);assert r.shape==(meta['grid']['height'],meta['grid']['width'])
   unit=r.get_child_by_name('unit').read_scalar();assert unit==f['unit'],(id,unit,f['unit'])
   values=r.read_array((...))
   assert np.isfinite(values).all() and (values>=0).all(),id
   if domain=='europe':values=values[::-1,:]
   arrays.append(values.astype('<f4').tobytes(order='C'));units[id]=unit
   stats[id]={'min':float(values.min()),'max':float(values.max()),'count':int(values.size)}
 blob=b''.join(arrays)
 # Verify the old four arrays remain bit-for-bit identical, even after a repeat extraction.
 old=(out/(stem+'.bin')).read_bytes();count=meta['grid']['width']*meta['grid']['height']*4
 for id in ['pm2_5','nitrogen_dioxide','ozone','dust']:
  old_index=meta['fieldOrder'].index(id);new_index=[f['id'] for f in fields].index(id)
  assert old[old_index*count:(old_index+1)*count]==blob[new_index*count:(new_index+1)*count],id
 meta.update(schema=schema,units=units,fieldOrder=[f['id'] for f in fields],byteLength=len(blob),sha256=hashlib.sha256(blob).hexdigest(),sourceSha256=hashlib.sha256(pathlib.Path(file).read_bytes()).hexdigest(),statistics=stats,retrievedAt=dt.datetime.now(dt.timezone.utc).isoformat())
 meta.pop('unit',None)
 (out/(stem+'.bin')).write_bytes(blob);(out/(stem+'.json')).write_text(json.dumps(meta,separators=(',',':'))+'\n')
 print(domain,len(fields),'fields',len(blob),'bytes',stats)
