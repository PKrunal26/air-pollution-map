import test from 'node:test';
import assert from 'node:assert/strict';
import {subsolarPoint,timelineTime} from '../src/sunPosition.js';

const near=(a,b,tol,msg)=>assert.ok(Math.abs(a-b)<=tol,`${msg}: ${a} vs ${b}`);

test('sun is overhead at the tropic at the June solstice and near the equator at the equinox',()=>{
 const june=subsolarPoint(Date.UTC(2026,5,21,12));
 near(june.lat,23.44,.05,'June latitude');near(june.lon,.4,.5,'June longitude');
 const march=subsolarPoint(Date.UTC(2026,2,20,14,46));
 near(march.lat,0,.05,'equinox latitude');
});

test('subsolar longitude moves west 15° an hour',()=>{
 const a=subsolarPoint(Date.UTC(2026,9,9,0)),b=subsolarPoint(Date.UTC(2026,9,9,6));
 near(((a.lon-b.lon)+360)%360,90,.1,'six hours');
});

test('timeline time interpolates frames, uses the snapshot when parked, and is null for history',()=>{
 const frames=[{validAt:0},{validAt:3*3600e3},{validAt:6*3600e3}];
 const line=(position,extra={})=>({kind:'forecast',position,atSnapshot:false,manifest:{frames,snapshotIndex:1},...extra});
 assert.equal(timelineTime(line(.5)),1.5*3600e3);
 assert.equal(timelineTime(line(2)),6*3600e3);
 assert.equal(timelineTime(line(1,{atSnapshot:true}),123),123);
 assert.equal(timelineTime(line(1,{kind:'history'})),null);
 assert.equal(timelineTime(null,99),99);
});
