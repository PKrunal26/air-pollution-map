import React,{useEffect,useMemo,useRef,useState} from 'react';
import {CaretDown,X} from '@phosphor-icons/react';
import {WHO_CAPTION,formatAirValue,formatCoordinates,sampleAirAt,whoComparison} from './airProbe';
import {placeNameAt,placeTitle} from './placeName';
import './styles/readouts.css';

const dateFormat=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
function Fields({fields,regional,keyId}){
 return <dl className="composition-fields">{fields.map(field=>{
  const who=whoComparison(field.id,field.value,field.unit);
  return <div key={field.id} className={field.id===keyId?'is-key':undefined}>
   <dt title={field.name}><span style={{background:field.colour}}/>{field.label}{regional&&field.source==='cams_global'&&<small>Global</small>}</dt>
   <dd>{who&&<span className={`who-chip who-${who.tone}`} title={`${who.text} the WHO 2021 ${who.basis} guideline of ${formatAirValue(who.level)} µg/m³`}>{who.text}<small>{who.label}</small></span>}<span className="composition-value">{formatAirValue(field.value)}</span><small>{field.unit|| (field.id==='aerosol_optical_depth'?'unitless':'index')}</small></dd>
  </div>;
 })}</dl>;
}

export default function AirComposition({location,global,regional,paint,onClose}){
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
 const primary=sample?.fields.filter(field=>field.group==='Pollutants'||paint[field.id]?.enabled)??[];
 const more=sample?.fields.filter(field=>!primary.some(row=>row.id===field.id))??[];
 const keyId=(primary.find(field=>field.id==='pm2_5')??primary[0])?.id;
 const hasWho=primary.some(field=>whoComparison(field.id,field.value,field.unit));
 const coords=formatCoordinates(location.lat,location.lon);
 return <section ref={card} className={`air-composition${location.pinned?' is-pinned':''}${expanded?' is-expanded':''}`} aria-label={`Air composition at ${placeTitle(place)}, ${coords}`} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();dismiss();}}}>
  <div className="composition-heading"><div><p className="composition-kicker">{location.pinned?'Selected location':'Under your cursor'}</p><h2>{placeTitle(place)}</h2></div>{location.pinned&&<button ref={close} className="icon-button composition-close" aria-label="Close air composition" onClick={dismiss}><X size={17} weight="light"/></button>}</div>
  <p className="composition-location">{coords}</p>
  {sample?<>
   <p className="composition-caption">{hasWho?WHO_CAPTION:'Modelled air composition'}</p>
   <div className="composition-scroll"><Fields fields={primary} regional={sample.regional} keyId={keyId}/>
    {location.pinned&&more.length>0&&<details className="composition-more"><summary>More fields <span>{more.length}</span></summary><Fields fields={more} regional={sample.regional}/></details>}
    <footer className="composition-footer"><span>{dateFormat.format(new Date(sample.validAt))} UTC · Saved snapshot</span><span>{sample.regional?'CAMS Europe · ~11 km; global fields ~45 km':'CAMS Global · ~45 km'}</span>{!location.pinned&&<span className="composition-pin">Click to keep this location{more.length>0?' and see all fields':''}</span>}</footer>
   </div>
   {location.pinned&&sample.fields.length>1&&<button className="composition-expand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Fewer values':'All values'}<CaretDown size={14} weight="bold"/></button>}
  </>:<p className="composition-empty" role="status">{global.status==='error'?'Air data is unavailable here. Reload to retry.':'Loading air composition…'}</p>}
 </section>;
}
