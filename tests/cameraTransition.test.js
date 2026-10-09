import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {cameraArc,sampleCameraArc} from '../src/cameraTransition.js';

test('city flights stay outside Earth, including opposite hemispheres and unequal zooms',()=>{
 for(const end of [new Vector3(-2.3,0,0),new Vector3(0,1.18,0),new Vector3(1.18,0,0)]){
  const start=new Vector3(3.8,0,0),arc=cameraArc(start,end),point=new Vector3();
  for(let step=0;step<=100;step++){
   sampleCameraArc(arc,step/100,point);
   assert.ok(point.length()>=1.18-1e-10);
   assert.ok(point.length()<=3.8+1e-10);
  }
  assert.ok(sampleCameraArc(arc,0,point).distanceTo(start)<1e-10);
  assert.ok(sampleCameraArc(arc,1,point).distanceTo(end)<1e-10);
  assert.deepEqual(start.toArray(),[3.8,0,0]);
 }
});
