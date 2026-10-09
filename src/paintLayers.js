import catalog from './camsFields.json' with {type:'json'};
import {WEATHER_LAYERS} from './weather.js';
import {layerSpan} from './fieldStats.js';

// Fixed display ranges, never health categories or comparable doses.
export const PAINT_LAYERS=catalog.map(layer=>({...layer,rgb:[1,3,5].map(i=>parseInt(layer.colour.slice(i,i+2),16)/255)}));
export const LEGACY_FIELD_IDS=['pm2_5','nitrogen_dioxide','ozone','dust'];
export const GLOBAL_FIELD_IDS=PAINT_LAYERS.filter(l=>l.coverage==='global').map(l=>l.id);
export const EUROPE_FIELD_IDS=PAINT_LAYERS.filter(l=>!['aerosol_optical_depth','uv_index','uv_index_clear_sky'].includes(l.id)).map(l=>l.id);
export const layerUnit=l=>l.unit||(l.id==='aerosol_optical_depth'?'unitless':'index');
export const initialPaint=()=>Object.fromEntries(PAINT_LAYERS.map(p=>[p.id,{enabled:p.defaultEnabled,strength:p.defaultStrength}]));

// Commutative pigment absorption: checkbox order cannot change the mix.
// Only display weights are combined; concentrations are never summed.
export function mixPigments(samples,paint) {
 let total=0,absorption=[0,0,0];
 for(const layer of PAINT_LAYERS){
  const value=samples[layer.id],setting=paint[layer.id];
  if(!setting?.enabled||!Number.isFinite(value)||value<0)continue;
  const weight=Math.min(value/layer.range,1)*Math.max(0,Math.min(setting.strength/100,1));
  total+=weight;layer.rgb.forEach((c,i)=>{absorption[i]+=-Math.log(c)*weight;});
 }
 return {colour:absorption.map(a=>Math.exp(-a/Math.max(total,.0001))),opacity:1-Math.exp(-total*1.2)};
}

// Mapped span of a muted (near-uniform) layer, or null. scales: {global,regional} from fieldStats.scalesFor.
export const mutedSpan=(layer,scales)=>{const s=layerSpan(layer.id,scales?.global,scales?.regional);return s?.emphasis==='muted'?s:null;};
export const fmtSpan=v=>String(Number(v.toPrecision(v<10?2:3)));
// Rows for the on-map colour key: enabled air layers (0 → range+), then enabled weather layers.
export function keyRows(paint,weatherSettings={},scales={}) {
 const air=PAINT_LAYERS.filter(l=>paint?.[l.id]?.enabled).map(l=>{
  const s=mutedSpan(l,scales);
  return {id:l.id,label:l.label,name:l.name,colour:l.colour,hi:s?`${fmtSpan(s.floor)}–${fmtSpan(s.ceiling)} ${layerUnit(l)}`:`${l.range}+ ${layerUnit(l)}`,europe:l.coverage==='europe',muted:!!s};
 });
 const weather=WEATHER_LAYERS.filter(l=>weatherSettings?.[l.id]?.enabled).map(l=>({id:l.id,label:l.label,name:l.name,colour:l.colour,hi:l.hi,weather:true}));
 return [...air,...weather];
}
