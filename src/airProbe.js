import {PAINT_LAYERS} from './paintLayers.js';
import {gridBounds,sampleField} from './sphereSampling.js';

export function pointToLocation(point){
 const radius=Math.hypot(point.x,point.y,point.z);
 if(!Number.isFinite(radius)||radius===0)return null;
 return {lat:Math.asin(Math.max(-1,Math.min(1,point.y/radius)))*180/Math.PI,lon:Math.atan2(-point.z,point.x)*180/Math.PI};
}

export function sampleAirAt(global,regional,lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
 const bounds=regional?gridBounds(regional.grid):null;
 const inEurope=!!bounds&&lat>=bounds.south&&lat<=bounds.north&&lon>=bounds.west&&lon<=bounds.east;
 const useRegional=inEurope&&(!global||regional.validAt===global.validAt);
 const fields=PAINT_LAYERS.flatMap(layer=>{
  const source=useRegional&&regional.fields[layer.id]?regional:global?.fields[layer.id]?global:null;
  if(!source)return [];
  const value=sampleField(source,layer.id,lat,lon);
  return Number.isFinite(value)&&value>=0?[{...layer,value,source:source.domain}]:[];
 });
 if(!fields.length)return null;
 return {lat,lon,validAt:(global??regional).validAt,regional:useRegional,fields};
}

const valueFormat=new Intl.NumberFormat('en-GB',{maximumFractionDigits:2});
export function formatAirValue(value){
 return value>0&&value<.01?'<0.01':valueFormat.format(value);
}
export function formatCoordinates(lat,lon){
 return `${Math.abs(lat).toFixed(2)}° ${lat<0?'S':'N'} · ${Math.abs(lon).toFixed(2)}° ${lon<0?'W':'E'}`;
}

// WHO 2021 Air Quality Guidelines (24-hour; ozone is the 8-hour peak-season level), in µg/m³. CO is 4 mg/m³.
// Context for single model values, not a health index.
export const WHO_GUIDELINES={
 pm2_5:{level:15,basis:'24-h'},
 pm10:{level:45,basis:'24-h'},
 nitrogen_dioxide:{level:25,basis:'24-h'},
 ozone:{level:100,basis:'8-h'},
 sulphur_dioxide:{level:40,basis:'24-h'},
 carbon_monoxide:{level:4000,basis:'24-h'},
};
export const WHO_CAPTION='Compared with WHO 2021 24-hour guideline levels; a single hourly model value, not a daily average.';
export function whoTone(ratio){return ratio<=1?'ok':ratio<=2?'warn':'high';}
export function formatWhoRatio(ratio){
 if(ratio>0&&ratio<.1)return '<0.1';
 return ratio>=10?String(Math.round(ratio)):ratio.toFixed(1);
}
// Returns null when there is no guideline or the value/unit is not comparable.
export function whoComparison(id,value,unit='μg/m³'){
 const guide=WHO_GUIDELINES[id];
 if(!guide||!Number.isFinite(value)||value<0||unit!=='μg/m³')return null;
 const ratio=value/guide.level;
 return {ratio,tone:whoTone(ratio),basis:guide.basis,level:guide.level,text:`×${formatWhoRatio(ratio)}`,label:`WHO ${guide.basis}`};
}
