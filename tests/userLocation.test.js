import test from 'node:test';
import assert from 'node:assert/strict';
import {locateUser,locationGranted,locationMessage} from '../src/userLocation.js';

const geo=result=>({getCurrentPosition:(ok,fail)=>result.error?fail(result.error):ok({coords:result.coords})});

test('resolves coordinates from the browser',async()=>{
 assert.deepEqual(await locateUser(geo({coords:{latitude:51.5,longitude:-0.12,accuracy:30}})),{lat:51.5,lon:-0.12,accuracy:30});
});

test('rejects with the browser error code, or unsupported without geolocation',async()=>{
 await assert.rejects(locateUser(geo({error:{code:1}})),{code:1});
 await assert.rejects(locateUser(geo({coords:{latitude:NaN,longitude:0}})),{code:2});
 await assert.rejects(locateUser(undefined),{code:'unsupported'});
});

test('each failure has a plain message',()=>{
 assert.match(locationMessage({code:1}),/blocked/);
 assert.match(locationMessage({code:3}),/too long/);
 assert.match(locationMessage({code:'unsupported'}),/cannot/);
 assert.match(locationMessage({code:2}),/unavailable/);
 assert.equal(locationMessage(null),'');
});

test('granted check never throws and is false unless granted',async()=>{
 assert.equal(await locationGranted({query:async()=>({state:'granted'})}),true);
 assert.equal(await locationGranted({query:async()=>({state:'prompt'})}),false);
 assert.equal(await locationGranted({query:async()=>{throw new Error('no');}}),false);
 assert.equal(await locationGranted(undefined),false);
});
