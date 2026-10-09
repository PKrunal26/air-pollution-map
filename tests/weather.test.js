import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodeWeather,sampleWeather,initialWeather,WEATHER_FIELDS,WEATHER_LAYERS} from '../src/weather.js';

test('weather is a verified complete global snapshot at the pollution timestamp',async()=>{
 const meta=JSON.parse(await readFile(new URL('../public/data/weather-native.json',import.meta.url),'utf8'));
 const pollution=JSON.parse(await readFile(new URL('../public/data/global-air-native.json',import.meta.url),'utf8'));
 const bytes=await readFile(new URL('../public/data/weather-native.bin',import.meta.url));
 const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
 const data=await decodeWeather(meta,buffer);
 assert.equal(data.validAt,pollution.validAt);
 assert.equal(data.fields.temperature_2m.length,1038240);
 for(const id of WEATHER_FIELDS){
  const a=data.fields[id];let min=Infinity,max=-Infinity;
  for(const v of a){min=Math.min(min,v);max=Math.max(max,v);}
  assert.equal(min,meta.statistics[id].min);assert.equal(max,meta.statistics[id].max);
  assert.equal(sampleWeather(data,id,90,-180),a[720*1440]);
  assert.equal(sampleWeather(data,id,-90,-180),a[0]);
  assert.equal(sampleWeather(data,id,0,180),sampleWeather(data,id,0,-180));
 }
 await assert.rejects(decodeWeather({...meta,units:{...meta.units,temperature_2m:'K'}},buffer),/units/);
 const bad=buffer.slice(0);new Uint8Array(bad)[123]^=1;
 await assert.rejects(decodeWeather(meta,bad),/checksum/);
 await assert.rejects(decodeWeather(meta,buffer.slice(0,-4)),/encoding/);
});

test('vector interpolation preserves signed east and north components across the date line',()=>{
 const data={grid:{width:4,height:2,step:90,latStart:-90,lonStart:-180},fields:{u:[-10,0,10,20,-20,0,20,40]}};
 assert.equal(sampleWeather(data,'u',-45,-135),-7.5);
 assert.equal(sampleWeather(data,'u',-90,135),5);
 assert.equal(sampleWeather(data,'u',-90,180),-10);
});

test('each weather layer starts off and can be changed independently',()=>{
 const a=initialWeather(),b=initialWeather();
 assert.ok(Object.values(a).every(s=>s.enabled===false));
 a.wind.enabled=true;assert.equal(a.temperature.enabled,false);assert.equal(a.humidity.enabled,false);assert.equal(b.wind.enabled,false);
});

test('weather layers carry key ticks for the on-map legend',()=>{
 for(const l of WEATHER_LAYERS){assert.ok(l.lo&&l.hi&&l.colour);}
 assert.equal(initialWeather().wind.enabled,false);
});
