import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import {Plus,Minus,Info,ArrowCounterClockwise,GpsFix,Cards} from '@phosphor-icons/react';
import Globe from './Globe';
import CitySearch from './CitySearch';
import AirComposition from './AirComposition';
import ReadoutToggle from './ReadoutToggle';
import {loadReadout,saveReadout} from './readoutPref';
import {loadSettings,mergeLayers,saveSettings} from './settingsPref';
import {fetchNativeLayers,fetchEuropeLayers} from './globalAir';
import {initialPaint,PAINT_LAYERS,EUROPE_ONLY_IDS} from './paintLayers';
import GlobalAirLegend from './GlobalAirLegend';
import Loader from './Loader';
import {fetchWeather,initialWeather} from './weather';
import {parseEmbedParams,applyLayerSelection} from './embedParams';
import {fetchFrameManifest,fetchHistoryManifest,fetchEuropeManifest,createTimeline,frameDataset,nearestFrame} from './airFrames';
import TimeBar from './TimeBar';
import LayerPicker from './LayerPicker';
import {loadOnboarded,saveOnboarded} from './onboarding';
import {releaseSeen,saveReleaseSeen,RELEASE} from './releaseNotes';
import WhatsNew from './WhatsNew';
import {guessRegion,homePoint,locateUser,locationMessage,locationPermission} from './userLocation';
import {track} from './analytics';
import './styles/shell.css';
import DECK_JSON from './cards/deck.json';
import {validateDeck,cardAt,monthKey,footprintCentre,inCardMonths} from './cards/deck';
import {loadCollection,saveCollection,markFound,questionFor,answer,waitLeft,variantKey,mergeCollected,mergeStates,openClue,STORAGE_KEY} from './cards/collection';
import {cardSets,setsCompletedBy} from './cards/sets';
import ReadoutCardRow from './cards/ReadoutCardRow';
import CardQuestion from './cards/CardQuestion';
import CardsPanel from './cards/CardsPanel';
import CardViewer from './cards/CardViewer';
import ORDER from './cards/order.json';
import {encodeDeck,decodeDeck} from './cards/recovery';
import {parseCardParams} from './cards/cardParams';
import {fetchFoundCount} from './cards/share';

