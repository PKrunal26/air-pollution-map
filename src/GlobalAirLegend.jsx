import React from 'react';
const format=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'});
export default function GlobalAirLegend({state,visible,onToggle}) {
 const data=state.data;
 return <section className="global-air-legend" aria-label="Global PM2.5 layer">
  <div className="global-layer-title"><button aria-pressed={visible} onClick={onToggle} disabled={!data}><span className={visible?'layer-indicator on':'layer-indicator'}/>Global PM₂.₅</button><span>µg/m³</span></div>
  {data?<><div className={`global-colour-scale${visible?'':' hidden-scale'}`} aria-hidden="true"/><div className="global-scale-values"><span>0</span><span>10</span><span>35</span><span>100+</span></div><p>Modeled snapshot · {format.format(new Date(data.validAt))} UTC</p><p>5° samples · interpolated display</p></>:<p role="status">{state.status==='error'?'Global layer unavailable':'Loading global layer…'}</p>}
 </section>;
}
