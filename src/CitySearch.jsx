import React,{useEffect,useMemo,useRef,useState} from 'react';
import {MagnifyingGlass,X,ArrowUpRight,MapPin,GpsFix} from '@phosphor-icons/react';
import {places,searchPlaces,parseCoordinates} from './places';
import './styles/search-about.css';

const LIMIT=30;
const isMac=()=>typeof navigator!=='undefined'&&/mac|iphone|ipad/i.test(navigator.userAgentData?.platform||navigator.platform||'');
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;

export default function CitySearch({onChoose,onLocate,open,onOpenChange,shortcutDisabled=false}){
 const [query,setQuery]=useState(''),[active,setActive]=useState(0);
 const container=useRef(null),input=useRef(null),trigger=useRef(null);
 const shortcutLabel=useMemo(()=>isMac()?'⌘ K':'Ctrl K',[]);
 const q=query.trim(),coords=useMemo(()=>parseCoordinates(q),[q]);
 const matches=useMemo(()=>q?searchPlaces(q):places.slice(0,12),[q]);
 const results=useMemo(()=>[...(!q&&onLocate?[{id:'my-location',locate:true}]:[]),...(coords?[{...coords,coordinate:true}]:[]),...matches.slice(0,LIMIT)],[q,onLocate,coords,matches]);
 const count=!q?`12 of ${places.length} cities`:matches.length>LIMIT?`Showing ${LIMIT} of ${matches.length}`:plural(matches.length,'place');
 useEffect(()=>{
  const outside=e=>{if(!container.current?.contains(e.target))onOpenChange(false);};
  if(open)document.addEventListener('pointerdown',outside);
  return()=>document.removeEventListener('pointerdown',outside);
 },[open,onOpenChange]);
 useEffect(()=>{if(open){setActive(0);input.current?.focus();}},[open]);
 useEffect(()=>{
  if(open)return;
  const t=setTimeout(()=>{setQuery('');setActive(0);},350);
  return()=>clearTimeout(t);
 },[open]);
 useEffect(()=>{
  if(shortcutDisabled)return;
  const shortcut=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();onOpenChange(!open);}};
  document.addEventListener('keydown',shortcut);return()=>document.removeEventListener('keydown',shortcut);
 },[open,onOpenChange,shortcutDisabled]);
 useEffect(()=>{if(open)document.getElementById(`city-${results[active]?.id}`)?.scrollIntoView({block:'nearest'});},[active,q,open]);
 const close=()=>{onOpenChange(false);trigger.current?.focus();};
 const choose=city=>{if(city.locate){close();onLocate();return;}const{coordinate,...place}=city;onChoose(place);setQuery('');setActive(0);close();};
 const keyboard=e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
   e.preventDefault();const direction=e.key==='ArrowDown'?1:-1;
   setActive(i=>(i+direction+results.length)%Math.max(1,results.length));
  }
  if(e.key==='Enter'&&results[active]){e.preventDefault();choose(results[active]);}
 };
 return <div ref={container} className={`minimal-search${open?' is-open':''}`} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))onOpenChange(false);}}>
  <button ref={trigger} className="search-trigger" aria-label="Find a place" aria-expanded={open} aria-controls="city-search-panel" onClick={()=>onOpenChange(!open)}><MagnifyingGlass size={16} weight="light"/><span>Find a place</span><kbd>{shortcutLabel}</kbd></button>
  <div className="search-popover" id="city-search-panel" inert={!open?true:undefined} aria-hidden={!open}>
   <div className="search-popover-heading"><span className="section-kicker">Find a place</span><button className="icon-button" aria-label="Close city search" onClick={close}><X size={17} weight="light"/></button></div>
   <div className="search-input"><MagnifyingGlass size={18} weight="light"/><input ref={input} aria-label="Search cities or coordinates" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls="city-options" aria-activedescendant={open&&results[active]?`city-${results[active].id}`:undefined} placeholder="Search a city or lat, lon" autoComplete="off" autoCorrect="off" spellCheck={false} value={query} onChange={e=>{setQuery(e.target.value);setActive(0);}} onKeyDown={keyboard}/>{query&&<button aria-label="Clear search" onClick={()=>{setQuery('');setActive(0);input.current?.focus();}}><X size={14}/></button>}</div>
   <div className="search-results"><div className="results-heading"><span>{q?'Matching places':'Popular places'}</span><span role="status">{count}</span></div><div id="city-options" role="listbox" aria-label="Cities">{results.map((city,i)=><button type="button" role="option" aria-selected={active===i} id={`city-${city.id}`} className={`search-result${city.coordinate||city.locate?' is-coordinate':''}`} key={city.id} onMouseEnter={()=>setActive(i)} onClick={()=>choose(city)}>{city.locate?<span><b>Use my location</b><small>See the air where you are</small></span>:city.coordinate?<span><b>Go to {city.name}</b><small>Type lat, lon to fly anywhere</small></span>:<span>{city.name}<small>{city.country}</small></span>}{city.locate?<GpsFix size={16} weight="light"/>:city.coordinate?<MapPin size={16} weight="light"/>:<ArrowUpRight size={16} weight="light"/>}</button>)}</div>{!results.length&&<p className="empty-search" role="status">No city match. Try a major city or type coordinates like 48.85, 2.35</p>}</div>
   <p className="search-keyboard">↑ ↓ to navigate <span>↵ to explore</span><span>esc to close</span></p>
  </div>
 </div>;
}