const LOADER_TIMEOUT=20000,noop=()=>()=>{},CHROME_INSET=176,PHONE_HEADER=72;
// ?embed=1 shows the globe only (for iframes); layers, surface and bg set the initial look.
const OPTIONS=parseEmbedParams(typeof location!=='undefined'?location.search:''),EMBED=OPTIONS.embed;
if(OPTIONS.bg)document.documentElement.style.setProperty('--embed-bg',OPTIONS.bg);
// Android in-app browsers (Reddit and others; "; wv)" in the user agent) lay a toolbar over the page bottom that only
// hides on scroll, and this page never scrolls, so the phone dock sits higher there.
if(typeof navigator!=='undefined'&&/; wv\)/.test(navigator.userAgent))document.documentElement.classList.add('in-app-browser');
// Saved view from the last visit (not for embeds); URL options still win.
const SAVED=EMBED?null:loadSettings();
// Event cards: the hand-written deck. A broken deck turns the game off rather than the atlas.
const DECK=(()=>{try{return validateDeck(DECK_JSON);}catch(e){console.error(e);return [];}})();
// ?card=<id> shows a shared card; ?deck=<code> restores a collection (not in embeds).
const CARD_OPTIONS=EMBED||typeof location==='undefined'?{card:null,deck:null}:parseCardParams(location.search,new Set(DECK.map(c=>c.id)));
const cardKey=hit=>hit.status==='variant'?variantKey(hit.card.id,hit.variant.kind):hit.card.id;
function useMedia(query){
 const [match,setMatch]=useState(()=>typeof matchMedia==='function'&&matchMedia(query).matches);
 useEffect(()=>{const list=matchMedia(query),update=()=>setMatch(list.matches);update();list.addEventListener('change',update);return()=>list.removeEventListener('change',update);},[query]);
 return match;
}
function App(){
 const [surface,setSurface]=useState(OPTIONS.surface??SAVED?.surface??'charcoal');
 const [weather,setWeather]=useState({status:'loading',data:null}),[weatherSettings,setWeatherSettings]=useState(()=>mergeLayers(initialWeather(),SAVED?.weather));
 const [regionalAir,setRegionalAir]=useState(null),[regionalError,setRegionalError]=useState(false),[detail,setDetail]=useState('overview');
 const [globalAir,setGlobalAir]=useState({status:'loading',data:null}),[paint,setPaint]=useState(()=>OPTIONS.layers?applyLayerSelection(initialPaint(),OPTIONS.layers):mergeLayers(initialPaint(),SAVED?.paint));
 const [city,setCity]=useState(null),[zoom,setZoom]=useState(0),[focus,setFocus]=useState(0),[reset,setReset]=useState(0);
 const [panel,setPanel]=useState(null),[probe,setProbe]=useState(null),[probeReset,setProbeReset]=useState(0),[readoutPref,setReadout]=useState(()=>!EMBED&&loadReadout());
 const [flyTarget,setFlyTarget]=useState(null),[range,setRange]=useState({atMin:false,atMax:false});
 const [userLocation,setUserLocation]=useState(null),[region,setRegion]=useState(null),[locating,setLocating]=useState(false),[locateError,setLocateError]=useState('');
 const [globeReady,setGlobeReady]=useState(false),[airVisible,setAirVisible]=useState(false),[opened,setOpened]=useState(false),[timedOut,setTimedOut]=useState(false),[progress,setProgress]=useState({loaded:0,total:null});
 const desktop=useMedia('(min-width:701px)');
 // Clicking or tapping a place always pins its readout (and any card there); the Readout switch only turns the hover
 // readout on or off. Touch screens have no hover, so the switch is hidden there. Embeds have neither.
 const touch=useMedia('(hover:none)'),readout=!EMBED,hover=readout&&(touch||readoutPref);
 // First visit only (not embedded, not when the URL picks layers): ask which pollutants to show.
 const [picking,setPicking]=useState(()=>!EMBED&&!OPTIONS.layers&&!loadOnboarded());
 const finishPicking=React.useCallback(()=>{saveOnboarded();setPicking(false);},[]);
 // What's new: once per visitor and release (not in embeds), after the first-visit picker and any card dialog.
 const [release,setRelease]=useState(()=>!EMBED&&!releaseSeen());
 const closeRelease=next=>{saveReleaseSeen();setRelease(false);track(`release/${RELEASE.id}/${next}`);};
 const [timelines,setTimelines]=useState({forecast:null,history:null}),[mode,setMode]=useState(OPTIONS.history?'history':EMBED||OPTIONS.time!=null?'forecast':'history'),[frameAir,setFrameAir]=useState(null),[frameEurope,setFrameEurope]=useState(null);
 // Two stacked time bars: the monthly history (in front by default) and Today, the 48-hour forecast around the snapshot.
 // Until the history loads, Today's timeline (or none: the snapshot) is shown.
 const timeline=timelines[mode]??timelines.forecast;
 const changeMode=next=>{timeline?.pause();setMode(next);track(`time/${next}`);};
 // Only the bar in front plays: when the shown timeline changes (a tab click, or the history arriving), the other stops.
 useEffect(()=>{Object.values(timelines).forEach(line=>{if(line&&line!==timeline&&line.playing)line.pause();});},[timeline,timelines]);
 const [cards,setCards]=useState(()=>EMBED?null:loadCollection()),[asking,setAsking]=useState(null),[now,setNow]=useState(()=>Date.now());
 const [foundCount,setFoundCount]=useState(null);
 // How many people have collected the card being asked about; hidden when the counter is unavailable.
 useEffect(()=>{if(!asking)return;let live=true;setFoundCount(null);fetchFoundCount(asking.key).then(n=>{if(live)setFoundCount(n);});return()=>{live=false;};},[asking?.key]);
 const [viewing,setViewing]=useState(()=>{const card=DECK.find(c=>c.id===CARD_OPTIONS.card);return card?{card,variant:null,shared:true}:null;}),[clueFor,setClueFor]=useState(null);
 // A restore link merges into what this browser already holds, then leaves the address bar.
 useEffect(()=>{
  if(!CARD_OPTIONS.deck||!cards)return;
  setCards(current=>mergeCollected(current,decodeDeck(CARD_OPTIONS.deck,ORDER)));setPanel('cards');
  const url=new URL(location.href);url.searchParams.delete('deck');history.replaceState(null,'',url);
 },[]);
 useEffect(()=>{if(cards)saveCollection(cards);},[cards]);
 // Another tab collected or found something: fold it in, so neither tab's save loses the other's cards.
 useEffect(()=>{
  if(!cards)return;
  const sync=e=>{if(e.key===STORAGE_KEY)setCards(current=>mergeStates(current,loadCollection()));};
  window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);
 },[!!cards]);
 useEffect(()=>{if(EMBED)return;const controller=new AbortController();fetchWeather(controller.signal).then(data=>setWeather({status:'ready',data})).catch(e=>{if(e.name!=='AbortError')setWeather({status:'error',data:null});});return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();fetchEuropeLayers(controller.signal).then(setRegionalAir).catch(e=>{if(e.name!=='AbortError')setRegionalError(true);});return()=>controller.abort();},[]);
 useEffect(()=>{const controller=new AbortController();fetchNativeLayers(controller.signal,(loaded,total)=>setProgress({loaded,total})).then(data=>setGlobalAir({status:'ready',data})).catch(e=>{if(e.name!=='AbortError')setGlobalAir({status:'error',data:null});});return()=>controller.abort();},[]);
 // Frames load after the snapshot is on screen; they never block the first view, and either set can be missing.
 // Each timeline brings its Europe-only frames (same indexes) when they exist.
 useEffect(()=>{
  if(globalAir.status!=='ready')return;
  const controller=new AbortController(),made=[],reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const open=(kind,fetcher)=>fetcher(controller.signal).then(async manifest=>{
   const europe=await fetchEuropeManifest(kind,manifest,controller.signal);
   const line=createTimeline(manifest,{reduced,kind,start:kind==='history'?manifest.frames.length-1:manifest.snapshotIndex,europe});made.push(line);
   const at=OPTIONS.time==null||OPTIONS.history!==(kind==='history')?-1:manifest.frames.findIndex(f=>f.validAt===OPTIONS.time);
   if(at>=0)line.seek(at);
   if(OPTIONS.play&&(kind==='history')===(mode==='history'))line.play();
   setTimelines(current=>({...current,[kind]:line}));
  }).catch(()=>{});
  open('forecast',fetchFrameManifest);open('history',fetchHistoryManifest);
  return()=>{controller.abort();made.forEach(l=>l.dispose());};
 },[globalAir.status]);
 // Readout away from the snapshot hour: values from the nearest real frame (never a blend), labelled with its time.
 const frameIndex=useSyncExternalStore(timeline?.subscribe??noop,()=>timeline&&!timeline.atSnapshot?nearestFrame(timeline.position,timeline.count):-1);
 useEffect(()=>{
  if(!timeline||frameIndex<0){setFrameAir(null);setFrameEurope(null);return;}
  if(!(readout&&probe)&&!city)return; // converted only while a readout or place card is open
  const bits=timeline.bits(frameIndex),europeBits=timeline.europeBits(frameIndex);
  if(bits)setFrameAir(current=>current?.frame===frameIndex&&current.statistic===(timeline.manifest.statistic??null)?current:frameDataset(timeline.manifest,frameIndex,bits));
  setFrameEurope(current=>!europeBits?null:current?.frame===frameIndex&&current.statistic===(timeline.europe.statistic??null)?current:frameDataset(timeline.europe,frameIndex,europeBits));
 },[timeline,frameIndex,timeline?.version,readout,probe,city]);
 // Europe frames download only while a Europe-only layer is on.
 const europeOn=EUROPE_ONLY_IDS.some(id=>paint[id]?.enabled);
 useEffect(()=>{Object.values(timelines).forEach(line=>line?.useEurope(europeOn));},[timelines,europeOn]);
 // Layers with data at the time shown: the snapshot has every field; frames carry their own lists (null = snapshot).
 const frameFields=frameIndex>=0&&timeline?new Set([...timeline.manifest.fieldOrder,...(timeline.hasEurope(frameIndex)?timeline.europe.fieldOrder:[])]):null;
 useEffect(()=>{if(!EMBED)saveSettings({paint,weather:weatherSettings,surface});},[paint,weatherSettings,surface]);
 useEffect(()=>{const timer=setTimeout(()=>setTimedOut(true),LOADER_TIMEOUT);return()=>clearTimeout(timer);},[]);
 useEffect(()=>{if(!locateError)return;const timer=setTimeout(()=>setLocateError(''),6000);return()=>clearTimeout(timer);},[locateError]);
 const sharedShown=useRef(false);
 useEffect(()=>{
  const card=DECK.find(c=>c.id===CARD_OPTIONS.card),line=timelines.history;
  if(!card||!line||sharedShown.current)return;sharedShown.current=true;
  const at=line.manifest.frames.findIndex(f=>monthKey(f.validAt)===(card.featuredMonth??card.months[0]));
  setMode('history');if(at>=0)line.seek(at);
  const [lon,lat]=footprintCentre(card);flyTo(lat,lon,2.3);
 },[timelines.history]);
 // The month on the Monthly bar (null on Today). Cards are found by place alone; the month only breaks ties.
 const shownMonth=timeline?.kind==='history'&&frameIndex>=0?monthKey(timeline.manifest.frames[frameIndex].validAt):null;
 // A spot may hold a card or a CO print of one, at any month or on Today. Hovering shows that one is there; pinning
 // finds it (and offers the question).
 const enabledLayers=Object.keys(paint).filter(id=>paint[id]?.enabled).join(',');
 const ownedIds=cards?Object.keys(cards.collected).filter(k=>!k.includes(':')).join(','):'';
 const cardHit=React.useMemo(()=>{
  if(!cards||!DECK.length||!probe||!readout||(panel&&panel!=='layers'))return null;
  const hit=cardAt(DECK,{lat:probe.lat,lon:probe.lon,month:shownMonth,layers:new Set(enabledLayers.split(',')),owned:new Set(ownedIds.split(','))});
  return hit.status==='none'?null:hit;
 },[!!probe,probe?.lat,probe?.lon,readout,panel,shownMonth,enabledLayers,ownedIds,!!cards]);
 const hitKey=cardHit?cardKey(cardHit):null,foundKey=probe?.pinned?hitKey:null;
 useEffect(()=>{
  if(!foundKey)return;
  if(cards&&!(foundKey in cards.found)&&!(foundKey in cards.collected))track(`card-found/${foundKey}`);
  setCards(current=>foundKey in current.found||foundKey in current.collected?current:markFound(current,foundKey,Date.now()));
 },[foundKey]);
 useEffect(()=>{setNow(Date.now());},[hitKey,panel]);
 const hitWait=hitKey&&cards?waitLeft(cards,hitKey,now):0;
 // The countdown in the readout row ticks while a wait is showing, and Answer comes back the moment the wait ends.
 useEffect(()=>{
  if(!hitWait)return;
  const tick=setInterval(()=>setNow(Date.now()),30000),end=setTimeout(()=>setNow(Date.now()),hitWait+50);
  return()=>{clearInterval(tick);clearTimeout(end);};
 },[hitKey,hitWait>0]);
 const answerCard=choice=>{
  const {card,key}=asking,result=answer(cards,key,card,choice,Date.now());
  setCards(result.state);setNow(Date.now());track(`card-${result.correct?'collected':'wrong'}/${key}`);
  if(result.correct){
   // What the recap shows: how it was earned, and how far its set (its type, or the whole deck) has come.
   const before=new Set(Object.keys(cards.collected).filter(k=>!k.includes(':'))),variant=key.includes(':');
   const set=cardSets(DECK).find(s=>s.id!=='all'&&s.ids.includes(card.id))??cardSets(DECK).find(s=>s.id==='all');
   const had=set.ids.filter(id=>before.has(id)).length;
   setAsking(a=>a&&{...a,result:{earned:result.state.earned[key],set:variant?null:{name:set.name,total:set.ids.length,before:had,after:had+1},setsDone:variant?[]:setsCompletedBy(DECK,before,card.id)}});
  }
  return result.correct;
 };
 // The header count ticks up when the recap shows, not while the card is still on screen.
 const shownCount=cards?DECK.filter(c=>c.id in cards.collected).length-(asking?.result&&!asking.variant&&!asking.recapped?1:0):0;
 const cardRow=cardHit&&<ReadoutCardRow hit={cardHit} hover={!probe.pinned} collected={!!hitKey&&hitKey in cards.collected} waitMs={hitWait}
  onAnswer={()=>setAsking({card:cardHit.card,variant:cardHit.variant?.kind??null,key:hitKey,month:inCardMonths(cardHit.card,shownMonth)?shownMonth:null,question:questionFor(cardHit.card,cards,hitKey).question})} onView={()=>setViewing({card:cardHit.card,variant:cardHit.variant?.kind??null})}/>;
 const touched=useRef(false);
 const clearProbe=()=>{setProbe(null);setProbeReset(n=>n+1);};
 // The switch is the hover readout only; turning it off drops a passing (unpinned) readout, never a pinned one.
 const changeReadout=on=>{setReadout(on);saveReadout(on);if(!on&&!probe?.pinned)clearProbe();};
 const closeTransient=()=>setPanel(p=>p==='search'||p==='cards'?null:p);
 const chooseCity=place=>{touched.current=true;clearProbe();setCity(place);setZoom(1);setFocus(f=>f+1);closeTransient();};
 const overview=()=>{touched.current=true;clearProbe();setCity(null);setZoom(0);setFocus(0);setReset(n=>n+1);closeTransient();};
 // Rotating or zooming the globe must not close the layer panel; only the search popover.
 const interact=()=>{touched.current=true;setPanel(p=>p==='search'?null:p);};
 const flyTo=(lat,lon,distance=1.6,pin)=>{touched.current=true;setFlyTarget(t=>({key:(t?.key??0)+1,lat,lon,distance,pin}));};
 // Turn the globe to face a place without zooming.
 const faceTo=(lat,lon)=>setFlyTarget(t=>({key:(t?.key??0)+1,lat,lon,keepDistance:true}));
 // My location: fly there and pin the air readout on it.
 const locate=()=>{
  if(locating)return;setLocating(true);setLocateError('');closeTransient();
  locateUser().then(found=>{track('location/found');setUserLocation(found);setCity(null);flyTo(found.lat,found.lon,2.3,{mine:true});}).catch(e=>{track(`location/failed-${e?.code??'unknown'}`);setLocateError(locationMessage(e));}).finally(()=>setLocating(false));
 };
 const cameraRange=next=>setRange(current=>current.atMin===next.atMin&&current.atMax===next.atMax?current:{atMin:!!next.atMin,atMax:!!next.atMax});
 // A searched place gets the same all-values card as a tapped spot; hovering elsewhere does not replace it.
 const probeCard=readout&&!!probe&&(!panel||panel==='layers')&&(!!probe.pinned||!city);
 const cityCard=!!city&&!(probeCard&&probe.pinned)&&(!panel||panel==='layers');
 // A kept card (a searched place or a pinned spot) holds the globe's offset even while search briefly hides it.
 const stacked=!!city||(readout&&!!probe?.pinned);
 const viewShift=!EMBED&&desktop&&(panel==='layers'||stacked)?.14:0;
 // Phones: the cards sit over the lower globe, so the globe rises to centre in the space between the header and them.
 const stack=useRef(null),[viewLift,setViewLift]=useState(0),lifting=!EMBED&&!desktop&&stacked&&panel!=='layers';
 useEffect(()=>{
  const el=stack.current;if(!lifting||!el){setViewLift(0);return;}
  const measure=()=>{if(!el.firstElementChild)return;const top=el.getBoundingClientRect().top;setViewLift(Math.max(0,Math.round(window.innerHeight/2-(PHONE_HEADER+top)/2)));};
  const observer=new ResizeObserver(measure);observer.observe(el);window.addEventListener('resize',measure);measure();
  return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
 },[lifting]);
 // Nothing to wait for when no enabled layer has data at the time shown.
 const noLayers=!PAINT_LAYERS.some(l=>paint[l.id]?.enabled&&(!frameFields||frameFields.has(l.id)));
 const ready=opened||timedOut||(globeReady&&(airVisible||globalAir.status==='error'||noLayers));
 useEffect(()=>{if(ready)setOpened(true);},[ready]);
 // Once the globe is up, turn it to the viewer's region without asking: their exact spot (and marker) if location was
 // allowed earlier, otherwise a rough guess from their IP. Never asks, and never moves a globe they have already touched.
 useEffect(()=>{
  if(EMBED||!opened)return;let live=true;const controller=new AbortController();
  const face=place=>{if(live&&place&&!touched.current)faceTo(place.lat,place.lon);};
  locationPermission().then(state=>{
   if(!live)return;
   if(state==='granted')return locateUser().then(found=>{if(!live)return;setUserLocation(found);face(found);});
   return guessRegion(fetch,controller.signal).then(found=>{if(live&&found)setRegion(found);face(found);});
  }).catch(()=>{});
  return()=>{live=false;controller.abort();};
 },[opened]);
 const updatePaint=(id,change)=>{if(change.enabled)track(`layer/${id}`);setPaint(current=>({...current,[id]:{...current[id],...change}}));};
 // Counts taps that keep a readout (not hover, not the viewer's own location).
 // On phones a tapped spot also turns to the centre of the lifted globe, so the card never hides its pin.
 const probeChange=next=>{
  // A pinned spot shows its readout card, which the Cards panel would cover: pinning closes the panel.
  if(next?.pinned){setCity(null);if(!next.mine)setPanel(p=>p==='cards'?null:p);}
  if(next?.pinned&&!next.mine&&!next.centred){track('readout/pin');if(!desktop&&!EMBED)setFlyTarget(t=>({key:(t?.key??0)+1,lat:next.lat,lon:next.lon,keepDistance:true,pin:{centred:true}}));}
  setProbe(next);
 };
 return <main className={`atlas-app${EMBED?' is-embed':''}${OPTIONS.bg?' has-bg':''}${panel==='layers'?' layers-open':''}${picking&&ready?' is-picking':''} surface-view-${surface}`} aria-busy={!ready||undefined}>
  <div className="atlas-interface" inert={!ready?true:undefined}>
   <Globe home={homePoint(userLocation,region)} onProbe={probeChange} readout={readout} probeEnabled={readout&&panel!=='search'} hoverEnabled={hover} probeReset={probeReset} surface={surface} globalAir={globalAir.data} regionalAir={regionalAir} onDetail={setDetail} paint={paint} weatherData={weather.data} weatherSettings={weatherSettings} city={city} zoom={zoom} focus={focus} reset={reset} viewShift={viewShift} viewLift={viewLift} flyTarget={flyTarget} onCameraRange={cameraRange} onReady={()=>setGlobeReady(true)} onAirVisible={()=>setAirVisible(true)} onCity={chooseCity} onInteraction={interact} homeScale={OPTIONS.zoom} wheelModifier={EMBED} timeline={timeline} userLocation={userLocation} chromeInset={EMBED?0:CHROME_INSET}/>
   {!EMBED&&<>
   <header className="minimal-header">
    <button className="atlas-brand" aria-label="Return to overview" onClick={overview}><svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth=".8"/><ellipse cx="16" cy="16" rx="6" ry="12" stroke="currentColor" strokeWidth=".8" transform="rotate(35 16 16)"/><path d="M4 16h24" stroke="currentColor" strokeWidth=".8"/></svg><span>Who Owns the Air?</span></button>
    <nav aria-label="Explore the atlas">{cards&&DECK.length>0&&<button type="button" className="cards-trigger" aria-expanded={panel==='cards'} aria-label={`Cards, ${DECK.filter(c=>c.id in cards.collected).length} of ${DECK.length} collected`} onClick={()=>{clearProbe();setNow(Date.now());setPanel(p=>p==='cards'?null:'cards');}}><Cards size={16} weight="light"/><span>Cards</span><small key={shownCount} className="cards-count">{shownCount}/{DECK.length}</small></button>}<CitySearch open={panel==='search'} onOpenChange={open=>setPanel(open?'search':null)} onChoose={chooseCity} onLocate={locate}/>{!touch&&<ReadoutToggle on={hover} onChange={changeReadout}/>}<a className="about-trigger" href="study.html" aria-label="About the data"><Info size={16} weight="light"/><span>About</span></a></nav>
   </header>
   {panel==='cards'&&cards&&<CardsPanel key={clueFor??'cards'} deck={DECK} cards={cards} now={now} total={DECK.length} clueFor={clueFor} onClue={(id,steps)=>setCards(c=>openClue(c,id,steps))} onClose={()=>{setPanel(null);setClueFor(null);}} onOpen={card=>setViewing({card,variant:null})}
    saveLink={()=>`${location.origin}${location.pathname}?deck=${encodeDeck(Object.keys(cards.collected),ORDER)}`}/>}
   <div ref={stack} className="side-stack">
    {cityCard&&<AirComposition location={{lat:city.lat,lon:city.lon,pinned:true,name:city.name,country:city.country}} global={frameIndex>=0?{status:frameAir?'ready':'loading',data:frameAir}:globalAir} regional={frameIndex>=0?frameEurope:regionalAir} paint={paint} onClose={()=>setCity(null)}/>}
    {probeCard&&<AirComposition location={probe} global={frameIndex>=0?{status:frameAir?'ready':'loading',data:frameAir}:globalAir} regional={frameIndex>=0?frameEurope:regionalAir} paint={paint} onClose={clearProbe} footer={cardRow}/>}
   </div>
   <GlobalAirLegend surface={surface} onSurfaceChange={setSurface} panelOpen={panel==='layers'} onPanelChange={open=>{if(open){clearProbe();if(picking)finishPicking();}setPanel(open?'layers':null);}} onFlyTo={flyTo} detail={detail} regional={regionalAir} regionalError={regionalError} state={globalAir} paint={paint} weather={weather} weatherSettings={weatherSettings} onWeatherChange={(id,change)=>{if(change.enabled)track(`weather/${id}`);setWeatherSettings(current=>({...current,[id]:{...current[id],...change}}));}} onChange={updatePaint}/>
   {picking&&ready&&<LayerPicker paint={paint} onChange={updatePaint} onDone={finishPicking}/>}
   {release&&ready&&!picking&&!viewing&&!asking&&<WhatsNew onClose={()=>closeRelease('closed')} onCards={cards?()=>{closeRelease('cards');clearProbe();setPanel('cards');}:null}/>}
   {timeline&&<TimeBar timelines={timelines} mode={timeline.kind} onMode={changeMode}/>}
   <div className="minimal-zoom" role="group" aria-label="Globe view"><button aria-label="Reset globe view" onClick={overview}><ArrowCounterClockwise size={17} weight="light"/></button><button className={`locate-button${locating?' is-locating':''}${userLocation?' is-found':''}`} aria-label="Show my location" aria-busy={locating||undefined} onClick={()=>locate()}><GpsFix size={17} weight={userLocation?'regular':'light'}/></button><span/><button aria-label="Zoom in" disabled={range.atMin} onClick={()=>{setZoom(z=>z+1);}}><Plus size={17} weight="light"/></button><button aria-label="Zoom out" disabled={range.atMax} onClick={()=>{setZoom(z=>z-1);}}><Minus size={17} weight="light"/></button></div>
   <p className={`locate-status${locateError?' is-shown':''}`} role="status">{locateError}</p>
   </>}
  </div>
  {asking&&<CardQuestion key={asking.key} card={asking.card} variant={asking.variant} question={asking.question} total={DECK.length} deck={DECK} collected={cards?.collected??{}} foundAt={cards?.collected[asking.key]??null} month={asking.month} result={asking.result} foundCount={foundCount} onRecap={()=>setAsking(a=>a&&{...a,recapped:true})} onAnswer={answerCard} onClose={()=>setAsking(null)}/>}
  {viewing&&<CardViewer key={viewing.card.id} card={viewing.card} variant={viewing.variant} shared={!!viewing.shared} total={DECK.length} deck={DECK} collected={cards?.collected??{}} foundAt={cards?.collected[viewing.variant?variantKey(viewing.card.id,viewing.variant):viewing.card.id]??null} earned={cards?.earned[viewing.variant?variantKey(viewing.card.id,viewing.variant):viewing.card.id]??null}
   onClose={()=>setViewing(null)} onHunt={()=>{setClueFor(viewing.card.id);setViewing(null);clearProbe();setPanel('cards');}}/>}
  <Loader ready={ready} progress={progress} textureReady={globeReady} downloaded={globalAir.status!=='loading'} failed={globalAir.status==='error'}/>
 </main>;
}
const root=import.meta.hot?.data.root||createRoot(document.getElementById('root'));
if(import.meta.hot){import.meta.hot.data.root=root;import.meta.hot.accept();}
root.render(<App/>);
