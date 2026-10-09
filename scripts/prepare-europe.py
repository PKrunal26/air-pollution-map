"""Extract CAMS Europe native floats; only reverse its north-to-south rows."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib,json,sys
import numpy as np
from omfiles import OmFileReader
source=Path(sys.argv[1]); target=Path(__file__).resolve().parents[1]/'public/data'
r=OmFileReader(str(source))
assert int(r.get_child_by_name('valid_time').read_scalar())==1791514800
assert int(r.get_child_by_name('forecast_reference_time').read_scalar())==1791417600
crs=r.get_child_by_name('crs_wkt').read_scalar()
assert '71.95,-24.95,30.049995,44.95' in crs
order=['pm2_5','nitrogen_dioxide','ozone','dust']; arrays=[]; statistics={}
for name in order:
    a=r.get_child_by_name(name)[:,:]
    assert a.shape==(420,700) and np.isfinite(a).all() and (a>=0).all()
    arrays.append(a[::-1,:].astype('<f4'))
    statistics[name]={'min':float(a.min()),'max':float(a.max()),'count':a.size}
binary=b''.join(a.tobytes() for a in arrays)
metadata={'schema':4,'unit':'μg/m³','kind':'modeled','domain':'cams_europe','provider':'CAMS European ensemble via Open-Meteo AWS Open Data','source':'https://openmeteo.s3.amazonaws.com/data_spatial/cams_europe/2026/10/08/0000Z/2026-10-09T0300.om','documentation':'https://open-meteo.com/en/docs/air-quality-api','licence':'CC BY 4.0','validAt':int(r.get_child_by_name('valid_time').read_scalar())*1000,'referenceTime':int(r.get_child_by_name('forecast_reference_time').read_scalar())*1000,'retrievedAt':datetime.now(timezone.utc).isoformat(),'grid':{'width':700,'height':420,'step':.1,'latStart':30.05,'lonStart':-24.95,'order':'south-to-north, west-to-east'},'encoding':'float32-le, layer-major','fieldOrder':order,'dataFile':'europe-air-native.bin','byteLength':len(binary),'sha256':hashlib.sha256(binary).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'statistics':statistics}
(target/metadata['dataFile']).write_bytes(binary)
(target/'europe-air-native.json').write_text(json.dumps(metadata,separators=(',',':'))+'\n')
print(json.dumps({'cells':700*420,'fields':order,'validAt':metadata['validAt'],'sha256':metadata['sha256']}))
