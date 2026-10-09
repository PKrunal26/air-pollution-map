import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MagnifyingGlass,Plus,Minus,X,Info} from '@phosphor-icons/react';
import Globe from './Globe';
import {places as cities} from './places';
import AirQuality from './AirReadout.jsx';
import {AIR_SOURCE} from './airQuality';
import './styles.css';
import {fetchNativeLayers,fetchEuropeLayers} from './globalAir';
import {initialPaint} from './paintLayers';
import GlobalAirLegend from './GlobalAirLegend';
import GlobeSurface from './GlobeSurface';
function App(){
 const [surface,setSurface]=useState('charcoal');
 const [regionalAir,setRegionalAir]=useState(null),[detail,setDetail]=useState('overview');
 useEffect(()=>{const controller=new AbortController();fetchEuropeLayers(controller.signal).then(setRegionalAir).catch(()=>{});return()=>controller.abort();},[]);
 const [globalAir,setGlobalAir]=useState({status:'loading',data:null}),[paint,setPaint]=useState(initialPaint);
 useEffect(()=>{const controller=new AbortController();fetchNativeLayers(controller.signal).then(data=>setGlobalAir({status:'ready',data})).catch(e=>{if(e.name!=='AbortError')setGlobalAir({status:'error',data:null});});return()=>controller.abort();},[]);
 const [city,setCity]=useState(null),[zoom,setZoom]=useState(0),[focus,setFocus]=useState(0),[query,setQuery]=useState(''),[search,setSearch]=useState(false),[about,setAbout]=useState(false);
 const aboutButton=useRef(null),closeButton=useRef(null);
 const chooseCity=c=>{setCity(c);setZoom(1);setFocus(f=>f+1);setSearch(false);setQuery('');};
 const results=cities.filter(c=>(c.name+' '+c.country).toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{const escape=e=>{if(e.key==='Escape'){setSearch(false);setAbout(false);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 useEffect(()=>{
  if(!about)return;
  const previous=document.activeElement;
  const dialog=document.querySelector('[role=dialog]');
  closeButton.current?.focus();
  const trap=e=>{if(e.key!=='Tab')return;const items=[...dialog.querySelectorAll('button,a[href]')];const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
  dialog.addEventListener('keydown',trap);
  return()=>{dialog.removeEventListener('keydown',trap);previous?.focus();};
 },[about]);
 return <main className={`atlas-app minimal-atlas surface-view-${surface}`}>
  <Globe clean surface={surface} globalAir={globalAir.data} regionalAir={regionalAir} onDetail={setDetail} paint={paint} city={city} active={[]} selected={null} mode="terrain" zoom={zoom} focus={focus} year={2024} month={0} scenario={0} onCity={chooseCity}/>
  <header className="minimal-header"><h1>Who owns the air?</h1><button ref={aboutButton} aria-label="About this version" onClick={()=>setAbout(true)}><Info size={19} weight="light"/></button></header>
  <div className="minimal-search"><div className="search-input"><MagnifyingGlass size={17}/><input aria-label="Search cities" placeholder="Find a place" value={query} onFocus={()=>setSearch(true)} onChange={e=>{setQuery(e.target.value);setSearch(true);}} onKeyDown={e=>{if(e.key==='Enter'&&results[0])chooseCity(results[0]);}}/></div>
   {search&&<div className="search-results"><div className="results-heading">PLACES<button aria-label="Close search" onClick={()=>setSearch(false)}><X size={16}/></button></div>{results.map(c=><button className="search-result" key={c.id} onClick={()=>chooseCity(c)}><span>{c.name}<small>{c.country}</small></span></button>)}{!results.length&&<p className="empty-search">Try London, Lagos or Beijing.</p>}</div>}
  </div>
  <GlobeSurface value={surface} onChange={setSurface}/>
  {city&&<AirQuality city={city} onClear={()=>setCity(null)}/>}
  <GlobalAirLegend detail={detail} regional={regionalAir} state={globalAir} paint={paint} onChange={(id,change)=>setPaint(current=>({...current,[id]:{...current[id],...change}}))}/>
  <div className="minimal-zoom"><button aria-label="Zoom in" onClick={()=>{setZoom(z=>z+1);}}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>{setZoom(z=>z-1);}}><Minus size={18}/></button></div>
  <p className="minimal-hint">Drag to rotate · Scroll to explore</p>
  {about&&<div className="modal-backdrop" onClick={()=>{setAbout(false);aboutButton.current?.focus();}}><section className="minimal-about" role="dialog" aria-modal="true" aria-label="About the air-quality data" onClick={e=>e.stopPropagation()}><button ref={closeButton} className="modal-close" aria-label="Close about" onClick={()=>{setAbout(false);aboutButton.current?.focus();}}><X size={20}/></button><h2>The air, in data.</h2><p>PM₂.₅ is the concentration of fine particles near the surface, in micrograms per cubic metre.</p><p>These are current-time estimates from <a href={AIR_SOURCE.url} target="_blank" rel="noreferrer">CAMS global atmospheric composition forecasts</a>, provided by <a href={AIR_SOURCE.apiDocumentation} target="_blank" rel="noreferrer">Open-Meteo</a>. They are modeled, rather than readings from a local sensor.</p><p>We use the same global model for every place. Its roughly 45 km grid represents an area around the city, not street-level conditions or personal exposure. The displayed timestamp is the estimate’s valid time in UTC, not the model’s publication time.</p><p>City data refreshes when you choose a place and every 15 minutes while this page is visible. If a refresh fails, any saved estimate is labeled. No invented fallback values are shown.</p><p>The globe shows worldwide CAMS snapshots of PM₂.₅, nitrogen dioxide (NO₂), near-surface ozone (O₃), and mineral dust, on the native 0.4° grid (roughly 45 km) across land and oceans, with 405,900 cells per layer. All four layers use the same valid time. Dots use an approximately even distribution over the sphere. Values are interpolated from the model grid for display; dot positions are not monitoring stations. Zooming increases display dot density; it does not add scientific detail to the underlying field. These are complete global fields downloaded from Open-Meteo’s public CAMS bulk archive, with their original spatial resolution. The global layer has its own timestamp. The city estimate refreshes separately.</p><p>On zoom, Europe switches to the CAMS European ensemble at 0.1° (roughly 11 km), using the same valid time and all four pollutants. Outside Europe, the global field remains roughly 45 km. These are separate models and can differ at their boundary. Display interpolation does not create finer scientific detail.</p><p>Each layer has a fixed pigment colour and its own concentration range, in µg/m³. Pigments mix where fields overlap. Paint strength adjusts the display, not the underlying values. Mixed colours are an artistic encoding, not a combined health index or a chemical reaction. Dust overlaps particulate matter and must not be added to PM₂.₅ as a separate source contribution. Dot size and opacity represent display weight, not plume extent, altitude or wind. The dot layout has equal surface area per point, avoiding crowding at the poles. Each pigment is offset within its dot, like misregistered comic-book printing. This visual effect does not move the data sampling coordinates. Turn every layer off to see Earth beneath it.</p><p className="data-license">Earth: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">NASA Blue Marble Next Generation</a>, July 2004 composite. Static imagery, not current satellite conditions.</p><p className="data-license">Data: Copernicus Atmosphere Monitoring Service / ECMWF, via Open-Meteo. <a href={AIR_SOURCE.licence} target="_blank" rel="noreferrer">CC BY 4.0</a>. This prototype uses Open-Meteo’s non-commercial API.</p></section></div>}
 </main>;
}
const root=import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if(import.meta.hot){import.meta.hot.data.root=root;import.meta.hot.accept();}
root.render(<App/>);
