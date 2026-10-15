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
 assert.equal(data.validAt,metadata.validAt);
 assert.equal(data.validAt%(3*3600e3),0,'a 3-hourly hour');
 const view=new DataView(buffer),count=405900;
 metadata.fieldOrder.forEach((id,layer)=>{
  assert.equal(data.fields[id].length,count);
  for(let i=0;i<count;i++)assert.equal(data.fields[id][i],view.getFloat32((layer*count+i)*4,true));
 });
});

// The data is refreshed daily, so orientation is checked with contrasts that hold on any day: Saharan dust against the
// Southern Ocean and the Pacific at the Sahara's latitude, and Southern Ocean sea salt against the Sahara.
test('native grid orientation: Saharan dust and Southern Ocean sea salt sit where they belong',async()=>{
 const data=await decodeNativeLayers(metadata,buffer);
 const mean=(id,lat0,lat1,lon0,lon1)=>{let sum=0,n=0;for(let lat=lat0;lat<=lat1;lat+=.4)for(let lon=lon0;lon<=lon1;lon+=.4){sum+=data.fields[id][Math.round((lat+90)/.4)*900+Math.round((lon+180)/.4)];n++;}return sum/n;};
 const sahara=[18,28,-5,25],southernOcean=[-60,-50,-5,25],pacific=[18,28,-175,-145];
 assert.ok(mean('dust',...sahara)>5*mean('dust',...southernOcean),'north and south swapped');
 assert.ok(mean('dust',...sahara)>5*mean('dust',...pacific),'longitudes shifted');
 assert.ok(mean('sea_salt_aerosol',...southernOcean)>mean('sea_salt_aerosol',...sahara),'north and south swapped');
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

test('provider gaps load as NaN only when the metadata declares them',async()=>{
 const gap=buffer.slice(0);new DataView(gap).setFloat32(12,NaN,true);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',gap)),b=>b.toString(16).padStart(2,'0')).join('');
 const before=new Float32Array(buffer,0,900*451);
 const known=before.reduce((n,v)=>n+Number.isNaN(v),0),missing=metadata.missing??{};
 const declared=await decodeNativeLayers({...metadata,sha256:hash,missing:{...missing,pm2_5:known+(Number.isNaN(before[3])?0:1)}},gap);
 assert.ok(Number.isNaN(declared.fields.pm2_5[3]));
 await assert.rejects(decodeNativeLayers({...metadata,sha256:hash,missing:{...missing,pm2_5:known+2}},gap),/Invalid PM/);
 await assert.rejects(decodeNativeLayers({...metadata,sha256:hash,missing:Object.fromEntries(Object.entries(missing).filter(([id])=>id!=='pm2_5'))},gap),/Invalid PM/);
});

test('all 15 global CAMS fields carry correct individual units and stay separate',async()=>{
 const data=await decodeNativeLayers(metadata,buffer);
 assert.deepEqual(Object.keys(data.fields),GLOBAL_FIELD_IDS);
 assert.equal(metadata.units.aerosol_optical_depth,'');
 assert.equal(metadata.units.uv_index,'');
 assert.equal(metadata.units.carbon_monoxide,'μg/m³');
 for(const id of GLOBAL_FIELD_IDS){
  assert.ok(data.fields[id].every(v=>Number.isNaN(v)||(Number.isFinite(v)&&v>=0)));
  assert.equal(data.fields[id].filter(Number.isNaN).length,metadata.missing?.[id]??0);
  assert.equal(Math.min(...data.fields[id].subarray(0,1000).filter(v=>!Number.isNaN(v)))>=metadata.statistics[id].min,true);
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
