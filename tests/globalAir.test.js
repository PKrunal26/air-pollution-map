import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseGlobalAir,sampleGlobalAir} from '../src/globalAir.js';

test('global snapshot is complete, real-valued and consistently timestamped',async()=>{
 const snapshot=parseGlobalAir(JSON.parse(await readFile(new URL('../public/data/global-pm25.json',import.meta.url),'utf8')));
 assert.equal(snapshot.modelCoordinates.length,2664);
 assert.ok(new Set(snapshot.values).size>100);
 assert.equal(new Date(snapshot.validAt).getUTCMinutes(),0);
 assert.ok(snapshot.values.every(v=>Number.isFinite(v)&&v>=0));
});
test('sampling wraps longitude without inventing values across the date line',()=>{
 const values=Array.from({length:2664},(_,i)=>i%72);
 const data={grid:{width:72,height:37,step:5},values};
 assert.equal(sampleGlobalAir(data,0,-180),sampleGlobalAir(data,0,180));
 assert.equal(sampleGlobalAir(data,0,175),71);
 assert.equal(sampleGlobalAir(data,0,177.5),35.5);
});
test('missing samples and false units cannot be shown as pollution',()=>{
 assert.throws(()=>parseGlobalAir({}));
 const data={schema:1,pollutant:'pm2_5',unit:'μg/m³',domain:'cams_global',kind:'modeled',validAt:1,grid:{width:72,height:37,step:5,latStart:-90,lonStart:-180,order:'south-to-north, west-to-east'},values:Array(2664).fill(1)};
 data.values[100]=null;assert.throws(()=>parseGlobalAir(data));
});
