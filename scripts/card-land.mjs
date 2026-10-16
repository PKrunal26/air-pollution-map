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
const px=([lo,la])=>`${((wrap(lo)-lon0)/(lon1-lon0)*W).toFixed(1)},${((lat1-la)/(lat1-lat0)*H).toFixed(1)}`;
let d='';
for(const poly of polys)for(const ring of poly)if(ring.some(near))d+='M'+ring.map(px).join('L')+'Z';
process.stdout.write(d);
