import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {parseFrameManifest,parseEuropeManifest,createTimeline,decodeFrame,halfToFloat,framePair,nearestFrame,frameDataset,FRAME_CELLS} from '../src/airFrames.js';
import {EUROPE_ONLY_IDS} from '../src/paintLayers.js';

const manifest=JSON.parse(readFileSync('public/data/air-frames.json','utf8'));
const snapshot=JSON.parse(readFileSync('public/data/global-air-native.json','utf8'));

test('frame manifest: 17 three-hourly frames from the snapshot run, snapshot hour included', () => {
 parseFrameManifest(manifest);
 assert.equal(manifest.frames.length,17);
 assert.equal(manifest.referenceTime,snapshot.referenceTime);
 assert.equal(manifest.frames[manifest.snapshotIndex].validAt,snapshot.validAt);
 assert.deepEqual(manifest.fieldOrder,snapshot.fieldOrder);
 assert.throws(()=>parseFrameManifest({...manifest,frames:manifest.frames.slice(0,1)}));
 assert.throws(()=>parseFrameManifest({...manifest,frames:[manifest.frames[0],manifest.frames[2]]}));
 assert.throws(()=>parseFrameManifest({...manifest,encoding:'float32-le, layer-major'}));
});

test('snapshot frame decodes to the float32 snapshot within half precision', async () => {
 const entry=manifest.frames[manifest.snapshotIndex];
 const raw=gunzipSync(readFileSync(`public/data/${entry.compressedFile}`));
 const bits=await decodeFrame(entry,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 const native=new Float32Array(readFileSync('public/data/global-air-native.bin').buffer.slice(0));
 const data=frameDataset(manifest,manifest.snapshotIndex,bits);
 assert.equal(data.validAt,snapshot.validAt);
 manifest.fieldOrder.forEach((id,layer)=>{
  for(let i=0;i<FRAME_CELLS;i+=997){const a=data.fields[id][i],b=native[layer*FRAME_CELLS+i];assert.ok(Math.abs(a-b)<=Math.max(6e-8,Math.abs(b)*1e-3),`${id} ${i}: ${a} vs ${b}`);}
 });
 const bad=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);new Uint8Array(bad)[0]^=1;
 await assert.rejects(decodeFrame(entry,bad),/checksum/);
 await assert.rejects(decodeFrame(entry,new ArrayBuffer(8)),/length/);
});

test('provider gaps stay missing (NaN), never zero', async () => {
 const i=manifest.frames.findIndex(f=>Object.keys(f.missing??{}).length);
 if(i<0)return;
 const entry=manifest.frames[i],raw=gunzipSync(readFileSync(`public/data/${entry.compressedFile}`));
 const data=frameDataset(manifest,i,await decodeFrame(entry,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)));
 for(const [id,count] of Object.entries(entry.missing))assert.equal(data.fields[id].filter(Number.isNaN).length,count);
});

test('half floats and blend positions', () => {
 assert.equal(halfToFloat(0x3c00),1);
 assert.equal(halfToFloat(0x0001),2**-24);
 assert.equal(halfToFloat(0x7bff),65504);
 assert.ok(Number.isNaN(halfToFloat(0x7e00)));
 assert.deepEqual(framePair(0,17),{a:0,b:1,t:0});
 assert.deepEqual(framePair(3.25,17),{a:3,b:4,t:.25});
 // The last frame is reached as the end of the last pair at t = 1, exactly that frame.
 assert.deepEqual(framePair(16,17),{a:15,b:16,t:1});
 assert.equal(nearestFrame(3.6,17),4);
 assert.equal(nearestFrame(-1,17),0);
});

test('history manifest: consecutive calendar months, known fields, versioned files', async () => {
 const {parseHistoryManifest,createTimeline}=await import('../src/airFrames.js');
 const months=[Date.UTC(2022,7,1),Date.UTC(2022,8,1),Date.UTC(2022,9,1)];
 const entry=(i,fields)=>({validAt:months[i],endAt:months[i+1]??Date.UTC(2022,10,1),dataFile:`air-month-0${i}.bin`,compressedFile:`air-month-0${i}.bin.gz`,byteLength:900*451*fields.length*2,sha256:'0'.repeat(64)});
 const fields=['pm2_5','dust'];
 const m={schema:1,kind:'modeled',domain:'cams_global',statistic:'monthly mean',step:'month',encoding:'float16-le, layer-major',grid:{width:900,height:451,step:.4,latStart:-90,lonStart:-180},fieldOrder:fields,frames:[0,1,2].map(i=>entry(i,fields))};
 parseHistoryManifest(m);
 assert.throws(()=>parseHistoryManifest({...m,fieldOrder:['pm2_5','not_a_field']}));
 assert.throws(()=>parseHistoryManifest({...m,frames:[m.frames[0],m.frames[2]]}),/history entry/);
 assert.throws(()=>parseHistoryManifest({...m,frames:[{...m.frames[0],validAt:Date.UTC(2022,7,2)},m.frames[1]]}));
 // History never shows the snapshot (or the European layer); it opens on the latest month.
 const line=createTimeline(m,{kind:'history',start:2});
 assert.equal(line.atSnapshot,false);
 assert.equal(line.position,2);
 line.dispose();
});

