import React,{useEffect,useRef} from 'react';
import {Check} from '@phosphor-icons/react';
import {PAINT_LAYERS} from './paintLayers';
import {PICKER_LAYERS} from './onboarding';
import './styles/layer-picker.css';

// First-visit picker: toggles apply to the globe immediately; Show map (or Escape) keeps the selection and closes.
export default function LayerPicker({paint,onChange,onDone}){
 const first=useRef(null);
 useEffect(()=>{first.current?.focus({preventScroll:true});const key=e=>{if(e.key==='Escape')onDone();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onDone]);
 const count=PICKER_LAYERS.filter(([id])=>paint[id]?.enabled).length;
 return <section className="layer-picker" role="dialog" aria-labelledby="picker-title" aria-describedby="picker-note">
  <h2 id="picker-title">What would you like to see?</h2>
  <p id="picker-note">Each pollutant is printed in its own colour. You can change this later in Layers.</p>
  <div className="picker-options" role="group" aria-label="Pollutants">
   {PICKER_LAYERS.map(([id,hint],i)=>{const layer=PAINT_LAYERS.find(l=>l.id===id),on=!!paint[id]?.enabled;
    return <button key={id} ref={i===0?first:null} className={on?'is-on':''} aria-pressed={on} style={{'--pigment':layer.colour}} onClick={()=>onChange(id,{enabled:!on})}>
     <span className="picker-swatch" aria-hidden="true">{on&&<Check size={11} weight="bold"/>}</span>
     <span className="picker-text"><strong>{layer.name}</strong><small>{hint}</small></span>
    </button>;})}
  </div>
  <div className="picker-actions">
   <span>{count===0?'Pick at least one':`${count} selected`}</span>
   <button className="picker-done" disabled={count===0} onClick={onDone}>Show map</button>
  </div>
 </section>;
}
