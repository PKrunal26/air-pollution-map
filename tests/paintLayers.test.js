import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialPaint,mixPigments,keyRows,PAINT_LAYERS,LEGACY_FIELD_IDS} from '../src/paintLayers.js';
import {parseGlobalLayers} from '../src/globalAir.js';
import {WEATHER_LAYERS} from '../src/weather.js';

test('yellow and cyan pigments produce green without changing concentrations',()=>{
 const paint=initialPaint();paint.nitrogen_dioxide.enabled=true;
 const values={pm2_5:100,nitrogen_dioxide:20,ozone:0,dust:0},before={...values};
 const result=mixPigments(values,paint);
 assert.ok(result.colour[1]>result.colour[0]&&result.colour[1]>result.colour[2]);
 assert.deepEqual(values,before);
});
test('turning all layers off or setting their paint strength to zero clears the field',()=>{
 const paint=initialPaint(),values=Object.fromEntries(PAINT_LAYERS.map(p=>[p.id,p.range]));
 Object.values(paint).forEach(p=>{p.enabled=false;});assert.equal(mixPigments(values,paint).opacity,0);
 Object.values(paint).forEach(p=>{p.enabled=true;p.strength=0;});assert.equal(mixPigments(values,paint).opacity,0);
});
test('mixing is independent of control insertion order and remains bounded',()=>{
 const paint=initialPaint(),values={pm2_5:80,nitrogen_dioxide:12,ozone:100,dust:70};
 LEGACY_FIELD_IDS.forEach(id=>{paint[id].enabled=true;});
 const a=mixPigments(values,paint),b=mixPigments(values,Object.fromEntries(Object.entries(paint).reverse()));
 assert.deepEqual(a,b);assert.ok(a.opacity>0&&a.opacity<1);assert.ok(a.colour.every(c=>c>=0&&c<=1));
});
test('four real global fields have a shared timestamp and complete samples',async()=>{
 const data=parseGlobalLayers(JSON.parse(await readFile(new URL('./fixtures/global-air-layers.json',import.meta.url),'utf8')));
 assert.equal(data.modelCoordinates.length,2664);
 for(const id of LEGACY_FIELD_IDS){assert.equal(data.fields[id].length,2664);assert.ok(new Set(data.fields[id]).size>20);}
 const invalid=structuredClone(data);invalid.fields.ozone[12]=null;assert.throws(()=>parseGlobalLayers(invalid));
});

test('new fields produce independent bounded pigments and clear cleanly',()=>{
 for(const layer of PAINT_LAYERS){
  const paint=initialPaint();Object.values(paint).forEach(s=>{s.enabled=false;});
  paint[layer.id]={enabled:true,strength:100};
  const sample={[layer.id]:layer.range};
  const result=mixPigments(sample,paint);
  result.colour.forEach((c,i)=>assert.ok(Math.abs(c-layer.rgb[i])<1e-10));
  assert.ok(result.opacity>0);
  paint[layer.id].strength=0;assert.equal(mixPigments(sample,paint).opacity,0);
 }
});

test('PM2.5 and dust are enabled by default so first-load pigments stay readable',()=>{
 const enabled=Object.entries(initialPaint()).filter(([,s])=>s.enabled).map(([id])=>id);
 assert.deepEqual(enabled,['pm2_5','dust']);
});

test('colour key lists only enabled layers with their own scale',()=>{
 const paint=initialPaint(),weather={wind:{enabled:false},temperature:{enabled:true},humidity:{enabled:false}};
 paint.dust.enabled=false;paint.pm10.enabled=true;paint.ammonia.enabled=true;
 const rows=keyRows(paint,weather);
 assert.deepEqual(rows.map(r=>r.id),['pm2_5','pm10','ammonia','temperature']);
 assert.equal(rows[0].hi,'100+ μg/m³');
 assert.equal(rows[2].europe,true);assert.equal(rows[3].hi,'40+ °C');
 Object.values(paint).forEach(s=>{s.enabled=false;});assert.equal(keyRows(paint,{}).length,0);
});
const lin=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const oklab=hex=>{
 const [r,g,b]=[1,3,5].map(i=>lin(parseInt(hex.slice(i,i+2),16)/255));
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
};
const TARGET_L=.72,CHROMA_CAP=.122;

test('layer pigments share one OKLab lightness, capped chroma, and stay distinguishable',()=>{
 const all=[...PAINT_LAYERS.map(l=>({id:l.id,group:l.group,colour:l.colour})),...WEATHER_LAYERS.map(l=>({id:l.id,group:'Weather',colour:l.colour}))];
 all.forEach(l=>{l.lab=oklab(l.colour);});
 assert.equal(all.length,31);
 for(const l of all){
  assert.ok(Math.abs(l.lab[0]-TARGET_L)<=.005,`${l.id} L ${l.lab[0]}`);
  assert.ok(Math.hypot(l.lab[1],l.lab[2])<=CHROMA_CAP,`${l.id} chroma ${Math.hypot(l.lab[1],l.lab[2])}`);
 }
 const d=(a,b)=>Math.hypot(a.lab[0]-b.lab[0],a.lab[1]-b.lab[1],a.lab[2]-b.lab[2]);
 const worst={all:9,Pollutants:9,pollutantsVsWeather:9};
 for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
  const a=all[i],b=all[j],x=d(a,b);worst.all=Math.min(worst.all,x);
  if(a.group==='Pollutants'&&b.group==='Pollutants')worst.Pollutants=Math.min(worst.Pollutants,x);
  if([a.group,b.group].sort().join()==='Pollutants,Weather')worst.pollutantsVsWeather=Math.min(worst.pollutantsVsWeather,x);
 }
 assert.ok(worst.all>=.03,`closest pair ${worst.all}`);
 assert.ok(worst.Pollutants>=.09,`pollutants ${worst.Pollutants}`);
 assert.ok(worst.pollutantsVsWeather>=.033,`pollutants vs weather ${worst.pollutantsVsWeather}`);
 assert.equal(new Set(all.map(l=>l.colour)).size,all.length);
});
