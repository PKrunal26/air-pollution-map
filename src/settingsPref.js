// Layer choices, strengths and surface, remembered per browser so a refresh keeps the view.
// Saved values are merged onto the defaults: layers added later get their defaults, unknown or malformed entries are dropped.
import {SURFACES} from './embedParams.js';
export const SETTINGS_KEY='air-atlas.settings';
const store=()=>{try{return globalThis.localStorage??null;}catch{return null;}};
// defaults and saved are {id:{enabled,strength}}.
export function mergeLayers(defaults,saved){
 if(!saved||typeof saved!=='object')return defaults;
 return Object.fromEntries(Object.entries(defaults).map(([id,base])=>{
  const s=saved[id];if(!s||typeof s!=='object')return [id,base];
  return [id,{...base,...(typeof s.enabled==='boolean'?{enabled:s.enabled}:{}),...(Number.isFinite(s.strength)?{strength:Math.max(0,Math.min(100,s.strength))}:{})}];
 }));
}
export function loadSettings(storage=store()){
 try{
  const saved=JSON.parse(storage?.getItem(SETTINGS_KEY)??'null');
  if(!saved||typeof saved!=='object')return null;
  return {paint:saved.paint??null,weather:saved.weather??null,surface:SURFACES.includes(saved.surface)?saved.surface:null};
 }catch{return null;}
}
export function saveSettings({paint,weather,surface},storage=store()){
 try{storage?.setItem(SETTINGS_KEY,JSON.stringify({paint,weather,surface}));}catch{}
}
