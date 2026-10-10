import test from 'node:test';
import assert from 'node:assert/strict';
import {ASKED_KEY,LOCATE_OPTIONS,locateUser,locationMessage,locationPermission,saveAsked,shouldAskOnOpen} from '../src/userLocation.js';

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

test('permission check never throws and reports unknown when the browser cannot say',async()=>{
 assert.equal(await locationPermission({query:async()=>({state:'granted'})}),'granted');
 assert.equal(await locationPermission({query:async()=>({state:'prompt'})}),'prompt');
 assert.equal(await locationPermission({query:async()=>{throw new Error('no');}}),'unknown');
 assert.equal(await locationPermission(undefined),'unknown');
});

test('asks on open only when never asked before',()=>{
 const m=new Map(),storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};
 assert.equal(shouldAskOnOpen('prompt',storage),true);
 assert.equal(shouldAskOnOpen('granted',storage),false);
 assert.equal(shouldAskOnOpen('denied',storage),false);
 assert.equal(shouldAskOnOpen('unknown',storage),true);
 saveAsked(storage);assert.equal(m.get(ASKED_KEY),'1');
 assert.equal(shouldAskOnOpen('unknown',storage),false);
 assert.equal(shouldAskOnOpen('unknown',{getItem:()=>{throw new Error('blocked');}}),false);
});

test('always asks for a fresh fix, never a cached one',async()=>{
 let seen;await locateUser({getCurrentPosition:(ok,fail,options)=>{seen=options;ok({coords:{latitude:12.97,longitude:77.59}});}});
 assert.equal(seen,LOCATE_OPTIONS);assert.equal(seen.maximumAge,0);
});
