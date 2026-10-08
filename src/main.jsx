import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MagnifyingGlass,Plus,Minus,X,Info} from '@phosphor-icons/react';
import Globe from './Globe';
import {places as cities} from './places';
import AirQuality from './AirReadout.jsx';
import {AIR_SOURCE} from './airQuality';
import './styles.css';
function App(){
 const [air,setAir]=useState(null);
 const [city,setCity]=useState(cities[0]),[zoom,setZoom]=useState(0),[focus,setFocus]=useState(0),[query,setQuery]=useState(''),[search,setSearch]=useState(false),[about,setAbout]=useState(false);
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
 return <main className="atlas-app minimal-atlas">
  <Globe clean air={air?.cityId===city.id?air:null} city={city} active={[]} selected={null} mode="terrain" zoom={zoom} focus={focus} year={2024} month={0} scenario={0} onCity={chooseCity}/>
  <header className="minimal-header"><h1>Who owns the air?</h1><button ref={aboutButton} aria-label="About this version" onClick={()=>setAbout(true)}><Info size={19} weight="light"/></button></header>
  <div className="minimal-search"><div className="search-input"><MagnifyingGlass size={17}/><input aria-label="Search cities" placeholder="Find a place" value={query} onFocus={()=>setSearch(true)} onChange={e=>{setQuery(e.target.value);setSearch(true);}} onKeyDown={e=>{if(e.key==='Enter'&&results[0])chooseCity(results[0]);}}/></div>
   {search&&<div className="search-results"><div className="results-heading">PLACES<button aria-label="Close search" onClick={()=>setSearch(false)}><X size={16}/></button></div>{results.map(c=><button className="search-result" key={c.id} onClick={()=>chooseCity(c)}><span>{c.name}<small>{c.country}</small></span></button>)}{!results.length&&<p className="empty-search">Try Delhi, London or Beijing.</p>}</div>}
  </div>
  <AirQuality city={city} onUpdate={setAir}/>
  <div className="minimal-zoom"><button aria-label="Zoom in" onClick={()=>{setZoom(1);setFocus(f=>f+1);}}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>{setZoom(0);setFocus(f=>f+1);}}><Minus size={18}/></button></div>
  <p className="minimal-hint">Drag to rotate · Scroll to explore</p>
  {about&&<div className="modal-backdrop" onClick={()=>{setAbout(false);aboutButton.current?.focus();}}><section className="minimal-about" role="dialog" aria-modal="true" aria-label="About the air-quality data" onClick={e=>e.stopPropagation()}><button ref={closeButton} className="modal-close" aria-label="Close about" onClick={()=>{setAbout(false);aboutButton.current?.focus();}}><X size={20}/></button><h2>The air, in data.</h2><p>PM₂.₅ is the concentration of fine particles near the surface, in micrograms per cubic metre.</p><p>These are current-time estimates from <a href={AIR_SOURCE.url} target="_blank" rel="noreferrer">CAMS global atmospheric composition forecasts</a>, provided by <a href={AIR_SOURCE.apiDocumentation} target="_blank" rel="noreferrer">Open-Meteo</a>. They are modeled, rather than readings from a local sensor.</p><p>We use the same global model for every place. Its roughly 45 km grid represents an area around the city, not street-level conditions or personal exposure. The displayed timestamp is the estimate’s valid time in UTC, not the model’s publication time.</p><p>Data refreshes when you choose a place and every 15 minutes while this page is visible. If a refresh fails, any saved estimate is labeled. No invented fallback values are shown.</p><p>The plume is a magnified artistic symbol: higher PM₂.₅ makes it denser. Its shape, direction, height and area are not measured, and its motion does not follow real wind. It does not attribute pollution to a facility or system. The Earth imagery is separate from the concentration data.</p><p className="data-license">Earth: <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">NASA Blue Marble Next Generation</a>, July 2004 composite. Static imagery, not current satellite conditions.</p><p className="data-license">Data: Copernicus Atmosphere Monitoring Service / ECMWF, via Open-Meteo. <a href={AIR_SOURCE.licence} target="_blank" rel="noreferrer">CC BY 4.0</a>. This prototype uses Open-Meteo’s non-commercial API.</p></section></div>}
 </main>;
}
const root=import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if(import.meta.hot){import.meta.hot.data.root=root;import.meta.hot.accept();}
root.render(<App/>);
