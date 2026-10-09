import {feature} from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json' with {type:'json'};
import {places} from './places.js';

const NEAR_KM=150,EARTH_KM=6371;
let index=null;
function build(){
 const rings=[];
 for(const item of feature(atlas,atlas.objects.countries).features){
  const polygons=item.geometry?.type==='Polygon'?[item.geometry.coordinates]:item.geometry?.type==='MultiPolygon'?item.geometry.coordinates:[];
  for(const polygon of polygons){
   let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
   for(const [lon,lat] of polygon[0]){if(lon<west)west=lon;if(lon>east)east=lon;if(lat<south)south=lat;if(lat>north)north=lat;}
   rings.push({name:item.properties?.name??null,polygon,west,east,south,north});
  }
 }
 return rings;
}
function inRing(ring,lon,lat){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [xi,yi]=ring[i],[xj,yj]=ring[j];
  if((yi>lat)!==(yj>lat)&&lon<(xj-xi)*(lat-yi)/(yj-yi)+xi)inside=!inside;
 }
 return inside;
}
// Even-odd over the outer ring and holes. Natural Earth rings are cut at the antimeridian, so planar tests are exact there.
function inPolygon(polygon,lon,lat){
 let inside=false;
 for(const ring of polygon)if(inRing(ring,lon,lat))inside=!inside;
 return inside;
}
export function haversineKm(lat1,lon1,lat2,lon2){
 const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
 const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
 return 2*EARTH_KM*Math.asin(Math.min(1,Math.sqrt(a)));
}
export function countryAt(lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90)return null;
 const x=((lon+180)%360+360)%360-180;
 index??=build();
 for(const item of index)if(x>=item.west&&x<=item.east&&lat>=item.south&&lat<=item.north&&inPolygon(item.polygon,x,lat))return item.name;
 return null;
}
export function nearestPlace(lat,lon,list=places,maxKm=NEAR_KM){
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 let best=null,bestKm=Infinity;
 for(const place of list){const km=haversineKm(lat,lon,place.lat,place.lon);if(km<bestKm){bestKm=km;best=place;}}
 return best&&bestKm<=maxKm?{name:best.name,country:best.country,km:Math.round(bestKm)}:null;
}
export function placeNameAt(lat,lon,list=places){
 return {country:countryAt(lat,lon),nearest:nearestPlace(lat,lon,list)};
}
// Heading text: "Near Paris, France" / "France" / "Open ocean".
export function placeTitle({country,nearest}){
 if(nearest)return `Near ${nearest.name}, ${nearest.country||country||''}`.replace(/, $/,'');
 return country||'Open ocean';
}