test('history manifest accepts five fields', async () => {
 const {parseHistoryManifest}=await import('../src/airFrames.js');
 const months=[Date.UTC(2022,7,1),Date.UTC(2022,8,1)],fields=['pm2_5','dust','nitrogen_dioxide','pm10','carbon_monoxide'];
 const m={schema:1,kind:'modeled',domain:'cams_global',statistic:'monthly mean',step:'month',encoding:'float16-le, layer-major',grid:{width:900,height:451,step:.4,latStart:-90,lonStart:-180},fieldOrder:fields,
  frames:[0,1].map(i=>({validAt:months[i],endAt:months[i+1]??Date.UTC(2022,9,1),dataFile:`air-month-0${i}.bin`,compressedFile:`air-month-0${i}.bin.gz`,byteLength:900*451*5*2,sha256:'0'.repeat(64)}))};
 assert.doesNotThrow(()=>parseHistoryManifest(m));
});

test('shipped history: complete months from Aug 2022 (one more each month), PM2.5, dust and NO2, verified frames', async () => {
 const {parseHistoryManifest}=await import('../src/airFrames.js');
 const h=parseHistoryManifest(JSON.parse(readFileSync('public/data/air-history.json','utf8')));
 assert.equal(h.frames[0].validAt,Date.UTC(2022,7,1));
 assert.ok(h.frames.length>=50);
 // PM10 and CO join the original three once the history is rebuilt with them (event cards).
 assert.deepEqual(h.fieldOrder.slice(0,3),['pm2_5','dust','nitrogen_dioxide']);
 assert.ok([3,5].includes(h.fieldOrder.length)&&h.fieldOrder.slice(3).every(id=>['pm10','carbon_monoxide'].includes(id)));
 const last=h.frames.at(-1),raw=gunzipSync(readFileSync(`public/data/${last.compressedFile}`));
 const bits=await decodeFrame(last,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 const data=frameDataset(h,h.frames.length-1,bits);
 assert.equal(data.statistic,'monthly mean');
 const dust=data.fields.dust.filter(Number.isFinite);
 assert.ok(dust.length>FRAME_CELLS*.99&&dust.every(v=>v>=0));
});

test('Europe frames: one per forecast hour, and the snapshot hour decodes to the Europe snapshot', async () => {
 const europe=parseEuropeManifest(JSON.parse(readFileSync('public/data/europe-frames.json','utf8')),manifest);
 assert.deepEqual(europe.fieldOrder,EUROPE_ONLY_IDS);
 europe.frames.forEach((f,i)=>assert.equal(f.validAt,manifest.frames[i].validAt));
 assert.throws(()=>parseEuropeManifest({...europe,frames:europe.frames.slice(1)},manifest));
 assert.throws(()=>parseEuropeManifest({...europe,frames:[europe.frames[1],...europe.frames.slice(1)]},manifest));
 const entry=europe.frames[manifest.snapshotIndex],raw=gunzipSync(readFileSync(`public/data/${entry.compressedFile}`));
 const bits=await decodeFrame(entry,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 const data=frameDataset(europe,manifest.snapshotIndex,bits);
 const native=JSON.parse(readFileSync('public/data/europe-air-native.json','utf8')),values=new Float32Array(readFileSync('public/data/europe-air-native.bin').buffer.slice(0));
 assert.equal(data.domain,'cams_europe');
 const EUROPE_CELLS=700*420;
 for(const id of EUROPE_ONLY_IDS){const layer=native.fieldOrder.indexOf(id);for(let i=0;i<EUROPE_CELLS;i+=331){const a=data.fields[id][i],b=values[layer*EUROPE_CELLS+i];assert.ok(Math.abs(a-b)<=Math.max(6e-8,Math.abs(b)*1e-3),`${id} ${i}: ${a} vs ${b}`);}}
});

test('Europe history months line up with the global months at 0.4°; months without Europe data are null', async () => {
 const history=JSON.parse(readFileSync('public/data/air-history.json','utf8'));
 const europe=parseEuropeManifest(JSON.parse(readFileSync('public/data/europe-history.json','utf8')),history,'history');
 assert.equal(europe.grid.step,history.grid.step);
 assert.ok(europe.frames.some(f=>f===null)&&europe.frames.filter(Boolean).length>=48);
 assert.throws(()=>parseEuropeManifest(europe,history,'forecast'));
 // Every field has values somewhere in the record (pollen is zero out of season, so months are checked together).
 const seen=new Set();
 for(const [k,entry] of europe.frames.entries()){
  if(!entry)continue;
  const raw=gunzipSync(readFileSync(`public/data/${entry.compressedFile}`));
  const data=frameDataset(europe,k,await decodeFrame(entry,raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)));
  assert.equal(data.validAt,history.frames[k].validAt);
  EUROPE_ONLY_IDS.forEach(id=>{if(data.fields[id].some(v=>v>0))seen.add(id);});
 }
 assert.deepEqual([...seen].sort(),[...EUROPE_ONLY_IDS].sort());
});

test('timeline fetches Europe frames only while a Europe-only layer is on', async () => {
 const europe=parseEuropeManifest(JSON.parse(readFileSync('public/data/europe-frames.json','utf8')),manifest);
 const requested=[],realFetch=globalThis.fetch;
 globalThis.fetch=async url=>{requested.push(url);return new Promise(()=>{});};
 try{
  const line=createTimeline(manifest,{kind:'forecast',europe});
  line.seek(3);
  assert.ok(requested.length&&requested.every(u=>u.includes('air-frame-')));
  assert.equal(line.europeBits(3),null);
  line.useEurope(true);
  assert.ok(requested.some(u=>u.includes('europe-frame-03')));
  assert.equal(line.hasEurope(3),true);
  line.dispose();
 }finally{globalThis.fetch=realFetch;}
});
