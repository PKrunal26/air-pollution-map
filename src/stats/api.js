// GoatCounter API client for the private stats snapshot (scripts/stats-snapshot.mjs). Needs a read-only key.
export const SITE='krunalp';
export const RANGES=[{id:'7d',label:'7 days',days:7},{id:'30d',label:'30 days',days:30},{id:'90d',label:'90 days',days:90}];
export const DETAIL_PAGES=['toprefs','locations','browsers','systems','sizes'];
const DAY=864e5,iso=d=>d.toISOString().replace(/\.\d{3}Z$/,'Z');
const SIZE_NAMES={phone:'Phones',tablet:'Tablets',desktop:'Computers',desktophd:'Large screens',unknown:'Unknown'};

// GoatCounter stores days in the account's time zone ("IN.Asia/Kolkata" in its settings); anything unusable means UTC.
export function zoneFromSetting(setting){
 const zone=String(setting||'').includes('.')?String(setting).slice(String(setting).indexOf('.')+1):String(setting||'');
 try{new Intl.DateTimeFormat('en',{timeZone:zone});return zone||'UTC';}catch{return 'UTC';}
}
function zoneParts(t,zone){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
 return {y:+p.year,m:+p.month,d:+p.day,h:+p.hour,min:+p.minute,s:+p.second};
}
const offset=(t,zone)=>{const p=zoneParts(t,zone);return Date.UTC(p.y,p.m-1,p.d,p.h,p.min,p.s)-Math.floor(t/1000)*1000;};
// UTC instant of midnight on a calendar day in the zone (second pass settles DST changes).
function zonedMidnight(y,m,d,zone){const guess=Date.UTC(y,m,d);let t=guess-offset(guess,zone);return guess-offset(t,zone);}
const pad=n=>String(n).padStart(2,'0');

// Whole days in the account's zone ending today; end is the next full hour so the current hour counts.
export function rangeBounds(id,now=new Date(),zone='UTC'){
 const range=RANGES.find(r=>r.id===id)??RANGES[0],today=zoneParts(now.getTime(),zone);
 const days=Array.from({length:range.days},(_,i)=>{const d=new Date(Date.UTC(today.y,today.m-1,today.d)-(range.days-1-i)*DAY);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;});
 const [y,m,d]=days[0].split('-').map(Number);
 return {start:iso(new Date(zonedMidnight(y,m-1,d,zone))),end:iso(new Date(Math.ceil((now.getTime()+1)/36e5)*36e5)),days};
}

// One point per day of the range; days the API leaves out count as zero.
export function dailySeries(stats,days){
 const byDay=new Map((stats??[]).map(s=>[s.day,Number(s.daily)||0]));
 return days.map(day=>({day,value:byDay.get(day)??0}));
}

export class StatsError extends Error{constructor(code,message){super(message);this.code=code;}}
const MESSAGES={
 auth:'GoatCounter did not accept this key. Check it was copied in full, or create a new one.',
 permission:'This key cannot read statistics. Create a key with “Read statistics” ticked.',
 rate:'GoatCounter is rate-limiting requests. Wait a few seconds and refresh.',
 network:'Your browser could not reach goatcounter.com. An ad or tracker blocker usually causes this: allow goatcounter.com on this page, then refresh.',
 http:'GoatCounter returned an error. Refresh to try again.',
};
export const errorMessage=error=>MESSAGES[error?.code]??MESSAGES.http;

// Requests run one at a time with a gap, staying under GoatCounter's 4 requests per second; 429s back off and retry.
export function createClient({key,site=SITE,fetchImpl=(...a)=>fetch(...a),spacing=300,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 let queue=Promise.resolve();
 async function once(path,params,attempt=0){
  let res;
  try{res=await fetchImpl(`https://${site}.goatcounter.com/api/v0/${path}?${new URLSearchParams(params)}`,{headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'}});}
  catch{throw new StatsError('network',MESSAGES.network);}
  if(res.status===429&&attempt<3){await sleep(1000*(attempt+1));return once(path,params,attempt+1);}
  if(res.status===401)throw new StatsError('auth',MESSAGES.auth);
  if(res.status===403)throw new StatsError('permission',MESSAGES.permission);
  if(res.status===429)throw new StatsError('rate',MESSAGES.rate);
  if(!res.ok)throw new StatsError('http',MESSAGES.http);
  return res.json();
 }
 return {get(path,params={}){const run=queue.then(()=>once(path,params));queue=run.catch(()=>{}).then(()=>sleep(spacing));return run;}};
}

// Account time zone, read once per key; a key without access to it falls back to UTC. strict: fail instead, so a snapshot never mixes zones.
export async function loadZone(client,{strict=false}={}){try{return zoneFromSetting((await client.get('me'))?.user?.settings?.timezone);}catch(error){if(strict)throw error;return 'UTC';}}

// Detail rows: GoatCounter leaves some names empty (screen sizes, visits without a referrer).
export function detailRows(page,stats){
 return (stats??[]).filter(s=>s.count>0).map(s=>({name:s.name||(page==='sizes'?SIZE_NAMES[s.id]:page==='toprefs'?'Direct or unknown':'')||s.id||'Unknown',count:s.count}));
}

// GoatCounter's own totals add every page and event path's visitors together, so one person who turns on three layers
// counts four times. Visitors, countries and devices are therefore read for page paths only; events keep their own counts.
export async function loadDashboard(client,rangeId,now=new Date(),zone='UTC'){
 const {start,end,days}=rangeBounds(rangeId,now,zone),window={start,end};
 const list=(await client.get('stats/hits',{...window,limit:100}))?.hits??[],pages=list.filter(h=>!h.event);
 const scope=pages.length?{...window,include_paths:pages.map(h=>h.path_id).join(',')}:null;
 const [total,...details]=scope?await Promise.all([client.get('stats/total',scope),...DETAIL_PAGES.map(page=>client.get(`stats/${page}`,{...scope,limit:12}))]):[null];
 return {
  range:rangeId,loadedAt:now,days,zone,
  visitors:Number(total?.total)||0,
  series:dailySeries(total?.stats,days),
  pages:pages.map(h=>({name:h.path,title:h.title,count:h.count})),
  events:list.filter(h=>h.event).map(h=>({name:h.path,count:h.count})),
  ...Object.fromEntries(DETAIL_PAGES.map((page,i)=>[page,detailRows(page,details[i]?.stats)])),
 };
}
