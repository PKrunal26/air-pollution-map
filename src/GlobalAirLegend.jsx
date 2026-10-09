import React,{useEffect,useMemo,useRef,useState} from 'react';
import {SlidersHorizontal,X,CaretDown,ArrowSquareOut,ArrowRight} from '@phosphor-icons/react';
import {PAINT_LAYERS,keyRows,layerUnit} from './paintLayers';
import {scalesFor} from './fieldStats';
import {WEATHER_LAYERS} from './weather';
import GlobeSurface from './GlobeSurface';
import './styles/panel.css';
const TABS=[['air','Air quality'],['weather','Weather']],GROUPS=['Atmospheric context','Trace gases & aerosols','Europe only'];
function useCompact(){
 const [compact,setCompact]=useState(()=>typeof matchMedia==='function'&&matchMedia('(max-width:700px)').matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return;const query=matchMedia('(max-width:700px)'),sync=()=>setCompact(query.matches);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync);},[]);
 return compact;
}
function EuropeHint({names,onShow}){
 return <div className="europe-hint" role="status"><p><strong>{names}</strong>: Europe only</p><button onClick={onShow}>Show Europe<ArrowRight size={13}/></button></div>;
}
function LayerRow({layer,setting,available,onChange,expanded,onExpand,weather=false}){
 const unit=layerUnit(layer);
 return <div className={`layer-row${setting.enabled?' is-on':''}`} style={{'--pigment':layer.colour,'--strength':`${setting.strength}%`}}>
  <div className="layer-line">
   <button className="layer-toggle" role="switch" aria-label={`Toggle ${layer.name} layer`} aria-checked={setting.enabled} disabled={!available} onClick={()=>onChange(layer.id,{enabled:!setting.enabled})}>
    <span className="paint-swatch" aria-hidden="true"/><span className="layer-label"><strong>{layer.name}</strong><small>{weather?layer.scale:`${layer.label} · ${unit}`}</small></span><span className="switch-track" aria-hidden="true"><span/></span>
   </button>
   <button className="layer-adjust" aria-label={`Adjust ${layer.name} intensity`} aria-expanded={expanded} disabled={!available||!setting.enabled} onClick={onExpand}><CaretDown size={14}/></button>
  </div>
  {expanded&&setting.enabled&&<div className="layer-settings">
   <label className="paint-strength"><span>Display intensity</span><output>{setting.strength}%</output><input type="range" min="0" max="100" step="5" value={setting.strength} aria-label={`${layer.name} display strength`} onChange={e=>onChange(layer.id,{strength:Number(e.target.value)})}/></label>
   {layer.id==='aerosol_optical_depth'&&<p className="layer-range">Whole atmospheric column at 550 nm.</p>}
   {layer.id==='pm10'&&<p className="layer-range">Includes fine particles; do not add to PM₂.₅.</p>}
   {layer.id==='dust'&&<p className="layer-range">Overlaps particulate matter.</p>}
   {weather&&layer.id!=='wind'&&<div className={`weather-key key-${layer.id}`}/>}
  </div>}
 </div>;
}
export default function GlobalAirLegend({surface,onSurfaceChange,panelOpen,onPanelChange,onFlyTo,state,paint,onChange,detail,regional,regionalError,weather,weatherSettings,onWeatherChange}){
 const [tab,setTab]=useState('air'),[expanded,setExpanded]=useState(null);
 const compact=useCompact(),launcher=useRef(null);
 const groupActive=group=>PAINT_LAYERS.filter(l=>l.group===group&&paint[l.id]?.enabled).length;
 const [openGroups,setOpenGroups]=useState(()=>new Set(GROUPS.filter(groupActive)));
 const seen=useRef(Object.fromEntries(GROUPS.map(g=>[g,groupActive(g)])));
 const counts=GROUPS.map(groupActive).join();
 useEffect(()=>{
  const grown=GROUPS.filter(g=>groupActive(g)>seen.current[g]);
  GROUPS.forEach(g=>{seen.current[g]=groupActive(g);});
  if(grown.length)setOpenGroups(current=>new Set([...current,...grown]));
 },[counts]);
 const scales=useMemo(()=>{const global=scalesFor(state.data,PAINT_LAYERS);return {global,regional:scalesFor(regional,PAINT_LAYERS,global)};},[state.data,regional]);
 const rows=keyRows(paint,weatherSettings,scales),active=rows.length;
 const europeRows=rows.filter(r=>r.europe),europeNames=europeRows.map(r=>r.label).join(', ');
 const showHint=!!europeNames&&detail!=='regional'&&!!onFlyTo;
 const showEurope=()=>{onFlyTo?.(50,10);if(compact)onPanelChange(false);};
 const close=()=>{onPanelChange(false);launcher.current?.focus();};
 useEffect(()=>{const escape=e=>{if(e.key==='Escape'&&panelOpen){onPanelChange(false);launcher.current?.focus();}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[panelOpen,onPanelChange]);
 const moveTab=(e,id)=>{
  const ids=TABS.map(t=>t[0]),i=ids.indexOf(id),next={ArrowRight:ids[(i+1)%ids.length],ArrowLeft:ids[(i-1+ids.length)%ids.length],Home:ids[0],End:ids[ids.length-1]}[e.key];
  if(!next)return;e.preventDefault();setTab(next);document.getElementById(`tab-${next}`)?.focus();
 };
 const row=(layer,weatherRow=false)=><LayerRow key={layer.id} layer={layer} setting={(weatherRow?weatherSettings:paint)[layer.id]} available={weatherRow?!!weather.data:!!(state.data?.fields[layer.id]||regional?.fields[layer.id])} weather={weatherRow} onChange={weatherRow?onWeatherChange:onChange} expanded={expanded===layer.id} onExpand={()=>setExpanded(current=>current===layer.id?null:layer.id)}/>;
 return <>
  <button ref={launcher} className={`layers-launcher${panelOpen?' is-open':''}`} aria-controls="layer-controls" aria-expanded={panelOpen} onClick={()=>onPanelChange(!panelOpen)}><span className="launcher-icon">{panelOpen?<X size={17} weight="light"/>:<SlidersHorizontal size={17} weight="light"/>}</span><span>{panelOpen?'Hide layers':'Explore layers'}</span><small aria-label={`${active} active`}>{active}</small></button>
  <aside id="layer-controls" className={`layer-panel${panelOpen?' is-open':''}`} aria-label="Map layers" inert={!panelOpen?true:undefined}>
   <div className="layer-panel-heading"><h2>The atmosphere</h2><button className="layer-clear" disabled={!active} onClick={()=>{PAINT_LAYERS.forEach(l=>onChange(l.id,{enabled:false}));WEATHER_LAYERS.forEach(l=>onWeatherChange(l.id,{enabled:false}));}}>Clear</button><button className="icon-button" aria-label="Close layer panel" onClick={close}><X size={18} weight="light"/></button></div>
   <div className="layer-tabs" role="tablist" aria-label="Layer categories">{TABS.map(([id,label])=><button key={id} id={`tab-${id}`} role="tab" aria-selected={tab===id} aria-controls={`panel-${id}`} tabIndex={tab===id?0:-1} onClick={()=>setTab(id)} onKeyDown={e=>moveTab(e,id)}>{label}</button>)}</div>
   <div className="layer-scroll scroll-fade" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
    {tab==='air'?<>
     {state.status==='loading'&&<p className="data-status" role="status">Loading CAMS fields…</p>}
     {state.status==='error'&&<p className="data-status" role="status">Global fields unavailable. Reload to retry.</p>}
     {showHint&&panelOpen&&<EuropeHint names={europeNames} onShow={showEurope}/>}
     <div className="layer-group">{PAINT_LAYERS.filter(l=>l.group==='Pollutants').map(l=>row(l))}</div>
     {GROUPS.map(group=>{const on=groupActive(group),total=PAINT_LAYERS.filter(l=>l.group===group).length;return <details className={`layer-group-more${on?' has-active':''}`} key={group} open={openGroups.has(group)} onToggle={e=>{const open=e.currentTarget.open;setOpenGroups(current=>{if(current.has(group)===open)return current;const next=new Set(current);open?next.add(group):next.delete(group);return next;});}}><summary>{group}<span>{on>0&&<em className="group-active">{on} on</em>}<b>{total}</b><CaretDown size={13}/></span></summary>{group==='Europe only'&&!regional&&<p className="data-status" role="status">{regionalError?'European fields unavailable. Reload to retry.':'Loading European fields…'}</p>}{group==='Europe only'&&<p className="coverage-note">Pollen may be zero outside its season.</p>}{PAINT_LAYERS.filter(l=>l.group===group).map(l=>row(l))}</details>;})}
    </>:<>
     {WEATHER_LAYERS.map(l=>row(l,true))}
     {!weather.data&&<p className="data-status" role="status">{weather.status==='error'?'Weather unavailable. Reload to retry.':'Loading weather…'}</p>}
    </>}
   </div>
   <footer className="layer-footer">
    <p><a href={tab==='air'?'https://open-meteo.com/en/docs/air-quality-api':'https://open-meteo.com/en/docs/ecmwf-api'} target="_blank" rel="noreferrer">{tab==='air'?'CAMS':'ECMWF'} via Open-Meteo<ArrowSquareOut size={11}/></a></p>
    <div className="layer-footer-actions"><GlobeSurface value={surface} onChange={onSurfaceChange}/></div>
   </footer>
  </aside>
 </>;
}
