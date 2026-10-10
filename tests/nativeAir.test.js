import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LEGACY_FIELD_IDS,GLOBAL_FIELD_IDS} from '../src/paintLayers.js';
import {decodeNativeLayers} from '../src/globalAir.js';

const metadata=JSON.parse(await readFile(new URL('../public/data/global-air-native.json',import.meta.url),'utf8'));
const bytes=await readFile(new URL('../public/data/global-air-native.bin',import.meta.url));
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

test('native bulk fields preserve every finite nonnegative provider float on the full globe',async()=>{
 const data=await decodeNativeLayers(metadata,buffer);
 assert.deepEqual(data.grid,{width:900,height:451,step:.4,latStart:-90,lonStart:-180,order:'south-to-north, west-to-east'});
 assert.equal(data.validAt,Date.parse('2026-10-09T03:00:00Z'));
 const view=new DataView(buffer),count=405900;
 metadata.fieldOrder.forEach((id,layer)=>{
  assert.equal(data.fields[id].length,count);
  for(let i=0;i<count;i++)assert.equal(data.fields[id][i],view.getFloat32((layer*count+i)*4,true));
 });
});

test('native grid orientation and units agree with independent API checks at seven geographic locations',async()=>{
 const data=await decodeNativeLayers(metadata,buffer);
 const checks=[
  [28.8,77.2,[78.9,34,85,135]],
  [51.6,0,[4.6,5.2,62,0]],
  [40,116.4,[109.7,83.3,28,7]],
  [24,10.4,[6.8,.1,46,38]],
  [0,-150,[3.8,0,25,0]],
  [34,-118.4,[11.2,27.1,53,2]],
  [-23.6,-46.8,[79.2,129.2,0,0]],
 ];
 for(const [lat,lon,values] of checks){
  const index=Math.round((lat+90)/.4)*900+Math.round((lon+180)/.4);
  LEGACY_FIELD_IDS.forEach((id,i)=>assert.ok(Math.abs(data.fields[id][index]-values[i])<.051));
 }
});

test('truncated, altered and incorrectly labelled native data cannot render',async()=>{
 await assert.rejects(decodeNativeLayers(metadata,buffer.slice(0,-4)));
 const changed=buffer.slice(0);new Uint8Array(changed)[12]^=1;
 await assert.rejects(decodeNativeLayers(metadata,changed),/checksum/);
 await assert.rejects(decodeNativeLayers({...metadata,fieldOrder:[...metadata.fieldOrder].reverse()},buffer));
 await assert.rejects(decodeNativeLayers({...metadata,units:{...metadata.units,pm2_5:'ppm'}},buffer));
 await assert.rejects(decodeNativeLayers({...metadata,grid:{...metadata.grid,step:1}},buffer));
 for(const invalid of [NaN,-1]){
  const bad=buffer.slice(0);new DataView(bad).setFloat32(12,invalid,true);
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bad)),b=>b.toString(16).padStart(2,'0')).join('');
  await assert.rejects(decodeNativeLayers({...metadata,sha256:hash},bad),/Invalid PM/);
 }
});

test('all 15 global CAMS fields carry correct individual units and stay separate',async()=>{
 const data=await decodeNativeLayers(metadata,buffer);
 assert.deepEqual(Object.keys(data.fields),GLOBAL_FIELD_IDS);
 assert.equal(metadata.units.aerosol_optical_depth,'');
 assert.equal(metadata.units.uv_index,'');
 assert.equal(metadata.units.carbon_monoxide,'μg/m³');
 for(const id of GLOBAL_FIELD_IDS){
  assert.ok(data.fields[id].every(v=>Number.isFinite(v)&&v>=0));
  assert.equal(Math.min(...data.fields[id].subarray(0,1000))>=metadata.statistics[id].min,true);
 }
 for(const id of ['aerosol_optical_depth','uv_index','carbon_monoxide']){
  await assert.rejects(decodeNativeLayers({...metadata,units:{...metadata.units,[id]:'ppm'}},buffer),/unit/);
 }
 const defaults=(await import('../src/paintLayers.js')).initialPaint();
 assert.equal(Object.values(defaults).filter(s=>s.enabled).length,2);
 assert.equal(defaults.pm2_5.enabled,true);
 assert.equal(defaults.dust.enabled,true);
 for(const id of GLOBAL_FIELD_IDS.filter(id=>id!=='pm2_5'&&id!=='dust'))assert.equal(defaults[id].enabled,false);
});
