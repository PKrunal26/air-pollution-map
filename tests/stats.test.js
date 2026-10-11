import test from 'node:test';
import assert from 'node:assert/strict';
import {StatsError,createClient,dailySeries,detailRows,loadDashboard,rangeBounds,zoneFromSetting} from '../src/stats/api.js';
import {allowRate,returningRate,summarizeEvents} from '../src/stats/events.js';

const NOW=new Date('2026-10-11T14:25:00Z');
const json=(status,body={})=>({status,ok:status>=200&&status<300,json:async()=>body});
const instant={spacing:0,sleep:async()=>{}};

test('range covers whole days in the account zone, end on the next hour',()=>{
 const ist=rangeBounds('7d',new Date('2026-10-10T21:00:00Z'),'Asia/Kolkata');
 assert.equal(ist.start,'2026-10-04T18:30:00Z');assert.deepEqual([ist.days[0],ist.days.at(-1)],['2026-10-05','2026-10-11']);
 const r=rangeBounds('7d',NOW);
 assert.equal(r.start,'2026-10-05T00:00:00Z');assert.equal(r.end,'2026-10-11T15:00:00Z');
 assert.deepEqual([r.days[0],r.days.at(-1),r.days.length],['2026-10-05','2026-10-11',7]);
 assert.equal(rangeBounds('nope',NOW).days.length,7);
 assert.equal(rangeBounds('90d',NOW).days.length,90);
});

test('daily series fills missing days with zero',()=>{
 assert.deepEqual(dailySeries([{day:'2026-10-06',daily:4}],['2026-10-05','2026-10-06']),[{day:'2026-10-05',value:0},{day:'2026-10-06',value:4}]);
 assert.deepEqual(dailySeries(undefined,['2026-10-05']),[{day:'2026-10-05',value:0}]);
});

test('client sends the key, retries 429 and maps auth errors',async()=>{
 const seen=[];let calls=0;
 const client=createClient({key:'k1',...instant,fetchImpl:async(url,opts)=>{seen.push([url,opts.headers.Authorization]);calls++;return calls===1?json(429):json(200,{ok:1});}});
 assert.deepEqual(await client.get('stats/total',{start:'a'}),{ok:1});
 assert.equal(seen[0][0],'https://krunalp.goatcounter.com/api/v0/stats/total?start=a');assert.equal(seen[0][1],'Bearer k1');assert.equal(calls,2);
 for(const [status,code] of [[401,'auth'],[403,'permission'],[500,'http']]){
  const c=createClient({key:'k',...instant,fetchImpl:async()=>json(status)});
  await assert.rejects(c.get('x'),e=>e instanceof StatsError&&e.code===code);
 }
 await assert.rejects(createClient({key:'k',...instant,fetchImpl:async()=>{throw new TypeError('offline');}}).get('x'),{code:'network'});
});

test('dashboard splits pages from events and reads the detail lists',async()=>{
 const replies={
  'stats/total':{total:12,stats:[{day:'2026-10-11',daily:9}]},
  'stats/hits':{hits:[{path:'/air-pollution-map/',path_id:11,title:'Who Owns the Air?',count:10,event:false},{path:'study.html',path_id:12,title:'Study',count:2,event:false},{path:'layer/pm2_5',path_id:13,count:3,event:true}]},
  'stats/locations':{stats:[{name:'India',count:7},{name:'',count:1}]},
 };
 const asked=[],client={get:async(path,params)=>{asked.push([path,params?.include_paths]);return replies[path]??{stats:[]};}};
 const d=await loadDashboard(client,'7d',NOW);
 assert.deepEqual(asked.find(([p])=>p==='stats/total')[1],'11,12');assert.equal(asked.find(([p])=>p==='stats/locations')[1],'11,12');
 assert.equal((await loadDashboard({get:async()=>({hits:[]})},'7d',NOW)).visitors,0);
 assert.equal(d.visitors,12);assert.equal(d.series.at(-1).value,9);assert.equal(d.series.length,7);
 assert.deepEqual(d.pages,[{name:'/air-pollution-map/',title:'Who Owns the Air?',count:10},{name:'study.html',title:'Study',count:2}]);
 assert.deepEqual(d.events,[{name:'layer/pm2_5',count:3}]);
 assert.deepEqual(d.locations,[{name:'India',count:7},{name:'Unknown',count:1}]);assert.equal(d.zone,'UTC');
 assert.deepEqual(d.toprefs,[]);
});

test('events are grouped and named',()=>{
 const s=summarizeEvents([
  {name:'location/allowed-on-open',count:6},{name:'location/refused-on-open',count:2},{name:'location/failed-1',count:1},{name:'location/found',count:4},
  {name:'layer/pm2_5',count:5},{name:'weather/wind',count:1},{name:'layer/mystery',count:2},
  {name:'time/play-forecast',count:3},{name:'search/Berlin',count:2},{name:'search/coordinates',count:1},{name:'readout/pin',count:7},{name:'odd',count:1},
 ]);
 assert.deepEqual(s.onOpen,{allowed:6,refused:2});assert.equal(allowRate(s.onOpen),.75);assert.equal(allowRate({allowed:0,refused:0}),null);
 assert.deepEqual(s.button,[{label:'Found',count:4},{label:'Blocked',count:1}]);
 assert.deepEqual(s.layers.map(l=>l.label),['Fine particles','mystery','Wind']);
 assert.deepEqual(s.time,[{label:'Played the 48-hour forecast',count:3}]);
 assert.deepEqual(s.search,[{label:'Berlin',count:2},{label:'Typed coordinates',count:1}]);
 assert.equal(s.pins,7);assert.deepEqual(s.other,[{label:'odd',count:1}]);
});

test('zone setting and empty detail names',()=>{
 assert.equal(zoneFromSetting('IN.Asia/Kolkata'),'Asia/Kolkata');assert.equal(zoneFromSetting('Nope/Zone'),'UTC');assert.equal(zoneFromSetting(undefined),'UTC');
 assert.deepEqual(detailRows('sizes',[{id:'phone',name:'',count:5},{id:'tablet',name:'',count:0}]),[{name:'Phones',count:5}]);
 assert.deepEqual(detailRows('toprefs',[{name:'',count:9},{name:'www.reddit.com',count:2}]),[{name:'Direct or unknown',count:9},{name:'www.reddit.com',count:2}]);
});

test('new and returning visits are counted apart and kept out of the feature lists',()=>{
 const s=summarizeEvents([{name:'visit/new',count:9},{name:'visit/returning',count:3},{name:'readout/pin',count:1}]);
 assert.deepEqual(s.visits,{new:9,returning:3});assert.deepEqual(s.other,[]);assert.equal(returningRate(s.visits),.25);assert.equal(returningRate({new:0,returning:0}),null);
});
