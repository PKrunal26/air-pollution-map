import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initialPaint,mixPigments,PAINT_LAYERS} from '../src/paintLayers.js';
import {parseGlobalLayers} from '../src/globalAir.js';

test('yellow and cyan pigments produce green without changing concentrations',()=>{
 const paint=initialPaint();paint.ozone.enabled=paint.dust.enabled=false;
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
 const a=mixPigments(values,paint),b=mixPigments(values,Object.fromEntries(Object.entries(paint).reverse()));
 assert.deepEqual(a,b);assert.ok(a.opacity>0&&a.opacity<1);assert.ok(a.colour.every(c=>c>=0&&c<=1));
});
test('four real global fields have a shared timestamp and complete samples',async()=>{
 const data=parseGlobalLayers(JSON.parse(await readFile(new URL('../public/data/global-air-layers.json',import.meta.url),'utf8')));
 assert.equal(data.modelCoordinates.length,2664);
 for(const layer of PAINT_LAYERS){assert.equal(data.fields[layer.id].length,2664);assert.ok(new Set(data.fields[layer.id]).size>20);}
 const invalid=structuredClone(data);invalid.fields.ozone[12]=null;assert.throws(()=>parseGlobalLayers(invalid));
});
