import React,{useEffect,useRef,useState} from 'react';
import CardView from './CardView';
import ShareButton from './ShareButton';

// One card, large and flippable: a card you hold, or a card someone shared with you (shared: you do not get it).
export default function CardViewer({card,variant=null,foundAt=null,earned=null,total,shared=false,onClose,onHunt}){
 const [flipped,setFlipped]=useState(false),box=useRef(null),close=useRef(onClose);close.current=onClose;
 // Runs once per opening: the parent passes a new onClose on every render.
 useEffect(()=>{
  const opener=document.activeElement;box.current?.querySelector('button')?.focus({preventScroll:true});
  const escape=e=>{if(e.key==='Escape'){e.stopPropagation();close.current();}};
  document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('keydown',escape,true);opener?.focus?.({preventScroll:true});};
 },[]);
 return <div className="card-question-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={box} className="card-viewer" role="dialog" aria-modal="true" aria-label={card.name}>
   <CardView card={card} variant={variant} flipped={flipped} onFlip={()=>setFlipped(v=>!v)} foundAt={foundAt} earned={earned} total={total}/>
   <p className="card-viewer-note">{shared?'Someone shared this card. Find it on the globe to collect your own.':'Tap the card to flip it.'}</p>
   <div className="card-question-actions">
    {shared&&onHunt&&<button type="button" className="is-primary" onClick={onHunt}>Hunt for this card</button>}
    {!shared&&<ShareButton card={card} variant={variant}/>}
    <button type="button" onClick={onClose}>Close</button>
   </div>
  </section>
 </div>;
}
