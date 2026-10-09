import {displayWeight} from './fieldStats.js';
const DEG=Math.PI/180;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
// Zoom adds display samples, not new observations. Counts double per level so lattice pitch on screen
// stays in a narrow band (see detailLevel). The regional sets are the same lattice over the CAMS Europe box.
export const DOT_COUNTS=[16000,32000,64000,128000,256000,512000,1024000];
export const REGIONAL_DOT_COUNTS=[1024000,2048000,4096000];
export const REGIONAL_DOT_COUNT=REGIONAL_DOT_COUNTS.at(-1);
// Halftone constants (the shader mirrors them): radius is in units of the mean lattice spacing sqrt(4π/count).
export const MIN_SPACING_PX=7,FULL_RADIUS=.56,PLATE_OFFSET=.26,PLATE_PHASE=Math.PI/2,GOLDEN_PLATE=Math.PI*(3-Math.sqrt(5));

// Equal surface area per point, with no longitude convergence or repeated poles.
// A bounded patch is selected from the SAME spherical distribution.
export function sphereSamples(count,bounds=null) {
 const first=bounds?Math.max(0,Math.floor(count*(1-Math.sin(bounds.north*DEG))/2)):0;
 const last=bounds?Math.min(count,Math.ceil(count*(1-Math.sin(bounds.south*DEG))/2)):count;
 const samples=[];
 for(let i=first;i<last;i++){
  const y=1-2*(i+.5)/count,lat=Math.asin(y)/DEG;
  const lon=((i*GOLDEN_ANGLE/DEG+180)%360)-180;
  if(bounds&&(lat<bounds.south||lat>bounds.north||lon<bounds.west||lon>bounds.east))continue;
  const horizontal=Math.sqrt(1-y*y),theta=lon*DEG;
  samples.push(horizontal*Math.cos(theta),y,-horizontal*Math.sin(theta),lat,lon);
 }
 return new Float32Array(samples);
}

export function gridBounds(grid) {
 return {south:grid.latStart,north:grid.latStart+(grid.height-1)*grid.step,west:grid.lonStart,east:grid.lonStart+(grid.width-1)*grid.step};
}

export function sampleField(data,id,lat,lon) {
 const {width,height,step,latStart,lonStart}=data.grid,values=data.fields[id];
 const wrap=data.domain==='cams_global';
 let x=(lon-lonStart)/step;
 if(wrap)x=((x%width)+width)%width;
 else x=Math.max(0,Math.min(width-1,x));
 const y=Math.max(0,Math.min(height-1,(lat-latStart)/step));
 const x0=Math.floor(x),y0=Math.floor(y),x1=wrap?(x0+1)%width:Math.min(x0+1,width-1),y1=Math.min(y0+1,height-1),fx=x-x0,fy=y-y0;
 return (values[y0*width+x0]*(1-fx)+values[y0*width+x1]*fx)*(1-fy)+(values[y1*width+x0]*(1-fx)+values[y1*width+x1]*fx)*fy;
}

export const dotSpacing=count=>Math.sqrt(4*Math.PI/count);
export const spacingPx=(count,pxPerUnit)=>dotSpacing(count)*pxPerUnit;

// Densest level whose lattice pitch stays >= MIN_SPACING_PX device pixels, so dots have room to vary in size
// (and never go sub-pixel, which beats against the pixel grid). Hysteresis: up once the finer level clears
// 10 % over the minimum, down only 5 % under it.
export function detailLevel(pxPerUnit,previous=0,counts=DOT_COUNTS) {
 let l=Math.max(0,Math.min(counts.length-1,previous));
 while(l<counts.length-1&&spacingPx(counts[l+1],pxPerUnit)>=MIN_SPACING_PX*1.1)l++;
 while(l>0&&spacingPx(counts[l],pxPerUnit)<MIN_SPACING_PX*.95)l--;
 return l;
}

// Area-proportional halftone radius in spacing units: dot area is linear in value/range. Continuous to 0, no cutoff.
export const dotRadius=(fraction,maxRadius=FULL_RADIUS)=>maxRadius*Math.sqrt(Math.max(0,Math.min(1,fraction)));
// Sub-pixel discs (radius r below half a pixel, pix = pixel size in the same units) are drawn as a half-pixel disc
// scaled by (2r/pix)^2, so ink area stays pi*r^2 and the dot fades out smoothly instead of being dropped.
export const effectiveRadius=(r,pix)=>Math.max(r,pix/2);
export const peakCoverage=(r,pix)=>Math.min(1,(2*r/pix)**2);

// Each layer has a FIXED ink-plate offset from its catalogue index (golden-angle steps on a small circle), so
// toggling other layers never moves or resizes a layer's dots. Tangent plane east/north, in spacing units.
export const plateOffset=index=>[PLATE_OFFSET*Math.cos(PLATE_PHASE+GOLDEN_PLATE*index),PLATE_OFFSET*Math.sin(PLATE_PHASE+GOLDEN_PLATE*index)];

export const WEIGHT_SCALE=65535;

// Samples a field on the equal-area dot set. Positions are the exact lattice points and values come from the true
// sample lat/lon, so dots are fixed to the Earth. Lattice order is kept (no shuffle, no jitter).
// layers: [{id,range,slot,scale?}] (scale: fieldStats baseline scale for this dataset) where slot is the packed-weight channel (4 per attribute).
export function buildAirGeometry(data,layers,count,bounds=null,slots=layers.length) {
 const samples=sphereSamples(count,bounds),n=samples.length/5;
 const positions=new Float32Array(n*3),locations=new Float32Array(n*2);
 const weights=Array.from({length:Math.ceil(slots/4)},()=>new Uint16Array(n*4));
 const available=layers.filter(l=>data.fields[l.id]);
 for(let k=0;k<n;k++){
  const o=k*5,lat=samples[o+3],lon=samples[o+4],inv=1.002/Math.hypot(samples[o],samples[o+1],samples[o+2]);
  positions[k*3]=samples[o]*inv;positions[k*3+1]=samples[o+1]*inv;positions[k*3+2]=samples[o+2]*inv;
  locations[k*2]=lon;locations[k*2+1]=lat;
  for(const l of available){const v=displayWeight(sampleField(data,l.id,lat,lon),l.scale,l.range);weights[l.slot>>2][k*4+(l.slot&3)]=v>0?Math.round(v*WEIGHT_SCALE):0;}
 }
 return {positions,locations,weights,length:n};
}
