import React,{useEffect,useRef,useSyncExternalStore} from 'react';
import {Play,Pause} from '@phosphor-icons/react';
import {nearestFrame} from './airFrames';
import {track} from './analytics';
import './styles/time-bar.css';

const dayFormat=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
const hourFormat=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'});
const monthFormat=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
const MODES={forecast:{label:'Today',name:'Today and the next 2 days, every 3 hours'},history:{label:'Monthly',name:'Monthly averages since 2022'}};
const noop=()=>()=>{};

// Two time bars stacked like cards: the one in front plays and scrubs; the other peeks out behind it, and clicking it
// brings it to the front. Monthly (history since 2022) is in front by default; Today is the 48-hour forecast.
// The thumb follows playback through a ref (no re-render per animation frame); the label shows the nearest real frame.
export default function TimeBar({timelines,mode,onMode}){
 const timeline=timelines[mode],other=mode==='history'?'forecast':'history',behind=timelines[other];
 useSyncExternalStore(timeline.subscribe,()=>timeline.version);
 useSyncExternalStore(behind?.subscribe??noop,()=>behind?.version??0);
 const toggle=()=>{if(!timeline.playing)track(`time/play-${mode}`);timeline.toggle();};
 const range=useRef(null),{count,manifest}=timeline,frames=manifest.frames,history=mode==='history';
 const index=nearestFrame(timeline.position,count),time=new Date(frames[index].validAt);
 const text=history?monthFormat.format(time):`${dayFormat.format(time)} ${hourFormat.format(time)} UTC`;
 useEffect(()=>{
  let frame;const follow=()=>{if(range.current&&document.activeElement!==range.current)range.current.value=String(timeline.position);frame=requestAnimationFrame(follow);};
  follow();return()=>cancelAnimationFrame(frame);
 },[timeline]);
 const toggleRef=useRef(toggle);toggleRef.current=toggle;
 useEffect(()=>{
  // Space plays/pauses unless focus is in a control that uses it, or a dialog (a card) is open over the globe.
  const key=e=>{if(e.key!==' '||e.metaKey||e.ctrlKey||e.altKey)return;const t=e.target;if(t.closest?.('input,textarea,select,button,[contenteditable],[role="switch"]')||document.querySelector('[aria-modal="true"]'))return;e.preventDefault();toggleRef.current();};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[]);
 // Marks at midnight UTC (forecast) or each January (history).
 const marks=frames.map((f,i)=>({i,d:new Date(f.validAt)})).filter(({d})=>history?d.getUTCMonth()===0:d.getUTCHours()===0);
 // What the card behind shows: its name on the left, the range it covers on the right.
 const span=line=>{const f=line.manifest.frames,a=new Date(f[0].validAt),b=new Date(f.at(-1).validAt),fmt=line.kind==='history'?monthFormat:dayFormat;return `${fmt.format(a)} – ${fmt.format(b)}`;};
 return <div className={`time-bar${timeline.playing?' is-playing':''}${behind?' has-behind':''}`} role="group" aria-label={MODES[mode].name}>
  {behind&&<button type="button" className="time-behind" onClick={()=>onMode(other)} aria-label={`Show ${MODES[other].label}: ${span(behind)}`} title={MODES[other].name}>
   <span>{MODES[other].label}</span><i aria-hidden="true"/><small>{span(behind)}</small>
  </button>}
  <button className="time-play" onClick={toggle} disabled={timeline.failed} aria-label={timeline.playing?'Pause':`Play ${MODES[mode].name.toLowerCase()}`} title={timeline.failed?'Frames unavailable':undefined}>{timeline.playing?<Pause size={14} weight="fill"/>:<Play size={14} weight="fill"/>}</button>
  <p className="time-label" aria-live="off">{history?<>{monthFormat.format(time)} <small>monthly mean</small></>:<><span>{dayFormat.format(time)}</span> {hourFormat.format(time)} <small>UTC</small></>}</p>
  <div className="time-track">
   <input ref={range} type="range" min="0" max={count-1} step="any" defaultValue={timeline.position} aria-label={history?'Month':'Hour'} aria-valuetext={text}
    onPointerDown={()=>timeline.pause()} onInput={e=>timeline.seek(Number(e.target.value))} onPointerUp={e=>timeline.seek(Math.round(Number(e.target.value)))}
    onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();timeline.step(-1);}if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();timeline.step(1);}}}/>
   <div className="time-ticks" aria-hidden="true">{marks.map(m=><span key={m.i} style={{left:`${m.i/(count-1)*100}%`}}/>)}</div>
  </div>
 </div>;
}
