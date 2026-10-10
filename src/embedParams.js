import catalog from './camsFields.json' with {type:'json'};

export const SURFACES=['charcoal','white','satellite'];
export const ZOOM_MIN=.1,ZOOM_MAX=4;
const FIELD_IDS=new Set(catalog.map(l=>l.id));

// URL options for embedding the globe (e.g. in an iframe). Unknown or malformed values are ignored.
// embed=1 hides all interface chrome; layers=<ids> sets exactly which layers start on; surface and bg set the look.
// zoom=<n> frames the globe so its diameter is n × the frame height at any frame size (default framing is about 0.77;
// above 1 the globe overfills the frame vertically). Accepted range ZOOM_MIN–ZOOM_MAX; other values are ignored.
export function parseEmbedParams(search=''){
 const params=new URLSearchParams(search);
 const embed=['1','true','yes'].includes((params.get('embed')||'').toLowerCase());
 const ids=params.has('layers')?[...new Set(params.get('layers').split(',').map(s=>s.trim()).filter(id=>FIELD_IDS.has(id)))]:[];
 const surface=(params.get('surface')||'').toLowerCase();
 const bg=(params.get('bg')||'').replace(/^#/,'');
 const zoomText=(params.get('zoom')||'').trim(),zoom=zoomText?Number(zoomText):NaN;
 return {
  embed,
  layers:ids.length?ids:null,
  surface:SURFACES.includes(surface)?surface:null,
  zoom:Number.isFinite(zoom)&&zoom>=ZOOM_MIN&&zoom<=ZOOM_MAX?zoom:null,
  bg:/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(bg)?`#${bg.toLowerCase()}`:null,
 };
}

// Paint settings with exactly `layers` enabled (default strengths kept); null keeps the defaults.
export function applyLayerSelection(paint,layers){
 if(!layers)return paint;
 return Object.fromEntries(Object.entries(paint).map(([id,s])=>[id,{...s,enabled:layers.includes(id)}]));
}

// Camera distance (Earth radius = 1) at which the globe's diameter is `zoom` × the frame height, for a vertical fov in degrees.
export function homeDistanceForZoom(zoom,fov){
 const k=zoom*Math.tan(fov*Math.PI/360);
 return Math.sqrt(1+1/(k*k));
}
