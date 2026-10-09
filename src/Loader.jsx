import React,{useEffect,useState} from 'react';
import './styles/shell.css';

const mb=bytes=>(bytes/1048576).toFixed(1);
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// Full-screen on-brand overlay. `progress` is {loaded,total} of the global air download; `textureReady` the Earth texture.
export default function Loader({ready,progress,textureReady,downloaded,failed}){
 const [gone,setGone]=useState(false);
 useEffect(()=>{
  if(!ready)return;
  if(reduced()){setGone(true);return;}
  const timer=setTimeout(()=>setGone(true),560);
  return()=>clearTimeout(timer);
 },[ready]);
 if(gone)return null;
 const {loaded=0,total=null}=progress||{};
 const air=ready||failed||downloaded?1:total?Math.min(1,loaded/total):0;
 const fraction=ready?1:Math.min(.98,air*.8+(textureReady?.1:0)+(downloaded?.07:0));
 const label=failed?'Air data unavailable · opening the globe':ready?'Ready':downloaded?(textureReady?'Drawing the atmosphere…':'Preparing the globe'):loaded&&total?`Loading air data · ${mb(loaded)} / ${mb(total)} MB`:loaded?`Loading air data · ${mb(loaded)} MB`:'Loading air data';
 return <div className={`loader${ready?' is-leaving':''}`} onAnimationEnd={e=>{if(e.target===e.currentTarget&&ready)setGone(true);}} role="status" aria-live="polite">
  <div className="loader-mark">
   <svg width="88" height="88" viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth=".5"/><path d="M4 16h24M6.1 10.5h19.8M6.1 21.5h19.8" stroke="currentColor" strokeWidth=".4"/><g transform="rotate(35 16 16)"><ellipse className="loader-meridian" cx="16" cy="16" rx="6" ry="12" stroke="currentColor" strokeWidth=".5"/><ellipse className="loader-meridian loader-meridian-2" cx="16" cy="16" rx="6" ry="12" stroke="currentColor" strokeWidth=".5"/></g></svg>
  </div>
  <p className="loader-name">Air Atlas</p>
  <div className="loader-bar" aria-hidden="true"><span style={{transform:`scaleX(${fraction})`}}/></div>
  <p className="loader-text">{label}</p>
 </div>;
}
