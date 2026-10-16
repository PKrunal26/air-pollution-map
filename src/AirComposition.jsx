import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CaretDown,X} from '@phosphor-icons/react';
import {formatAirValue,formatCoordinates,sampleAirAt,whoComparison,whoTitle} from './airProbe';
import {placeNameAt,placeTitle} from './placeName';
import './styles/readouts.css';

// who=false for monthly means: WHO 24-hour guideline ratios do not apply to a month's average.
function Fields({fields,regional,keyId,who:showWho=true}){
 return <dl className="composition-fields">{fields.map(field=>{
  const who=showWho&&whoComparison(field.id,field.value,field.unit);
  const over=who&&who.tone!=='ok';
  return <div key={field.id} className={field.id===keyId?'is-key':undefined}>
   <dt title={field.name}><span style={{background:field.colour}}/>{field.label}{regional&&field.source==='cams_global'&&<small>Global</small>}</dt>
   <dd>{over&&<span className={`who-chip who-${who.tone}`} title={whoTitle(who)}>{who.flag}</span>}<span className="composition-value">{formatAirValue(field.value)}</span><small>{field.unit|| (field.id==='aerosol_optical_depth'?'unitless':'index')}</small></dd>
  </div>;
 })}</dl>;
}

// footer: extra content for a pinned card (the event-card row).
export default function AirComposition({location,global,regional,paint,onClose,footer=null}){
 const card=useRef(null),close=useRef(null);
 const [expanded,setExpanded]=useState(false);
 const sample=useMemo(()=>sampleAirAt(global.data,regional,location.lat,location.lon),[global.data,regional,location.lat,location.lon]);
 const place=useMemo(()=>placeNameAt(location.lat,location.lon),[location.lat,location.lon]);
 useEffect(()=>{
  if(!location.pinned)return;
  const frame=requestAnimationFrame(()=>close.current?.focus({preventScroll:true}));
  return()=>cancelAnimationFrame(frame);
 },[location.pinned]);
 useEffect(()=>{if(!location.pinned)setExpanded(false);},[location.pinned]);
 const dismiss=()=>{const globe=card.current?.closest('main')?.querySelector('.globe-host');onClose();globe?.focus({preventScroll:true});};
 // Only the layers the viewer has on; the rest wait under More fields. With none on, the common pollutants stand in.
 const chosen=sample?.fields.filter(field=>paint[field.id]?.enabled)??[];
 const primary=chosen.length?chosen:sample?.fields.filter(field=>field.group==='Pollutants')??[];
 const more=sample?.fields.filter(field=>!primary.some(row=>row.id===field.id))??[];
 const keyId=(primary.find(field=>field.id==='pm2_5')??primary[0])?.id;
 const monthly=global.data?.statistic==='monthly mean';
 const coords=formatCoordinates(location.lat,location.lon);
 const title=location.name?[location.name,location.country].filter(Boolean).join(', '):placeTitle(place);
 return <section ref={card} className={`air-composition${location.pinned?' is-pinned':''}${expanded?' is-expanded':''}`} aria-label={`Air composition at ${title}, ${coords}`} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();dismiss();}}}>
  <div className="composition-heading"><div><h2>{title}</h2><p className="composition-location">{location.mine?'Your location · ':''}{coords}</p></div>{location.pinned&&<button ref={close} className="icon-button composition-close" aria-label="Close air composition" onClick={dismiss}><X size={17} weight="light"/></button>}</div>
  {sample?<>
   <div className="composition-scroll"><Fields fields={primary} regional={sample.regional} keyId={keyId} who={!monthly}/>
    {location.pinned&&more.length>0&&<details className="composition-more"><summary>More fields <span>{more.length}</span></summary><Fields fields={more} regional={sample.regional} who={!monthly}/></details>}
    {!location.pinned&&<p className="composition-pin">Click to keep{more.length>0?' and see all fields':''}</p>}
   </div>
   {location.pinned&&sample.fields.length>1&&<button className="composition-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Fewer values':'All values'}<CaretDown size={14} weight="bold"/></button>}
  </>:<p className="composition-empty" role="status">{global.status==='error'?'Air data is unavailable here. Reload to retry.':'Loading air composition…'}</p>}
  {location.pinned&&footer}
 </section>;
}
