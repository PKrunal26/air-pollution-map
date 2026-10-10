import test from 'node:test';
import assert from 'node:assert/strict';
import {parseEmbedParams,applyLayerSelection,homeDistanceForZoom} from '../src/embedParams.js';
import {initialPaint} from '../src/paintLayers.js';

test('no params keeps the normal app',()=>{
 assert.deepEqual(parseEmbedParams(''),{embed:false,layers:null,surface:null,zoom:null,bg:null});
 assert.deepEqual(parseEmbedParams('?city=paris'),{embed:false,layers:null,surface:null,zoom:null,bg:null});
});
test('embed flag accepts 1/true and rejects other values',()=>{
 assert.equal(parseEmbedParams('?embed=1').embed,true);
 assert.equal(parseEmbedParams('?embed=true').embed,true);
 assert.equal(parseEmbedParams('?embed=0').embed,false);
 assert.equal(parseEmbedParams('?embed').embed,false);
});
test('layers keep known ids in order, drop unknown and duplicates',()=>{
 assert.deepEqual(parseEmbedParams('?layers=pm2_5,dust,formaldehyde').layers,['pm2_5','dust','formaldehyde']);
 assert.deepEqual(parseEmbedParams('?layers=bogus,%20dust%20,,dust').layers,['dust']);
 assert.equal(parseEmbedParams('?layers=bogus').layers,null);
 assert.equal(parseEmbedParams('?layers=').layers,null);
});
test('surface and bg are validated',()=>{
 assert.equal(parseEmbedParams('?surface=White').surface,'white');
 assert.equal(parseEmbedParams('?surface=satellite').surface,'satellite');
 assert.equal(parseEmbedParams('?surface=neon').surface,null);
 assert.equal(parseEmbedParams('?bg=0B0E0D').bg,'#0b0e0d');
 assert.equal(parseEmbedParams('?bg=%23fff').bg,'#fff');
 assert.equal(parseEmbedParams('?bg=red').bg,null);
 assert.equal(parseEmbedParams('?bg=12345').bg,null);
 assert.equal(parseEmbedParams('?bg=url(x)').bg,null);
});
test('layer selection enables exactly the listed layers and keeps strengths',()=>{
 const base=initialPaint(),paint=applyLayerSelection(base,['dust','formaldehyde']);
 assert.deepEqual(Object.keys(paint).filter(id=>paint[id].enabled),['dust','formaldehyde']);
 assert.equal(paint.dust.strength,base.dust.strength);
 assert.equal(applyLayerSelection(base,null),base);
});
test('zoom accepts a positive number within range',()=>{
 assert.equal(parseEmbedParams('?zoom=1.6').zoom,1.6);
 assert.equal(parseEmbedParams('?zoom=%201%20').zoom,1);
 assert.equal(parseEmbedParams('?zoom=4').zoom,4);
 for(const bad of ['','0','-1','0.05','4.5','abc','1.5x','Infinity','NaN'])assert.equal(parseEmbedParams(`?zoom=${bad}`).zoom,null,bad);
});
test('zoom maps to a camera distance that gives that globe diameter / frame height',()=>{
 const fov=39,t=Math.tan(fov*Math.PI/360);
 for(const z of [.5,.77,1,1.6,2.5]){
  const d=homeDistanceForZoom(z,fov),diameter=Math.tan(Math.asin(1/d))/t;
  assert.ok(Math.abs(diameter-z)<1e-9,`${z}`);
 }
 assert.ok(Math.abs(homeDistanceForZoom(.77,fov)-3.8)<.01,'default home view is about 0.77');
 assert.ok(homeDistanceForZoom(1.6,fov)>1.18&&homeDistanceForZoom(1.6,fov)<homeDistanceForZoom(1,fov));
});
