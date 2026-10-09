import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fetchNativeAsset} from '../src/nativeAsset.js';

test('all compressed snapshots reproduce the original native float bytes exactly',async()=>{
 for(const name of ['global-air-native','europe-air-native','weather-native']){
  const meta=JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url)));
  const compressed=await readFile(new URL(`../public/data/${meta.compressedFile}`,import.meta.url));
  const original=await readFile(new URL(`../public/data/${meta.dataFile}`,import.meta.url));
  const decoded=gunzipSync(compressed);
  assert.deepEqual(decoded,original);
  assert.equal(createHash('sha256').update(decoded).digest('hex'),meta.sha256);
  assert.equal(compressed.byteLength,meta.compressedByteLength);
  assert.ok(compressed.byteLength<original.byteLength/2);
 }
});

test('browser asset loader decompresses once and preserves abort signals',async()=>{
 const name='global-air-native';
 const meta=JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url)));
 const compressed=await readFile(new URL(`../public/data/${meta.compressedFile}`,import.meta.url));
 const original=await readFile(new URL(`../public/data/${meta.dataFile}`,import.meta.url));
 const previous=globalThis.fetch,controller=new AbortController();
 try{
  globalThis.fetch=async(url,options)=>{assert.equal(url,`/data/${meta.compressedFile}?v=${meta.sha256.slice(0,12)}`);assert.equal(options.signal,controller.signal);assert.equal(options.cache,undefined);return new Response(compressed);};
  assert.deepEqual(Buffer.from(await fetchNativeAsset(meta,meta.dataFile,controller.signal)),original);
  // Some static servers already decompress the stored gzip through Content-Encoding.
  globalThis.fetch=async()=>new Response(original);
  assert.deepEqual(Buffer.from(await fetchNativeAsset(meta,meta.dataFile)),original);
 }finally{globalThis.fetch=previous;}
});

test('raw fallback works and missing or corrupt compressed assets fail visibly',async()=>{
 const previous=globalThis.fetch,decoder=globalThis.DecompressionStream;
 const meta={dataFile:'test.bin',compressedFile:'test.bin.gz'};
 try{
  globalThis.DecompressionStream=undefined;
  globalThis.fetch=async url=>{assert.equal(url,'/data/test.bin');return new Response(new Uint8Array([1,2,3]));};
  assert.deepEqual([...new Uint8Array(await fetchNativeAsset(meta,'test.bin'))],[1,2,3]);
  globalThis.DecompressionStream=decoder;
  globalThis.fetch=async()=>new Response(null,{status:503});
  await assert.rejects(fetchNativeAsset(meta,'test.bin'),/unavailable/);
  globalThis.fetch=async()=>new Response(new Uint8Array([0x1f,0x8b,0,0]));
  await assert.rejects(fetchNativeAsset(meta,'test.bin'));
  await assert.rejects(fetchNativeAsset({dataFile:'other.bin'},'test.bin'),/Unexpected/);
 }finally{globalThis.fetch=previous;globalThis.DecompressionStream=decoder;}
});

test('progress reports streamed bytes against the compressed size and ends complete',async()=>{
 const name='global-air-native';
 const meta=JSON.parse(await readFile(new URL(`../public/data/${name}.json`,import.meta.url)));
 const compressed=await readFile(new URL(`../public/data/${meta.compressedFile}`,import.meta.url));
 const original=await readFile(new URL(`../public/data/${meta.dataFile}`,import.meta.url));
 const previous=globalThis.fetch,events=[];
 try{
  const parts=[compressed.subarray(0,1000),compressed.subarray(1000,50000),compressed.subarray(50000)];
  globalThis.fetch=async()=>new Response(new ReadableStream({start(c){parts.forEach(p=>c.enqueue(new Uint8Array(p)));c.close();}}));
  assert.deepEqual(Buffer.from(await fetchNativeAsset(meta,meta.dataFile,undefined,(l,t)=>events.push([l,t]))),original);
  assert.deepEqual(events.slice(0,3).map(e=>e[0]),[1000,50000,compressed.byteLength]);
  assert.ok(events.slice(0,3).every(e=>e[1]===meta.compressedByteLength));
  assert.ok(events.every((e,i)=>i===0||e[0]>=events[i-1][0]));
  assert.deepEqual(events.at(-1),[compressed.byteLength,compressed.byteLength]);
  // A server that already decoded the gzip delivers more bytes than the compressed size: total falls back to the raw length.
  events.length=0;
  globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(original.subarray(0,5e6)));c.enqueue(new Uint8Array(original.subarray(5e6)));c.close();}}));
  await fetchNativeAsset(meta,meta.dataFile,undefined,(l,t)=>events.push([l,t]));
  assert.deepEqual(events[0],[5e6,meta.byteLength]);
 }finally{globalThis.fetch=previous;}
});
