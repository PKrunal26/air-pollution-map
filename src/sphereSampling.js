const DEG=Math.PI/180;
const GOLDEN_ANGLE=Math.PI*(3-Math.sqrt(5));
// Keep the overview richly inked; zoom adds display samples, not new observations.
export const DOT_COUNTS=[256000,512000,1024000];
export const REGIONAL_DOT_COUNT=4096000;

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

export function detailLevel(distance,previous=0) {
 // Hysteresis keeps trackpad movement near a boundary from changing grids repeatedly.
 if(previous===0&&distance<2.95)return 1;
 if(previous===1&&distance>3.15)return 0;
 if(previous===1&&distance<2.05)return 2;
 if(previous===2&&distance>2.25)return 1;
 return previous;
}
