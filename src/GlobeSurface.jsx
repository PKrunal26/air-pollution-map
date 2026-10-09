import React from 'react';
const options=[{id:'satellite',label:'Satellite'},{id:'white',label:'White'},{id:'charcoal',label:'Charcoal'}];
export default function GlobeSurface({value,onChange}) {
 return <fieldset className="globe-surface"><legend>Globe style</legend><div className="surface-seg">{options.map(option=><button key={option.id} aria-label={`${option.label} globe`} aria-pressed={value===option.id} onClick={()=>onChange(option.id)}><span className={`surface-swatch surface-${option.id}`} aria-hidden="true"/>{option.label}</button>)}</div></fieldset>;
}
