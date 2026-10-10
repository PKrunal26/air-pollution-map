import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import {Plus,Minus,Info,ArrowCounterClockwise,GpsFix} from '@phosphor-icons/react';
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
import {parseEmbedParams,applyLayerSelection} from './embedParams';
import {fetchFrameManifest,fetchHistoryManifest,createTimeline,frameDataset,nearestFrame} from './airFrames';
import TimeBar from './TimeBar';
import LayerPicker from './LayerPicker';
import {loadOnboarded,saveOnboarded} from './onboarding';
import {locateUser,locationMessage,locationPermission,saveAsked,shouldAskOnOpen} from './userLocation';
import {track} from './analytics';
import './styles/shell.css';

const LOADER_TIMEOUT=20000,noop=()=>()=>{},CHROME_INSET=176;
// ?embed=1 shows the globe only (for iframes); layers, surface and bg set the initial look.
const OPTIONS=parseEmbedParams(typeof location!=='undefined'?location.search:''),EMBED=OPTIONS.embed;
if(OPTIONS.bg)document.documentElement.style.setProperty('--embed-bg',OPTIONS.bg);
function useMedia(query){
 const [match,setMatch]=useState(()=>typeof matchMedia==='function'&&matchMedia(query).matches);
 useEffect(()=>{const list=matchMedia(query),update=()=>setMatch(list.matches);update();list.addEventListener('change',update);return()=>list.removeEventListener('change',update);},[query]);
 return match;
}
function App(){
 const [surface,setSurface]=useState(OPTIONS.surface??'charcoal');
 const [weather,setWeather]=useState({status:'loading',data:null}),[weatherSettings,setWeatherSettings]=useState(initialWeather);
 const [regionalAir,setRegionalAir]=useState(null),[regionalError,setRegionalError]=useState(false),[detail,setDetail]=useState('overview');
 const [globalAir,setGlobalAir]=useState({status:'loading',data:null}),[paint,setPaint]=useState(()=>applyLayerSelection(initialPaint(),OPTIONS.layers));
 const [city,setCity]=useState(null),[zoom,setZoom]=useState(0),[focus,setFocus]=useState(0),[reset,setReset]=useState(0);
 const [panel,setPanel]=useState(null),[probe,setProbe]=useState(null),[probeReset,setProbeReset]=useState(0),[readout,setReadout]=useState(()=>!EMBED&&loadReadout());
 const [flyTarget,setFlyTarget]=useState(null),[range,setRange]=useState({atMin:false,atMax:false});
 const [userLocation,setUserLocation]=useState(null),[locating,setLocating]=useState(false),[locateError,setLocateError]=useState('');
 const [globeReady,setGlobeReady]=useState(false),[airVisible,setAirVisible]=useState(false),[opened,setOpened]=useState(false),[timedOut,setTimedOut]=useState(false),[progress,setProgress]=useState({loaded:0,total:null});
 const desktop=useMedia('(min-width:701px)');
 // First visit only (not embedded, not when the URL picks layers): ask which pollutants to show.
 const [picking,setPicking]=useState(()=>!EMBED&&!OPTIONS.layers&&!loadOnboarded());
 const finishPicking=React.useCallback(()=>{saveOnboarded();setPicking(false);},[]);
 const [timelines,setTimelines]=useState({forecast:null,history:null}),[mode,setMode]=useState(OPTIONS.history?'history':'forecast'),[frameAir,setFrameAir]=useState(null);
 const timeline=timelines[mode]??timelines.forecast;
 const changeMode=next=>{timeline?.pause();setMode(next);track(`time/${next}`);};
 useEffect(()=>{if(EMBED)return;const controller=new AbortController();fetchWeather(controller.signal).then(data=>setWeather({status:'ready',data})).catch(e=>{if(e.name!=='AbortError')setWeather({status:'error',data:null});});return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();fetchEuropeLayers(controller.signal).then(setRegionalAir).catch(e=>{if(e.name!=='AbortError')setRegionalError(true);});return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();fetchNativeLayers(controller.signal,(loaded,total)=>setProgress({loaded,total})).then(data=>setGlobalAir({status:'ready',data})).catch(e=>{if(e.name!=='AbortError')setGlobalAir({status:'error',data:null});});return()=>controller.abort();},[]);
 // Forecast frames load after the snapshot is on screen; they never block the first view.
 useEffect(()=>{
  if(globalAir.status!=='ready')return;
  const controller=new AbortController(),made=[],reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Forecast (48 h, 3-hourly) and history (monthly means since 2022) load independently; either can be missing.
  const open=(kind,fetcher)=>fetcher(controller.signal).then(manifest=>{
   const line=createTimeline(manifest,{reduced,kind,start:kind==='history'?manifest.frames.length-1:manifest.snapshotIndex});made.push(line);
   const at=OPTIONS.time==null||OPTIONS.history!==(kind==='history')?-1:manifest.frames.findIndex(f=>f.validAt===OPTIONS.time);
   if(at>=0)line.seek(at);
   if(OPTIONS.play&&(kind==='history')===OPTIONS.history)line.play();
   setTimelines(current=>({...current,[kind]:line}));
  }).catch(()=>{});
  open('forecast',fetchFrameManifest);open('history',fetchHistoryManifest);
  return()=>{controller.abort();made.forEach(l=>l.dispose());};
 },[globalAir.status]);
 // Readout away from the snapshot hour: values from the nearest real frame (never a blend), labelled with its time.
 const frameIndex=useSyncExternalStore(timeline?.subscribe??noop,()=>timeline&&!timeline.atSnapshot?nearestFrame(timeline.position,timeline.count):-1);
 useEffect(()=>{
  if(!timeline||frameIndex<0){setFrameAir(null);return;}
  if(!readout||!probe)return; // converted only while a readout is open
  const bits=timeline.bits(frameIndex);
  if(bits)setFrameAir(current=>current?.frame===frameIndex?current:frameDataset(timeline.manifest,frameIndex,bits));
 },[timeline,frameIndex,timeline?.version,readout,probe]);
 useEffect(()=>{const timer=setTimeout(()=>setTimedOut(true),LOADER_TIMEOUT);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{if(!locateError)return;const timer=setTimeout(()=>setLocateError(''),6000);return()=>clearTimeout(timer);},[locateError]);
 const clearProbe=()=>{setProbe(null);setProbeReset(n=>n+1);};
 const changeReadout=on=>{setReadout(on);saveReadout(on);if(!on)clearProbe();};
 const closeTransient=()=>setPanel(p=>p==='search'?null:p);
 const chooseCity=place=>{clearProbe();setCity(place);setZoom(1);setFocus(f=>f+1);closeTransient();};
 const overview=()=>{clearProbe();setCity(null);setZoom(0);setFocus(0);setReset(n=>n+1);closeTransient();};
 // Rotating or zooming the globe must not close the layer panel; only the search popover.
 const interact=()=>setPanel(p=>p==='search'?null:p);
 const flyTo=(lat,lon,distance=1.6,pin)=>setFlyTarget(t=>({key:(t?.key??0)+1,lat,lon,distance,pin}));
 // My location: fly there and pin the air readout on it.
 // quiet: asked on open rather than by a press, so a refusal shows no error.
 const locate=({quiet=false}={})=>{
  if(locating)return;setLocating(true);setLocateError('');closeTransient();
  locateUser().then(found=>{track(quiet?'location/allowed-on-open':'location/found');setUserLocation(found);setCity(null);flyTo(found.lat,found.lon,2.3,{mine:true});}).catch(e=>{track(quiet?'location/refused-on-open':`location/failed-${e?.code??'unknown'}`);if(!quiet)setLocateError(locationMessage(e));}).finally(()=>setLocating(false));
 };
 const cameraRange=next=>setRange(current=>current.atMin===next.atMin&&current.atMax===next.atMax?current:{atMin:!!next.atMin,atMax:!!next.atMax});
 const probeCard=readout&&!!probe&&(!panel||panel==='layers');
 const stacked=!!city||(probeCard&&!!probe.pinned);
 const viewShift=!EMBED&&desktop&&(panel==='layers'||stacked)?.14:0;
 const noLayers=!PAINT_LAYERS.some(l=>paint[l.id]?.enabled);
 const ready=opened||timedOut||(globeReady&&(airVisible||globalAir.status==='error'||noLayers));
 useEffect(()=>{if(ready)setOpened(true);},[ready]);
 // Once the globe is up: first visit asks for location; allowed earlier shows the marker without moving the camera.
 useEffect(()=>{
  if(EMBED||!opened)return;let live=true;
  locationPermission().then(state=>{
   if(!live)return;
   if(state==='granted')return locateUser().then(found=>{if(live)setUserLocation(found);});
   if(shouldAskOnOpen(state)){saveAsked();locate({quiet:true});}
  }).catch(()=>{});
  return()=>{live=false;};
 },[opened]);
 const updatePaint=(id,change)=>{if(change.enabled)track(`layer/${id}`);setPaint(current=>({...current,[id]:{...current[id],...change}}));};
 // Counts taps that keep a readout (not hover, not the viewer's own location).
 const probeChange=next=>{if(next?.pinned&&!next.mine)track('readout/pin');setProbe(next);};
 return <main className={`atlas-app${EMBED?' is-embed':''}${OPTIONS.bg?' has-bg':''}${panel==='layers'?' layers-open':''}${picking&&ready?' is-picking':''} surface-view-${surface}`} aria-busy={!ready||undefined}>
  <div className="atlas-interface" inert={!ready?true:undefined}>
   <Globe onProbe={probeChange} readout={readout} probeEnabled={readout&&panel!=='search'} probeReset={probeReset} surface={surface} globalAir={globalAir.data} regionalAir={regionalAir} onDetail={setDetail} paint={paint} weatherData={weather.data} weatherSettings={weatherSettings} city={city} zoom={zoom} focus={focus} reset={reset} viewShift={viewShift} flyTarget={flyTarget} onCameraRange={cameraRange} onReady={()=>setGlobeReady(true)} onAirVisible={()=>setAirVisible(true)} onCity={chooseCity} onInteraction={interact} homeScale={OPTIONS.zoom} wheelModifier={EMBED} timeline={timeline} userLocation={userLocation} chromeInset={EMBED?0:CHROME_INSET}/>
   {!EMBED&&<>
   <header className="minimal-header">
    <button className="atlas-brand" aria-label="Return to overview" onClick={overview}><svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth=".8"/><ellipse cx="16" cy="16" rx="6" ry="12" stroke="currentColor" strokeWidth=".8" transform="rotate(35 16 16)"/><path d="M4 16h24" stroke="currentColor" strokeWidth=".8"/></svg><span>Air Atlas</span></button>
    <nav aria-label="Explore the atlas"><CitySearch open={panel==='search'} onOpenChange={open=>setPanel(open?'search':null)} onChoose={chooseCity} onLocate={locate}/><ReadoutToggle on={readout} onChange={changeReadout}/><a className="about-trigger" href="study.html" aria-label="About the data"><Info size={16} weight="light"/><span>About</span></a></nav>
   </header>
   <div className="side-stack">
    {city&&<AirQuality city={city} onClear={()=>setCity(null)} snapshotAt={globalAir.data?.validAt??null}/>}
    {probeCard&&<AirComposition location={probe} global={frameIndex>=0?{status:frameAir?'ready':'loading',data:frameAir}:globalAir} regional={frameIndex>=0?null:regionalAir} paint={paint} onClose={clearProbe}/>}
   </div>
   <GlobalAirLegend surface={surface} onSurfaceChange={setSurface} panelOpen={panel==='layers'} onPanelChange={open=>{if(open){clearProbe();if(picking)finishPicking();}setPanel(open?'layers':null);}} onFlyTo={flyTo} detail={detail} regional={regionalAir} regionalError={regionalError} state={globalAir} paint={paint} weather={weather} weatherSettings={weatherSettings} onWeatherChange={(id,change)=>{if(change.enabled)track(`weather/${id}`);setWeatherSettings(current=>({...current,[id]:{...current[id],...change}}));}} onChange={updatePaint}/>
   {picking&&ready&&<LayerPicker paint={paint} onChange={updatePaint} onDone={finishPicking}/>}
   {timeline&&<TimeBar timeline={timeline} mode={timeline.kind} modes={Object.keys(timelines).filter(k=>timelines[k])} onMode={changeMode}/>}
   <div className="minimal-zoom" role="group" aria-label="Globe view"><button aria-label="Reset globe view" onClick={overview}><ArrowCounterClockwise size={17} weight="light"/></button><button className={`locate-button${locating?' is-locating':''}${userLocation?' is-found':''}`} aria-label="Show my location" aria-busy={locating||undefined} onClick={()=>locate()}><GpsFix size={17} weight={userLocation?'regular':'light'}/></button><span/><button aria-label="Zoom in" disabled={range.atMin} onClick={()=>{setZoom(z=>z+1);}}><Plus size={17} weight="light"/></button><button aria-label="Zoom out" disabled={range.atMax} onClick={()=>{setZoom(z=>z-1);}}><Minus size={17} weight="light"/></button></div>
   <p className={`locate-status${locateError?' is-shown':''}`} role="status">{locateError}</p>
   </>}
  </div>
  <Loader ready={ready} progress={progress} textureReady={globeReady} downloaded={globalAir.status!=='loading'} failed={globalAir.status==='error'}/>
 </main>;
}
const root=import.meta.hot?.data.root||createRoot(document.getElementById('root'));
if(import.meta.hot){import.meta.hot.data.root=root;import.meta.hot.accept();}
root.render(<App/>);
