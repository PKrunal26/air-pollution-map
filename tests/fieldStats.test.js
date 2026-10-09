import test from 'node:test';
import assert from 'node:assert/strict';
import {latWeights,weightedMeanStd,coefficientOfVariation,weightedPercentiles,fieldScale,displayWeight,scalesFor,CV_THRESHOLD} from '../src/fieldStats.js';
import {buildAirGeometry,WEIGHT_SCALE} from '../src/sphereSampling.js';
import {keyRows,initialPaint} from '../src/paintLayers.js';

const grid={width:4,height:3,step:90,latStart:-90,lonStart:-180};
test('latWeights: cos(lat) on the global grid, 1 regionally',()=>{
 const w=latWeights(grid,'cams_global');
 assert.ok(w[0]<1e-12&&Math.abs(w[4]-1)<1e-12&&w[8]<1e-12);
 assert.deepEqual([...latWeights(grid,'cams_europe')],Array(12).fill(1));
});
test('weighted mean, std and CV',()=>{
 const {mean,std}=weightedMeanStd([1,3],[1,1]);assert.equal(mean,2);assert.equal(std,1);
 assert.equal(coefficientOfVariation([1,3],[1,1]),.5);
 assert.equal(weightedMeanStd([0,10],[3,1]).mean,2.5);
 assert.equal(coefficientOfVariation([0,0],[1,1]),Infinity);
});
test('weighted percentiles respect weights and are deterministic',()=>{
 assert.deepEqual(weightedPercentiles([5,1,3,2,4],[1,1,1,1,1],[.2,.6,1]),[1,3,5]);
 assert.deepEqual(weightedPercentiles([1,2,3],[0,0,10],[.05,.99]),[3,3]);
 assert.deepEqual(weightedPercentiles([1,2,3],[8,1,1],[.5]),[1]);
});
test('near-uniform fields are muted, wide ones are not; override wins',()=>{
 const g={width:10,height:10,step:1,latStart:0,lonStart:0};
 const flat=Float32Array.from({length:100},(_,i)=>100+(i%10)),peaky=Float32Array.from({length:100},(_,i)=>i%10===0?200:1);
 const a=fieldScale(flat,g,'cams_europe'),b=fieldScale(peaky,g,'cams_europe');
 assert.ok(a.cv<CV_THRESHOLD&&a.emphasis==='muted'&&a.floor>=100&&a.ceiling<=109);
 assert.ok(b.cv>CV_THRESHOLD&&b.emphasis==='normal'&&b.floor===undefined);
 assert.equal(fieldScale(flat,g,'cams_europe',{emphasis:'normal'}).emphasis,'normal');
 assert.equal(fieldScale(peaky,g,'cams_europe',{emphasis:'muted'}).emphasis,'muted');
 assert.equal(fieldScale(new Float32Array(100),g,'cams_europe',{emphasis:'muted'}).emphasis,'normal');
});
test('displayWeight: baseline-aware when muted, value/range otherwise',()=>{
 const s={emphasis:'muted',floor:60,ceiling:120};
 assert.equal(displayWeight(60,s,120),0);assert.equal(displayWeight(30,s,120),0);
 assert.equal(displayWeight(90,s,120),.5);assert.equal(displayWeight(500,s,120),1);
 assert.equal(displayWeight(60,{emphasis:'normal'},120),.5);
 assert.equal(displayWeight(60,undefined,120),.5);assert.equal(displayWeight(0,s,120),0);assert.equal(displayWeight(NaN,s,120),0);
});
test('buildAirGeometry uses the layer scale, sampling true values',()=>{
 const data={domain:'cams_global',grid:{width:4,height:3,step:90,latStart:-90,lonStart:-180},fields:{a:new Float32Array(12).fill(90)}};
 const plain=buildAirGeometry(data,[{id:'a',range:120,slot:0}],64),muted=buildAirGeometry(data,[{id:'a',range:120,slot:0,scale:{emphasis:'muted',floor:60,ceiling:120}}],64);
 assert.equal(plain.weights[0][0],Math.round(.75*WEIGHT_SCALE));assert.equal(muted.weights[0][0],Math.round(.5*WEIGHT_SCALE));
});
test('scalesFor caches per dataset and forced emphasis follows the base',()=>{
 const g={width:10,height:10,step:1,latStart:0,lonStart:0},mk=f=>({domain:'cams_europe',grid:g,fields:{ozone:f}});
 const flat=mk(Float32Array.from({length:100},(_,i)=>100+(i%10))),layers=[{id:'ozone'}];
 const s=scalesFor(flat,layers);assert.equal(scalesFor(flat,layers),s);assert.equal(s.ozone.emphasis,'muted');
 const peaky=mk(Float32Array.from({length:100},(_,i)=>i%10===0?200:1));
 assert.equal(scalesFor(peaky,layers).ozone.emphasis,'normal');
 assert.equal(scalesFor(peaky,layers,s).ozone.emphasis,'muted');
});
test('keyRows shows the mapped span for muted layers',()=>{
 const paint=initialPaint();paint.ozone.enabled=true;
 const rows=keyRows(paint,{},{global:{ozone:{emphasis:'muted',floor:26,ceiling:126}}}),o=rows.find(r=>r.id==='ozone');
 assert.equal(o.hi,'26–126 μg/m³');assert.ok(o.muted);
});
