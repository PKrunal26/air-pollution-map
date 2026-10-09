import test from 'node:test';
import assert from 'node:assert/strict';
import {sphereSamples,sampleField,detailLevel,buildAirGeometry,WEIGHT_SCALE,DOT_COUNTS,REGIONAL_DOT_COUNTS,MIN_SPACING_PX,FULL_RADIUS,PLATE_OFFSET,dotSpacing,spacingPx,dotRadius,effectiveRadius,peakCoverage,plateOffset} from '../src/sphereSampling.js';
import {LEGACY_FIELD_IDS,EUROPE_FIELD_IDS} from '../src/paintLayers.js';
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

test('detail level keeps lattice pitch on screen near or above the minimum, with hysteresis',()=>{
 for(const [counts,ppus] of [[DOT_COUNTS,[150,254,454,908,1800,3000,14000]],[REGIONAL_DOT_COUNTS,[908,1816,4000,9000,14000]]])for(const ppu of ppus){
  const l=detailLevel(ppu,0,counts);
  assert.ok(l===0||spacingPx(counts[l],ppu)>=MIN_SPACING_PX,`level ${l} at ${ppu}px/unit`);
  if(l<counts.length-1)assert.ok(spacingPx(counts[l+1],ppu)<MIN_SPACING_PX*1.1);
 }
 // Home view (1440x900: 454 px/unit at 1x, 908 at 2x) has an 7-10 px pitch, leaving real room for dot sizes.
 for(const ppu of [454,908]){const px=spacingPx(DOT_COUNTS[detailLevel(ppu,0)],ppu);assert.ok(px>=MIN_SPACING_PX&&px<10.5,`${px}`);}
 assert.equal(detailLevel(10,3),0);
 assert.equal(detailLevel(1e6,0),DOT_COUNTS.length-1);
 const ppu=MIN_SPACING_PX*1.05/dotSpacing(DOT_COUNTS[3]);
 assert.equal(detailLevel(ppu,2),2);assert.equal(detailLevel(ppu,3),3);
 assert.ok(DOT_COUNTS.every((c,i)=>!i||c>DOT_COUNTS[i-1])&&REGIONAL_DOT_COUNTS.every((c,i)=>!i||c>REGIONAL_DOT_COUNTS[i-1]));
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
 assert.deepEqual(meta.fieldOrder,EUROPE_FIELD_IDS);
 assert.equal(meta.units.grass_pollen,'grains/m³');
 assert.equal(meta.units.ammonia,'μg/m³');
 await assert.rejects(decodeEuropeLayers({...meta,units:{...meta.units,grass_pollen:'μg/m³'}},buffer),/unit/);
 assert.ok(data.fields.alder_pollen.every(v=>v===0),'Preserve true seasonal zeros');
 const view=new DataView(buffer);
 meta.fieldOrder.forEach((id,layer)=>{for(let i=0;i<294000;i++)assert.equal(data.fields[id][i],view.getFloat32((layer*294000+i)*4,true));});
 for(const [lat,lon,expected] of [[48.85,2.35,[6.5,12.9,41,0]],[60.15,24.95,[11.4,3.7,67,0]]])LEGACY_FIELD_IDS.forEach((id,i)=>assert.ok(Math.abs(sampleField(data,id,lat,lon)-expected[i])<.051));
 await assert.rejects(decodeEuropeLayers({...meta,grid:{...meta.grid,latStart:71.95}},buffer));
 const changed=buffer.slice(0);new Uint8Array(changed)[100]^=1;
 await assert.rejects(decodeEuropeLayers(meta,changed),/checksum/);
 await assert.rejects(decodeEuropeLayers(meta,buffer.slice(0,-4)));
});

test('display geometry is a deterministic Earth-fixed lattice in sample order, valued at the true lat/lon',()=>{
 const count=4096;
 const data={domain:'cams_global',grid:{width:4,height:3,step:90,latStart:-90,lonStart:-180},fields:{a:new Float32Array(12).fill(50),b:Float32Array.from({length:12},(_,i)=>i*10)}};
 const layers=[{id:'a',range:100,slot:0},{id:'b',range:50,slot:5},{id:'missing',range:1,slot:2}];
 const first=buildAirGeometry(data,layers,count,null,8),again=buildAirGeometry(data,layers,count,null,8),samples=sphereSamples(count);
 assert.equal(first.length,count);
 assert.deepEqual(first.positions,again.positions);assert.deepEqual(first.weights[1],again.weights[1]);
 for(let i=0;i<count;i++){
  // No jitter and no shuffle: dot i sits exactly on lattice sample i (only lifted to radius 1.002).
  const o=i*5,k=1.002;
  assert.ok(Math.hypot(first.positions[i*3]-samples[o]*k,first.positions[i*3+1]-samples[o+1]*k,first.positions[i*3+2]-samples[o+2]*k)<2e-6);
  assert.equal(first.locations[i*2],samples[o+4]);assert.equal(first.locations[i*2+1],samples[o+3]);
 }
 for(let i=0;i<count;i+=97){
  const lat=first.locations[i*2+1],lon=first.locations[i*2];
  assert.equal(first.weights[0][i*4],Math.round(.5*WEIGHT_SCALE));
  assert.ok(Math.abs(first.weights[1][i*4+1]/WEIGHT_SCALE-Math.min(sampleField(data,'b',lat,lon)/50,1))<1/WEIGHT_SCALE);
  assert.equal(first.weights[0][i*4+2],0);
 }
});

test('halftone radius is area-proportional and continuous to zero, with no dropout threshold',()=>{
 assert.equal(dotRadius(0),0);assert.equal(dotRadius(-1),0);
 assert.ok(Math.abs(dotRadius(1)-FULL_RADIUS)<1e-12);assert.equal(dotRadius(7),dotRadius(1));
 for(const f of [.04,.25,.5,.81])assert.ok(Math.abs(dotRadius(f)**2/dotRadius(1)**2-f)<1e-12);
 assert.ok(2*FULL_RADIUS>1&&2*FULL_RADIUS<1.3,'full-range dot is about one lattice spacing wide');
 // Strictly increasing for any positive value: tiny values give tiny, not missing, dots.
 let last=0;for(let f=1e-6;f<=1;f*=1.7){const r=dotRadius(f);assert.ok(r>last);last=r;}
 // Sub-pixel discs keep ink area pi*r^2 (half-pixel disc scaled by (2r/pix)^2); larger discs are untouched.
 const pix=.1;
 for(const r of [.001,.01,.03,.049]){assert.ok(Math.abs(effectiveRadius(r,pix)**2*peakCoverage(r,pix)-r*r)<1e-12);assert.ok(peakCoverage(r,pix)<1);}
 for(const r of [.05,.2,.56]){assert.equal(effectiveRadius(r,pix),r);assert.equal(peakCoverage(r,pix),1);}
 assert.equal(peakCoverage(0,pix),0);
});

test('ink plates are fixed per layer index, independent of which layers are enabled',()=>{
 assert.deepEqual(plateOffset(3),plateOffset(3));
 for(let i=0;i<15;i++)assert.ok(Math.abs(Math.hypot(...plateOffset(i))-PLATE_OFFSET)<1e-12);
 assert.ok(PLATE_OFFSET>0&&PLATE_OFFSET<.35&&FULL_RADIUS+PLATE_OFFSET<1);
 // Golden-angle steps keep any small set of layers well separated around the cell.
 for(let i=0;i<6;i++)for(let j=i+1;j<6;j++){const [a,b]=[plateOffset(i),plateOffset(j)];assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>.12,`${i},${j}`);}
});
