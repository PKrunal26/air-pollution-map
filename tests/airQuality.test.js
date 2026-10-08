import test from 'node:test';
import assert from 'node:assert/strict';
import {airQualityUrl,parseAirQuality,fetchAirQuality} from '../src/airQuality.js';
const now=Date.UTC(2026,9,8,10,30);
const payload={latitude:28.6,longitude:77.2,current:{pm2_5:71,time:Date.UTC(2026,9,8,10)/1000},current_units:{pm2_5:'μg/m³',time:'unixtime'}};
test('uses a consistent global model and unambiguous UTC timestamps',()=>{
 const url=new URL(airQualityUrl({lat:51.51,lon:-.13}));
 assert.equal(url.searchParams.get('domains'),'cams_global');
 assert.equal(url.searchParams.get('current'),'pm2_5');
 assert.equal(url.searchParams.get('timeformat'),'unixtime');
 const data=parseAirQuality(payload,now);
 assert.equal(data.validAt,Date.UTC(2026,9,8,10));
 assert.equal(data.pm25,71);
 assert.equal(data.kind,'modeled');
 assert.deepEqual(data.grid,{lat:28.6,lon:77.2});
});
test('missing and invalid values never become a zero concentration',()=>{
 for(const value of [null,undefined,'71',NaN,-1]) assert.throws(()=>parseAirQuality({...payload,current:{...payload.current,pm2_5:value}},now));
 assert.equal(parseAirQuality({...payload,current:{...payload.current,pm2_5:0}},now).pm25,0);
 assert.throws(()=>parseAirQuality({...payload,current_units:{...payload.current_units,pm2_5:'mg/m³'}},now));
 assert.throws(()=>parseAirQuality({...payload,current:{...payload.current,time:now/1000+7200}},now));
 assert.throws(()=>airQualityUrl({lat:91,lon:0}));
});
test('unavailable services fail instead of returning fabricated data',async()=>{
 await assert.rejects(fetchAirQuality({lat:28.61,lon:77.21},{fetcher:async()=>({ok:false,status:429})}),/429/);
 await assert.rejects(fetchAirQuality({lat:28.61,lon:77.21},{fetcher:async()=>({ok:true,json:async()=>({})})}),/No valid/);
});
test('passes the abort signal through and preserves the source value',async()=>{
 const controller=new AbortController();
 const result=await fetchAirQuality({lat:28.61,lon:77.21},{signal:controller.signal,now:()=>now,fetcher:async(url,options)=>{
  assert.equal(options.signal,controller.signal);
  assert.equal(options.cache,'no-store');
  return {ok:true,json:async()=>payload};
 }});
 assert.equal(result.pm25,payload.current.pm2_5);
 assert.equal(result.fetchedAt,now);
});
