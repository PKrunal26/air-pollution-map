import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import {Plus,Minus,Info,ArrowCounterClockwise} from '@phosphor-icons/react';
import Globe from './Globe';
import CitySearch from './CitySearch';
import AirQuality from './AirReadout.jsx';
import AirComposition from './AirComposition';
import ReadoutToggle from './ReadoutToggle';
import {loadReadout,saveReadout} from './readoutPref';
import {fetchNativeLayers,fetchEuropeLayers} from './globalAir';
import {initialPaint,PAINT_LAYERS} from './paintLayers';
import GlobalAirLegend from './GlobalAirLegend';
import Loader from './Loader';
import {fetchWeather,initialWeather} from './weather';
import './styles/shell.css';

const LOADER_TIMEOUT=20000;
function useMedia(query){
 const [match,setMatch]=useState(()=>typeof matchMedia==='function'&&matchMedia(query).matches);
 useEffect(()=>{const list=matchMedia(query),update=()=>setMatch(list.matches);update();list.addEventListener('change',update);return()=>list.removeEventListener('change',update);},[query]);
 return match;
}
function App(){
 const [surface,setSurface]=useState('charcoal');
 const [weather,setWeather]=useState({status:'loading',data:null}),[weatherSettings,setWeatherSettings]=useState(initialWeather);
 const [regionalAir,setRegionalAir]=useState(null),[regionalError,setRegionalError]=useState(false),[detail,setDetail]=useState('overview');
 const [globalAir,setGlobalAir]=useState({status:'loading',data:null}),[paint,setPaint]=useState(initialPaint);
 const [city,setCity]=useState(null),[zoom,setZoom]=useState(0),[focus,setFocus]=useState(0),[reset,setReset]=useState(0);
 const [panel,setPanel]=useState(null),[probe,setProbe]=useState(null),[probeReset,setProbeReset]=useState(0),[readout,setReadout]=useState(loadReadout);
 const [flyTarget,setFlyTarget]=useState(null),[range,setRange]=useState({atMin:false,atMax:false});
 const [globeReady,setGlobeReady]=useState(false),[airVisible,setAirVisible]=useState(false),[opened,setOpened]=useState(false),[timedOut,setTimedOut]=useState(false),[progress,setProgress]=useState({loaded:0,total:null});
 const desktop=useMedia('(min-width:701px)');
 useEffect(()=>{const controller=new AbortController();fetchWeather(controller.signal).then(data=>setWeather({status:'ready',data})).catch(e=>{if(e.name!=='AbortError')setWeather({status:'error',data:null});});return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();fetchEuropeLayers(controller.signal).then(setRegionalAir).catch(e=>{if(e.name!=='AbortError')setRegionalError(true);});return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();fetchNativeLayers(controller.signal,(loaded,total)=>setProgress({loaded,total})).then(data=>setGlobalAir({status:'ready',data})).catch(e=>{if(e.name!=='AbortError')setGlobalAir({status:'error',data:null});});return()=>controller.abort();},[]);
 useEffect(()=>{const timer=setTimeout(()=>setTimedOut(true),LOADER_TIMEOUT);return()=>clearTimeout(timer);},[]);
 const clearProbe=()=>{setProbe(null);setProbeReset(n=>n+1);};
 const changeReadout=on=>{setReadout(on);saveReadout(on);if(!on)clearProbe();};
 const closeTransient=()=>setPanel(p=>p==='search'?null:p);
 const chooseCity=place=>{clearProbe();setCity(place);setZoom(1);setFocus(f=>f+1);closeTransient();};
 const overview=()=>{clearProbe();setCity(null);setZoom(0);setFocus(0);setReset(n=>n+1);closeTransient();};
 // Rotating or zooming the globe must not close the layer panel; only the search popover.
 const interact=()=>setPanel(p=>p==='search'?null:p);
 const flyTo=(lat,lon)=>setFlyTarget(t=>({key:(t?.key??0)+1,lat,lon,distance:1.6}));
 const cameraRange=next=>setRange(current=>current.atMin===next.atMin&&current.atMax===next.atMax?current:{atMin:!!next.atMin,atMax:!!next.atMax});
 const probeCard=readout&&!!probe&&(!panel||panel==='layers');
 const stacked=!!city||(probeCard&&!!probe.pinned);
 const viewShift=desktop&&(panel==='layers'||stacked)?.14:0;
 const noLayers=!PAINT_LAYERS.some(l=>paint[l.id]?.enabled);
 const ready=opened||timedOut||(globeReady&&(airVisible||globalAir.status==='error'||noLayers));
 useEffect(()=>{if(ready)setOpened(true);},[ready]);
 const updatePaint=(id,change)=>setPaint(current=>({...current,[id]:{...current[id],...change}}));
 return <main className={`atlas-app${panel==='layers'?' layers-open':''} surface-view-${surface}`} aria-busy={!ready||undefined}>
  <div className="atlas-interface" inert={!ready?true:undefined}>
   <Globe onProbe={setProbe} readout={readout} probeEnabled={readout&&panel!=='search'} probeReset={probeReset} surface={surface} globalAir={globalAir.data} regionalAir={regionalAir} onDetail={setDetail} paint={paint} weatherData={weather.data} weatherSettings={weatherSettings} city={city} zoom={zoom} focus={focus} reset={reset} viewShift={viewShift} flyTarget={flyTarget} onCameraRange={cameraRange} onReady={()=>setGlobeReady(true)} onAirVisible={()=>setAirVisible(true)} onCity={chooseCity} onInteraction={interact}/>
   <header className="minimal-header">
    <button className="atlas-brand" aria-label="Return to overview" onClick={overview}><svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth=".8"/><ellipse cx="16" cy="16" rx="6" ry="12" stroke="currentColor" strokeWidth=".8" transform="rotate(35 16 16)"/><path d="M4 16h24" stroke="currentColor" strokeWidth=".8"/></svg><span>Air Atlas</span></button>
    <nav aria-label="Explore the atlas"><CitySearch open={panel==='search'} onOpenChange={open=>setPanel(open?'search':null)} onChoose={chooseCity}/><ReadoutToggle on={readout} onChange={changeReadout}/><a className="about-trigger" href="study.html" aria-label="About the data"><Info size={16} weight="light"/><span>About</span></a></nav>
   </header>
   <div className="side-stack">
    {city&&<AirQuality city={city} onClear={()=>setCity(null)} snapshotAt={globalAir.data?.validAt??null}/>}
    {probeCard&&<AirComposition location={probe} global={globalAir} regional={regionalAir} paint={paint} onClose={clearProbe}/>}
   </div>
   <GlobalAirLegend surface={surface} onSurfaceChange={setSurface} panelOpen={panel==='layers'} onPanelChange={open=>{if(open)clearProbe();setPanel(open?'layers':null);}} onFlyTo={flyTo} detail={detail} regional={regionalAir} regionalError={regionalError} state={globalAir} paint={paint} weather={weather} weatherSettings={weatherSettings} onWeatherChange={(id,change)=>setWeatherSettings(current=>({...current,[id]:{...current[id],...change}}))} onChange={updatePaint}/>
   <div className="minimal-zoom" role="group" aria-label="Globe zoom"><button aria-label="Reset globe view" onClick={overview}><ArrowCounterClockwise size={17} weight="light"/></button><span/><button aria-label="Zoom in" disabled={range.atMin} onClick={()=>{setZoom(z=>z+1);}}><Plus size={17} weight="light"/></button><button aria-label="Zoom out" disabled={range.atMax} onClick={()=>{setZoom(z=>z-1);}}><Minus size={17} weight="light"/></button></div>
  </div>
  <Loader ready={ready} progress={progress} textureReady={globeReady} downloaded={globalAir.status!=='loading'} failed={globalAir.status==='error'}/>
 </main>;
}
const root=import.meta.hot?.data.root||createRoot(document.getElementById('root'));
if(import.meta.hot){import.meta.hot.data.root=root;import.meta.hot.accept();}
root.render(<App/>);
