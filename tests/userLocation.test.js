import test from 'node:test';
import assert from 'node:assert/strict';
import {HOME_FALLBACK,LOCATE_OPTIONS,REGION_URL,guessRegion,homePoint,locateUser,locationMessage,locationPermission} from '../src/userLocation.js';

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

test('guesses a rough region from the IP lookup',async()=>{
 const reply=(body,ok=true)=>async url=>{assert.equal(url,REGION_URL);return {ok,json:async()=>body};};
 assert.deepEqual(await guessRegion(reply({latitude:'12.9753',longitude:'77.591',city:'Bengaluru'})),{lat:12.9753,lon:77.591});
 assert.equal(await guessRegion(reply({latitude:'nil',longitude:'77.5'})),null);
 assert.equal(await guessRegion(reply({city:'Nowhere'})),null);
 assert.equal(await guessRegion(reply({latitude:'95',longitude:'0'})),null);
 assert.equal(await guessRegion(reply({},false)),null);
 assert.equal(await guessRegion(async()=>{throw new TypeError('offline');}),null);
});

test('always asks for a fresh fix, never a cached one',async()=>{
 let seen;await locateUser({getCurrentPosition:(ok,fail,options)=>{seen=options;ok({coords:{latitude:12.97,longitude:77.59}});}});
 assert.equal(seen,LOCATE_OPTIONS);assert.equal(seen.maximumAge,0);
});

test('home is the exact spot when known, else the IP region, else the default view',()=>{
 const exact={lat:12.97,lon:77.59,accuracy:40},region={lat:13,lon:77.6};
 assert.deepEqual(homePoint(exact,region),{lat:12.97,lon:77.59});
 assert.deepEqual(homePoint(null,region),{lat:13,lon:77.6});
 assert.deepEqual(homePoint(null,null),HOME_FALLBACK);
});
