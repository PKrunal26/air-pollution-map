import test from 'node:test';
import assert from 'node:assert/strict';
import {sphereSamples,sampleField,detailLevel} from '../src/sphereSampling.js';
import {decodeEuropeLayers} from '../src/globalAir.js';
import {readFile} from 'node:fs/promises';

test('equal-area dots have the same density in polar and equatorial bands, without repeated poles',()=>{
 const points=sphereSamples(8192),bins=Array(16).fill(0),seen=new Set();
 for(let i=0;i<points.length;i+=5){
  const [x,y,z]=points.subarray(i,i+3);
  assert.ok(Math.abs(Math.hypot(x,y,z)-1)<1e-6);
  assert.ok(Math.abs(y)<1);
  bins[Math.min(15,Math.floor((y+1)*8))]++;
  seen.add(`${x},${y},${z}`);
 }
 assert.equal(seen.size,8192);
 assert.ok(Math.max(...bins)-Math.min(...bins)<=1);
 // Surface nearest-neighbour distance must not collapse near either pole.
 const distances={polar:[],equator:[]};
 for(let i=0;i<points.length;i+=5*17){
  const y=points[i+1],group=Math.abs(y)>.9?'polar':Math.abs(y)<.1?'equator':null;
  if(!group)continue;
  let nearest=Infinity;
  for(let j=0;j<points.length;j+=5){if(i===j)continue;nearest=Math.min(nearest,Math.hypot(points[i]-points[j],y-points[j+1],points[i+2]-points[j+2]));}
  distances[group].push(nearest);
 }
 const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
 assert.ok(mean(distances.polar)/mean(distances.equator)>.95);
 assert.ok(mean(distances.polar)/mean(distances.equator)<1.05);
});

test('zoom reveals progressively denser samples and has stable thresholds',()=>{
 let level=0;
 level=detailLevel(2.9,level);assert.equal(level,1);
 assert.equal(detailLevel(3.05,level),1);
 level=detailLevel(2,level);assert.equal(level,2);
 assert.equal(detailLevel(2.15,level),2);
 assert.equal(detailLevel(2.3,level),1);
 assert.equal(detailLevel(3.3,1),0);
});

test('display sampling respects the date line, exact native nodes, and regional edges',()=>{
 const data={domain:'cams_global',grid:{width:4,height:2,step:90,latStart:-90,lonStart:-180},fields:{p:[0,10,20,30,40,50,60,70]}};
 assert.equal(sampleField(data,'p',-90,-180),0);
 assert.equal(sampleField(data,'p',0,90),70);
 assert.equal(sampleField(data,'p',-90,135),15);
 assert.equal(sampleField(data,'p',-90,180),0);
 data.domain='cams_europe';assert.equal(sampleField(data,'p',-90,180),30);
});

test('regional snapshot preserves floats, native orientation, shared time and API check values',async()=>{
 const meta=JSON.parse(await readFile(new URL('../public/data/europe-air-native.json',import.meta.url),'utf8'));
 const bytes=await readFile(new URL('../public/data/europe-air-native.bin',import.meta.url));
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),data=await decodeEuropeLayers(meta,buffer);
 assert.equal(data.validAt,Date.parse('2026-10-09T03:00:00Z'));
 const view=new DataView(buffer);
 meta.fieldOrder.forEach((id,layer)=>{for(let i=0;i<294000;i++)assert.equal(data.fields[id][i],view.getFloat32((layer*294000+i)*4,true));});
 for(const [lat,lon,expected] of [[48.85,2.35,[6.5,12.9,41,0]],[60.15,24.95,[11.4,3.7,67,0]]])meta.fieldOrder.forEach((id,i)=>assert.ok(Math.abs(sampleField(data,id,lat,lon)-expected[i])<.051));
 await assert.rejects(decodeEuropeLayers({...meta,grid:{...meta.grid,latStart:71.95}},buffer));
 const changed=buffer.slice(0);new Uint8Array(changed)[100]^=1;
 await assert.rejects(decodeEuropeLayers(meta,changed),/checksum/);
 await assert.rejects(decodeEuropeLayers(meta,buffer.slice(0,-4)));
});
