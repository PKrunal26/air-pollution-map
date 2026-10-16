// Text shown on cards: the month line, the four front stats and the found date.
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const parse=m=>{const [y,mo]=m.split('-').map(Number);return {y,mo:mo-1};};
const whole=n=>Math.round(n).toLocaleString('en-US');

// 'June 2023'; 'Every November' when the card is every year's same month; otherwise a range.
export function monthLabel(months){
 const list=[...months].sort().map(parse),first=list[0],last=list.at(-1);
 if(list.length===1)return `${MONTHS[first.mo]} ${first.y}`;
 if(list.every(m=>m.mo===first.mo))return `Every ${MONTHS[first.mo]}`;
 if(first.y===last.y)return `${MONTHS[first.mo]} – ${MONTHS[last.mo]} ${last.y}`;
 return `${MONTHS[first.mo]} ${first.y} – ${MONTHS[last.mo]} ${last.y}`;
}

export function formatStats(stats){
 const area=stats.areaKm2.value,who=stats.whoX.value;
 return [
  {label:'Peak',value:whole(stats.peak.value),unit:'µg/m³'},
  {label:'× WHO',value:Number.isFinite(who)?`${who.toFixed(1)}×`:'–',unit:''},
  {label:'Area',value:area>=1e6?`${(area/1e6).toFixed(1)}M`:`${Math.round(area/1e3)}k`,unit:'km²'},
  {label:'Reach',value:whole(stats.reachKm.value),unit:'km'},
 ];
}

export function foundLabel(ms){
 if(!Number.isFinite(ms))return null;
 const d=new Date(ms);
 return `Found ${d.getUTCDate()} ${SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
