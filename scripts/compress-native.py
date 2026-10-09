"""Create deterministic, lossless gzip transfers for the committed native fields.
Run after regenerating any snapshot: python scripts/compress-native.py
"""
import gzip,json,pathlib,hashlib
root=pathlib.Path('public/data')
for name in ['global-air-native','europe-air-native','weather-native']:
 path=root/(name+'.json');meta=json.loads(path.read_text());data=(root/meta['dataFile']).read_bytes()
 assert len(data)==meta['byteLength'] and hashlib.sha256(data).hexdigest()==meta['sha256']
 compressed=gzip.compress(data,compresslevel=9,mtime=0)
 assert gzip.decompress(compressed)==data
 filename=meta['dataFile']+'.gz';(root/filename).write_bytes(compressed)
 meta.update(compressedFile=filename,compressedByteLength=len(compressed))
 path.write_text(json.dumps(meta,separators=(',',':'))+'\n')
 print(name, len(data), '->',len(compressed))
