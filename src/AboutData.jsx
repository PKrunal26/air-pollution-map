import React,{useEffect,useRef,useState} from 'react';
import {X} from '@phosphor-icons/react';
import './styles/search-about.css';
// About opens the data study page (public/study.html) in place, so the globe stays loaded behind it.
export default function AboutData({open,onClose,closeRef}){
 const [loaded,setLoaded]=useState(false),frame=useRef(null);
 useEffect(()=>{if(open)setLoaded(true);},[open]);
 useEffect(()=>{
  const close=e=>{if(e.source===frame.current?.contentWindow&&e.data?.type==='air-atlas:close-about')onClose();};
  window.addEventListener('message',close);return()=>window.removeEventListener('message',close);
 },[onClose]);
 return <div className={`modal-backdrop${open?' is-open':''}`} aria-hidden={!open} inert={!open?true:undefined} onClick={onClose}><section className="minimal-about about-study" role="dialog" aria-modal="true" aria-label="About Air Atlas and its data" onClick={e=>e.stopPropagation()}>
  <button ref={closeRef} className="modal-close" aria-label="Close about" onClick={onClose}><X size={20} weight="light"/></button>
  {loaded&&<iframe ref={frame} src="study.html" title="Air Atlas data study"/>}
 </section></div>;
}
