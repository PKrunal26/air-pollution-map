// Stored gzip assets reduce transfer size; native decoders still verify every byte.
// Streams the body so callers can show real progress: onProgress(loadedBytes,totalBytes|null).
async function readBody(response,totals,onProgress){
 const reader=response.body?.getReader?.();
 if(!reader){const buffer=await response.arrayBuffer();onProgress?.(buffer.byteLength,buffer.byteLength);return buffer;}
 const chunks=[];let loaded=0;
 for(;;){
  const {done,value}=await reader.read();
  if(done)break;
  chunks.push(value);loaded+=value.byteLength;
  onProgress?.(loaded,totals.find(t=>t&&t>=loaded)??null);
 }
 const bytes=new Uint8Array(loaded);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 onProgress?.(loaded,loaded);
 return bytes.buffer;
}
export async function fetchNativeAsset(metadata,expectedFile,signal,onProgress){
 if(metadata.dataFile!==expectedFile)throw new Error('Unexpected native asset');
 const compressed=typeof DecompressionStream!=='undefined'&&metadata.compressedFile===`${expectedFile}.gz`;
 // The checksum in the metadata versions the URL, so the large binary can stay in the HTTP cache.
 const version=typeof metadata.sha256==='string'?`?v=${metadata.sha256.slice(0,12)}`:'';
 const response=await fetch(`data/${compressed?metadata.compressedFile:expectedFile}${version}`,{signal});
 if(!response.ok)throw new Error('Native field unavailable');
 const declared=Number(response.headers?.get?.('content-length'))||0;
 // If a server already decoded the gzip, bytes exceed the compressed size, so fall back to the raw length.
 const totals=[compressed?metadata.compressedByteLength:null,declared,metadata.byteLength];
 const buffer=await readBody(response,totals,onProgress);
 const bytes=new Uint8Array(buffer);
 // A server may already have decoded Content-Encoding: gzip.
 if(compressed&&bytes[0]===0x1f&&bytes[1]===0x8b){
  const stream=new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
 }
 return buffer;
}
