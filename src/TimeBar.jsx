import React,{useEffect,useRef,useSyncExternalStore} from 'react';
import {Play,Pause} from '@phosphor-icons/react';
import {nearestFrame} from './airFrames';
import {track} from './analytics';
import './styles/time-bar.css';

const dayFormat=new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
const hourFormat=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'});
const monthFormat=new Intl.DateTimeFormat('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
const MODES={forecast:{label:'48 h',name:'48-hour forecast'},history:{label:'History',name:'Monthly means since 2022'}};

// Play/pause, the frame time, a scrubber and the mode switch (48-hour forecast or monthly history).
// The thumb follows playback through a ref (no re-render per animation frame); the label shows the nearest real frame.
export default function TimeBar({timeline,mode,modes,onMode}){
 useSyncExternalStore(timeline.subscribe,()=>timeline.version);
 const toggle=()=>{if(!timeline.playing)track(`time/play-${mode}`);timeline.toggle();};
 const range=useRef(null),{count,manifest}=timeline,frames=manifest.frames,history=mode==='history';
 const index=nearestFrame(timeline.position,count),time=new Date(frames[index].validAt);
 const text=history?monthFormat.format(time):`${dayFormat.format(time)} ${hourFormat.format(time)} UTC`;
 useEffect(()=>{
  let frame;const follow=()=>{if(range.current&&document.activeElement!==range.current)range.current.value=String(timeline.position);frame=requestAnimationFrame(follow);};
  follow();return()=>cancelAnimationFrame(frame);
 },[timeline]);
 useEffect(()=>{
  // Space plays/pauses unless focus is in a control that uses it.
  const key=e=>{if(e.key!==' '||e.metaKey||e.ctrlKey||e.altKey)return;const t=e.target;if(t.closest?.('input,textarea,select,button,[contenteditable],[role="switch"]'))return;e.preventDefault();toggle();};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[timeline]);
 // Marks at midnight UTC (forecast) or each January (history).
 const marks=frames.map((f,i)=>({i,d:new Date(f.validAt)})).filter(({d})=>history?d.getUTCMonth()===0:d.getUTCHours()===0);
 return <div className={`time-bar${timeline.playing?' is-playing':''}`} role="group" aria-label={MODES[mode].name}>
  <button className="time-play" onClick={toggle} disabled={timeline.failed} aria-label={timeline.playing?'Pause':`Play ${MODES[mode].name.toLowerCase()}`} title={timeline.failed?'Frames unavailable':undefined}>{timeline.playing?<Pause size={14} weight="fill"/>:<Play size={14} weight="fill"/>}</button>
  <p className="time-label" aria-live="off">{history?<>{monthFormat.format(time)} <small>monthly mean</small></>:<><span>{dayFormat.format(time)}</span> {hourFormat.format(time)} <small>UTC</small></>}</p>
  <div className="time-track">
   <input ref={range} type="range" min="0" max={count-1} step="any" defaultValue={timeline.position} aria-label={history?'Month':'Forecast hour'} aria-valuetext={text}
    onPointerDown={()=>timeline.pause()} onInput={e=>timeline.seek(Number(e.target.value))} onPointerUp={e=>timeline.seek(Math.round(Number(e.target.value)))}
    onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();timeline.step(-1);}if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();timeline.step(1);}}}/>
   <div className="time-ticks" aria-hidden="true">{marks.map(m=><span key={m.i} style={{left:`${m.i/(count-1)*100}%`}}/>)}</div>
  </div>
  {modes.length>1&&<div className="time-modes" role="group" aria-label="Time range">{modes.map(id=><button key={id} aria-pressed={id===mode} title={MODES[id].name} onClick={()=>id!==mode&&onMode(id)}>{MODES[id].label}</button>)}</div>}
 </div>;
}
