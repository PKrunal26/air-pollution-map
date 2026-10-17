// Turns the event names public/count.js sends (e.g. "layer/pm2_5") into labelled groups for the dashboard.
import catalog from '../camsFields.json' with {type:'json'};
import {WEATHER_LAYERS} from '../weather.js';

const LAYER_NAMES=new Map([...catalog.map(l=>[l.id,l.name]),...WEATHER_LAYERS.map(l=>[l.id,l.name])]);
const TIME={'time/play-forecast':'Played the 48-hour forecast','time/play-history':'Played the monthly history','time/history':'Opened History','time/forecast':'Opened Today (48-hour forecast)'};
const BUTTON={'location/found':'Found','location/failed-1':'Blocked','location/failed-2':'Unavailable','location/failed-3':'Timed out','location/failed-unsupported':'Not supported'};
const byCount=(a,b)=>b.count-a.count||a.label.localeCompare(b.label);

export function summarizeEvents(events){
 const out={visits:{new:0,returning:0},onOpen:{allowed:0,refused:0},button:[],layers:[],time:[],search:[],pins:0,other:[]};
 for(const {name,count} of events??[]){
  const [group,...rest]=String(name).split('/'),id=rest.join('/');
  if(name==='visit/new')out.visits.new+=count;
  else if(name==='visit/returning')out.visits.returning+=count;
  else if(name==='location/allowed-on-open')out.onOpen.allowed+=count;
  else if(name==='location/refused-on-open')out.onOpen.refused+=count;
  else if(group==='location')out.button.push({label:BUTTON[name]??'Failed',count});
  else if(group==='layer'||group==='weather')out.layers.push({label:LAYER_NAMES.get(id)??id,count});
  else if(group==='time')out.time.push({label:TIME[name]??name,count});
  else if(group==='search')out.search.push({label:id==='coordinates'?'Typed coordinates':id,count});
  else if(name==='readout/pin')out.pins+=count;
  else out.other.push({label:name,count});
 }
 for(const key of ['button','layers','time','search','other'])out[key].sort(byCount);
 return out;
}

// Share allowed among visitors who answered the first-visit prompt; null until anyone has answered.
export function allowRate({allowed,refused}){const n=allowed+refused;return n?allowed/n:null;}

// Share of identified visitors who came back on a later day; null until any visit has been identified.
export function returningRate({new:fresh,returning}){const n=fresh+returning;return n?returning/n:null;}
