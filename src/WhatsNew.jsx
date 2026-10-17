import React,{useEffect,useRef} from 'react';
import {RELEASE} from './releaseNotes';
import './styles/release-notes.css';

// What's new: a centred dialog over the dimmed globe. "Find a card" opens the Cards panel; Close, Escape or a tap
// outside dismisses it. Focus starts on the first button, stays inside, and returns where it was.
export default function WhatsNew({onClose,onCards}){
 const box=useRef(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const opener=document.activeElement;
  box.current?.querySelector('button')?.focus({preventScroll:true});
  const key=e=>{if(e.key==='Escape'){e.stopPropagation();close.current();}};
  document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);opener?.focus?.({preventScroll:true});};
 },[]);
 const trap=e=>{
  if(e.key!=='Tab')return;
  const items=[...box.current.querySelectorAll('button')],first=items[0],last=items.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 };
 return <div className="release-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={box} className="release-notes" role="dialog" aria-modal="true" aria-labelledby="release-title" onKeyDown={trap}>
   <h2 id="release-title">What's new</h2>
   <p className="release-date">{RELEASE.date}</p>
   <ul>{RELEASE.items.map(item=><li key={item.title}><h3>{item.title}</h3><p>{item.text}</p></li>)}</ul>
   <div className="release-actions">
    {onCards&&<button type="button" className="is-primary" onClick={onCards}>Find a card</button>}
    <button type="button" onClick={onClose}>Close</button>
   </div>
  </section>
 </div>;
}
