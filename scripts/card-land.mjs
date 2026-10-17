// Land outline for card art: prints one SVG path (fill-ready) for a lon/lat crop drawn into a W×H box.
// Usage: node scripts/card-land.mjs <lon0> <lon1> <lat0> <lat1> <W> <H>
// Longitudes are taken relative to the crop centre, so coastlines crossing the date line never streak across the box.
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {feature} from 'topojson-client';

const [lon0,lon1,lat0,lat1,W,H]=process.argv.slice(2).map(Number);
if(![lon0,lon1,lat0,lat1,W,H].every(Number.isFinite)){console.error('usage: card-land.mjs lon0 lon1 lat0 lat1 W H');process.exit(2);}
const topo=JSON.parse(readFileSync(createRequire(import.meta.url).resolve('world-atlas/land-50m.json'),'utf8'));
const land=feature(topo,topo.objects.land),geoms=land.features?land.features.map(f=>f.geometry):[land.geometry];
const polys=geoms.flatMap(g=>g.type==='Polygon'?[g.coordinates]:g.coordinates);
const mid=(lon0+lon1)/2,wrap=lo=>lo-mid>180?lo-360:lo-mid<-180?lo+360:lo;
const near=([lo,la])=>{const x=wrap(lo);return x>lon0-5&&x<lon1+5&&la>lat0-5&&la<lat1+5;};
const px=([lo,la])=>[(wrap(lo)-lon0)/(lon1-lon0)*W,(lat1-la)/(lat1-lat0)*H];
// Compact path: points closer than TOL px to the last kept one are dropped (invisible at this size), coordinates are
// rounded to 0.1 px and written relative to the previous point, without trailing zeros.
const TOL=0.8,r=v=>Math.round(v*10)/10,num=v=>String(v).replace(/^(-?)0\./,'$1.');
const pair=(x,y)=>num(x)+(y<0?'':',')+num(y);
let d='';
for(const poly of polys)for(const ring of poly){
 if(!ring.some(near))continue;
 const pts=ring.map(px),kept=[pts[0]];
 for(const p of pts.slice(1))if(Math.hypot(p[0]-kept.at(-1)[0],p[1]-kept.at(-1)[1])>=TOL)kept.push(p);
 if(kept.length<3)continue;
 let [x,y]=[r(kept[0][0]),r(kept[0][1])];d+='M'+pair(x,y)+'l';
 d+=kept.slice(1).map(([px_,py])=>{const nx=r(px_),ny=r(py),s=pair(r(nx-x),r(ny-y));x=nx;y=ny;return s;}).join(' ')+'z';
}
process.stdout.write(d);
