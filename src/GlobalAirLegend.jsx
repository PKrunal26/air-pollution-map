import React from 'react';
import {PAINT_LAYERS} from './paintLayers';
const format=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
export default function GlobalAirLegend({state,paint,onChange,detail,regional}) {
 const data=state.data;
 return <section className="paint-palette" aria-label="Pollution paint layers">
  <div className="paint-heading"><span>Atmosphere</span><span>µg/m³</span></div>
  {PAINT_LAYERS.map(layer=>{const setting=paint[layer.id];return <div className={`paint-row pigment-${layer.id}${setting.enabled?' is-on':''}`} key={layer.id}>
   <div className="paint-row-top"><button aria-label={`Toggle ${layer.name} layer`} aria-pressed={setting.enabled} disabled={!data} onClick={()=>onChange(layer.id,{enabled:!setting.enabled})}><span className="paint-swatch" aria-hidden="true"/><span>{layer.label}</span></button><span className="paint-scale">0 — {layer.range}+</span></div>
   <label className="paint-strength"><span>Paint strength</span><input type="range" min="0" max="100" step="5" value={setting.strength} disabled={!data||!setting.enabled} aria-label={`${layer.name} paint strength`} onChange={e=>onChange(layer.id,{strength:Number(e.target.value)})}/><output>{setting.strength}%</output></label>
  </div>;})}
  {data?<><p className="paint-meta">Modeled · {format.format(new Date(data.validAt))} UTC</p><p className="paint-note">{detail==='regional'?'Europe · ~11 km · regional model':`Global · ~45 km · ${detail==='overview'?'overview':detail==='medium'?'more detail':'native detail'}`}</p>{regional&&<p className="paint-note">Zoom reveals ~11 km detail over Europe</p>}</>:<p className="paint-meta" role="status">{state.status==='error'?'Global layers unavailable':'Loading global layers…'}</p>}
 </section>;
}
