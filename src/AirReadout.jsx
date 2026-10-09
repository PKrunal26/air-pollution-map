import React,{useEffect,useState} from 'react';
import {ArrowClockwise} from '@phosphor-icons/react';
import {AIR_SOURCE,fetchAirQuality} from './airQuality';

const cache = new Map();
const REFRESH_MS = 15 * 60 * 1000;
const timeFormat = new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'});

export default function AirQuality({city,onUpdate}) {
 const [request,setRequest]=useState(0);
 const [state,setState]=useState({cityId:null,status:'loading',data:null});
 useEffect(()=>{onUpdate?.(state.cityId===city.id?state:{cityId:city.id,status:'loading',data:null});},[state,city.id,onUpdate]);
 useEffect(()=>{
  const controller=new AbortController();
  let active=true;
  const saved=cache.get(city.id) ?? null;
  setState({cityId:city.id,status:'loading',data:saved});
  const timeout=setTimeout(()=>controller.abort(),12000);
  fetchAirQuality(city,{signal:controller.signal}).then(data=>{
   if(!active)return;
   cache.set(city.id,data);
   setState({cityId:city.id,status:'ready',data});
  }).catch(()=>{
   if(active)setState({cityId:city.id,status:'error',data:saved});
  }).finally(()=>clearTimeout(timeout));
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[city.id,city.lat,city.lon,request]);
 useEffect(()=>{
  const refresh=()=>{if(document.visibilityState==='visible')setRequest(n=>n+1);};
  const interval=setInterval(refresh,REFRESH_MS);
  const onVisible=()=>{const saved=cache.get(city.id);if(!saved || Date.now()-saved.fetchedAt>=REFRESH_MS)refresh();};
  document.addEventListener('visibilitychange',onVisible);
  return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);};
 },[city.id]);
 // A city switch must never display the previous city's estimate while its effect starts.
 const current=state.cityId===city.id?state:{status:'loading',data:null};
 const {data,status}=current;
 const old=data && Date.now()-data.validAt>3*60*60*1000;
 return <section className="air-readout" aria-label={`Air quality around ${city.name}`}>
  <div className="air-place"><span>{city.name}</span><small>{city.country}</small></div>
  <p className="plume-note">Current city estimate</p>
  <div className="air-reading" aria-live="polite" aria-atomic="true">
   {data?<><div className="air-value"><span className="air-pollutant">PM₂.₅</span><strong>{data.pm25.toFixed(1)}</strong><span className="air-unit">µg/m³</span></div><p className="air-time">Modeled · {timeFormat.format(new Date(data.validAt))} UTC</p>{status==='error'?<p className="air-status">Refresh unavailable · saved estimate</p>:old?<p className="air-status">Older estimate · check the time above</p>:status==='loading'?<p className="air-status">Updating…</p>:null}</>:<p className="air-empty">{status==='error'?'Air-quality data unavailable':'Loading PM₂.₅…'}</p>}
  </div>
  <div className="air-credit"><span><a href={AIR_SOURCE.url} target="_blank" rel="noreferrer">CAMS</a> via <a href={AIR_SOURCE.apiDocumentation} target="_blank" rel="noreferrer">Open-Meteo</a><span className="air-resolution"> · ~45 km model</span></span><button aria-label="Refresh air-quality data" title="Refresh air-quality data" disabled={status==='loading'} onClick={()=>setRequest(n=>n+1)}><ArrowClockwise size={14}/></button></div>
 </section>;
}
