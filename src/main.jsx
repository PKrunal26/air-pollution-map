import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MagnifyingGlass,Plus,Minus,X,Info} from '@phosphor-icons/react';
import Globe from './Globe';
import {cities} from './data';
import './styles.css';
function App(){
 const [city,setCity]=useState(cities[0]),[zoom,setZoom]=useState(0),[focus,setFocus]=useState(0),[query,setQuery]=useState(''),[search,setSearch]=useState(false),[about,setAbout]=useState(false);
 const aboutButton=useRef(null),closeButton=useRef(null);
 const chooseCity=c=>{setCity(c);setZoom(1);setFocus(f=>f+1);setSearch(false);setQuery('');};
 const results=cities.filter(c=>(c.name+' '+c.country).toLowerCase().includes(query.toLowerCase()));
 useEffect(()=>{const escape=e=>{if(e.key==='Escape'){setSearch(false);setAbout(false);}};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[]);
 useEffect(()=>{if(about)closeButton.current?.focus();},[about]);
 return <main className="atlas-app minimal-atlas">
  <Globe clean city={city} active={[]} selected={null} mode="terrain" zoom={zoom} focus={focus} year={2024} month={0} scenario={0} onCity={chooseCity}/>
  <header className="minimal-header"><h1>Who owns the air?</h1><button ref={aboutButton} aria-label="About this version" onClick={()=>setAbout(true)}><Info size={19} weight="light"/></button></header>
  <div className="minimal-search"><div className="search-input"><MagnifyingGlass size={17}/><input aria-label="Search cities" placeholder="Find a place" value={query} onFocus={()=>setSearch(true)} onChange={e=>{setQuery(e.target.value);setSearch(true);}} onKeyDown={e=>{if(e.key==='Enter'&&results[0])chooseCity(results[0]);}}/></div>
   {search&&<div className="search-results"><div className="results-heading">PLACES<button aria-label="Close search" onClick={()=>setSearch(false)}><X size={16}/></button></div>{results.map(c=><button className="search-result" key={c.id} onClick={()=>chooseCity(c)}><span>{c.name}<small>{c.country}</small></span></button>)}{!results.length&&<p className="empty-search">Try Delhi, London or Beijing.</p>}</div>}
  </div>
  <div className="minimal-place"><span>{city.name}</span><small>{city.country}</small></div>
  <div className="minimal-zoom"><button aria-label="Zoom in" onClick={()=>{setZoom(1);setFocus(f=>f+1);}}><Plus size={18}/></button><button aria-label="Zoom out" onClick={()=>{setZoom(0);setFocus(f=>f+1);}}><Minus size={18}/></button></div>
  <p className="minimal-hint">Drag to rotate · Scroll to explore</p>
  {about&&<div className="modal-backdrop" onClick={()=>{setAbout(false);aboutButton.current?.focus();}}><section className="minimal-about" role="dialog" aria-modal="true" aria-label="About this version" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Tab'){e.preventDefault();closeButton.current?.focus();}}}><button ref={closeButton} className="modal-close" aria-label="Close about" onClick={()=>{setAbout(false);aboutButton.current?.focus();}}><X size={20}/></button><h2>Earth, first.</h2><p>A quieter starting point for exploring the air we share.</p><p>The surface uses geographic Earth imagery with terrain and ocean maps. The lighting is a visual treatment; this is not live satellite imagery.</p><p>Pollution readings and source paths are paused while we connect real air-quality data. This version shows no invented concentrations.</p></section></div>}
 </main>;
}
const root=import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if(import.meta.hot){import.meta.hot.data.root=root;import.meta.hot.accept();}
root.render(<App/>);
