// Private stats snapshot for the "Air Atlas Visitors" dashboard artifact: writes four JSON row files into a folder.
// Usage: GOATCOUNTER_KEY=<read-only key> node scripts/stats-snapshot.mjs <out-dir>
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {RANGES,createClient,loadDashboard,loadZone} from '../src/stats/api.js';
import {summarizeEvents} from '../src/stats/events.js';

const key=process.env.GOATCOUNTER_KEY,out=process.argv[2];
if(!key||!out){console.error('Usage: GOATCOUNTER_KEY=<key with "Read statistics"> node scripts/stats-snapshot.mjs <out-dir>');process.exit(1);}
const client=createClient({key}),zone=await loadZone(client,{strict:true}),now=new Date();
const summary=[],breakdowns=[],actions=[];let daily=[];
const DIMENSIONS=[['pages','Pages'],['toprefs','Referrers'],['locations','Countries'],['sizes','Screens'],['systems','Systems'],['browsers','Browsers']];
for(const {id:range} of RANGES){
 const d=await loadDashboard(client,range,now,zone),e=summarizeEvents(d.events);
 summary.push({range,visitors:d.visitors,shared_location:e.onOpen.allowed,refused_location:e.onOpen.refused,new_visitors:e.visits.new,returning_visitors:e.visits.returning,as_of:now.toISOString(),zone});
 for(const [field,dimension] of DIMENSIONS)for(const row of d[field])breakdowns.push({key:`${range}|${dimension}|${row.title||row.name}`,range,dimension,name:row.title||row.name,visitors:row.count});
 const groups=[['Location button',e.button],['Layers turned on',e.layers],['Places searched',e.search],
  ['Time and readings',[...e.time,...(e.pins?[{label:'Tapped the globe for a reading',count:e.pins}]:[]),...e.other]]];
 for(const [group,rows] of groups)for(const row of rows)actions.push({key:`${range}|${group}|${row.label}`,range,group,name:row.label,visitors:row.count});
 if(range==='90d')daily=d.series.map(p=>({day:p.day,visitors:p.value}));
}
mkdirSync(out,{recursive:true});
for(const [name,rows] of Object.entries({summary,daily,breakdowns,actions}))writeFileSync(join(out,`${name}.json`),JSON.stringify(rows));
console.log(JSON.stringify({zone,generatedAt:now.toISOString(),rows:{summary:summary.length,daily:daily.length,breakdowns:breakdowns.length,actions:actions.length}}));
