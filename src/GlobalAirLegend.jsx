import React,{useEffect,useState} from 'react';
import {SlidersHorizontal,X} from '@phosphor-icons/react';
import {PAINT_LAYERS} from './paintLayers';
import {WEATHER_LAYERS} from './weather';
const format=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
function LayerRow({layer,setting,available,onChange,slidersOpen,weather=false}){
 return <div className={`paint-row pigment-${layer.id}${setting.enabled?' is-on':''}`} style={{'--pigment':layer.colour,'--strength':`${setting.strength}%`}}>
  <div className="paint-row-top"><button aria-label={`Toggle ${layer.name} layer`} aria-pressed={setting.enabled} disabled={!available} onClick={()=>onChange(layer.id,{enabled:!setting.enabled})}><span className="paint-swatch" aria-hidden="true"/><span>{layer.label}</span></button><span className="paint-scale">{weather?layer.scale:<>0 — {layer.range}+ <small>µg/m³</small></>}</span></div>
  {weather&&setting.enabled&&layer.id!=='wind'&&<div className={`weather-key key-${layer.id}`} aria-label={layer.id==='temperature'?'Blue is cold; coral is hot':'Dark teal is dry; mint is humid'}/>}
  {slidersOpen&&<label className="paint-strength"><span>Strength</span><input type="range" min="0" max="100" step="5" value={setting.strength} disabled={!available||!setting.enabled} aria-label={`${layer.name} ${weather?'display':'paint'} strength`} onChange={e=>onChange(layer.id,{strength:Number(e.target.value)})}/><output>{setting.strength}%</output></label>}
 </div>;
}
export default function GlobalAirLegend({state,paint,onChange,detail,regional,weather,weatherSettings,onWeatherChange}) {
 const data=state.data;
 const [slidersOpen,setSlidersOpen]=useState(true),[panelOpen,setPanelOpen]=useState(()=>!window.matchMedia('(max-width:600px)').matches);
 useEffect(()=>{const close=e=>{if(e.key==='Escape')setPanelOpen(false);};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);},[]);
 const active=Object.values(paint).filter(s=>s.enabled).length+Object.values(weatherSettings).filter(s=>s.enabled).length;
 return <>
  <button className="layers-launcher" aria-controls="layer-controls" aria-expanded={panelOpen} onClick={()=>setPanelOpen(open=>!open)}><SlidersHorizontal size={17}/><span>{panelOpen?'Close layers':`Layers · ${active} on`}</span></button>
  <section id="layer-controls" className={`paint-palette${slidersOpen?'':' sliders-collapsed'}${panelOpen?' panel-open':' panel-closed'}`} aria-label="Map layers" inert={!panelOpen?true:undefined}>
  <div className="paint-heading"><span>Atmosphere</span><button className="paint-collapse" aria-expanded={slidersOpen} aria-label={slidersOpen?'Collapse all sliders':'Expand all sliders'} onClick={()=>setSlidersOpen(open=>!open)}><SlidersHorizontal size={15} weight="light"/><span>{slidersOpen?'Hide sliders':'Show sliders'}</span></button><button className="layers-close" aria-label="Close layer panel" onClick={()=>setPanelOpen(false)}><X size={18}/></button></div>
  <div className="layer-grid">{PAINT_LAYERS.map(layer=><LayerRow key={layer.id} layer={layer} setting={paint[layer.id]} available={!!data} onChange={onChange} slidersOpen={slidersOpen}/>)}</div>
  {data?<><p className="paint-meta">Modeled · {format.format(new Date(data.validAt))} UTC</p><p className="paint-note">{detail==='regional'?'Europe · ~11 km · regional model':`Global · ~45 km · ${detail==='overview'?'overview':detail==='medium'?'more detail':'native detail'}`}</p>{regional&&<p className="paint-note">Zoom reveals ~11 km detail over Europe</p>}</>:<p className="paint-meta" role="status">{state.status==='error'?'Global layers unavailable':'Loading global layers…'}</p>}
  <div className="weather-heading">Weather</div>
  <div className="layer-grid">{WEATHER_LAYERS.map(layer=><LayerRow key={layer.id} weather layer={layer} setting={weatherSettings[layer.id]} available={!!weather?.data} onChange={onWeatherChange} slidersOpen={slidersOpen}/>)}</div>
  {weather?.data?<><p className="paint-meta"><a href="https://open-meteo.com/en/docs/ecmwf-api" target="_blank" rel="noreferrer">ECMWF IFS / Open-Meteo</a> · ~28 km</p><p className="paint-note">{format.format(new Date(weather.data.validAt))} UTC · model snapshot</p><details className="weather-evidence"><summary>About the weather layers</summary><p className="paint-note">Temperature & humidity at 2 m; wind at 10 m. Wind animation shows a frozen field, not pollutant trajectories or elapsed real time. Colours mix for display only.</p><p className="paint-note">Weather data: <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></p></details></>:<p className="paint-meta" role="status">{weather?.status==='error'?'Weather layers unavailable':'Loading weather layers…'}</p>}
  <button className="layers-clear" onClick={()=>{PAINT_LAYERS.forEach(l=>onChange(l.id,{enabled:false}));WEATHER_LAYERS.forEach(l=>onWeatherChange(l.id,{enabled:false}));}}>Turn all layers off</button>
 </section></>;
}
