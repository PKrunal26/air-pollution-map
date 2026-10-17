import React from 'react';
import {CursorClick} from '@phosphor-icons/react';
import './styles/readout-toggle.css';
export default function ReadoutToggle({on,onChange,variant='header'}){
 return <button className={`readout-toggle readout-${variant}${on?' is-on':''}`} aria-pressed={on} aria-label="Hover readout" title={on?'Hover readout on: hover the globe for air composition; click a place to keep it':'Hover readout off: click a place to see its air'} onClick={()=>onChange(!on)}><CursorClick size={16} weight="light"/><span className="readout-label">Readout</span><span className="switch-track" aria-hidden="true"><span/></span></button>;
}
