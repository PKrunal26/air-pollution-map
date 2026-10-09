import test from 'node:test';
import assert from 'node:assert/strict';
import {countryAt,nearestPlace,placeNameAt,placeTitle,haversineKm} from '../src/placeName.js';

const list=[{id:'paris',name:'Paris',country:'France',lat:48.86,lon:2.35},{id:'tokyo',name:'Tokyo',country:'Japan',lat:35.68,lon:139.69}];

test('point-in-polygon finds countries, including multipolygons and the antimeridian',()=>{
 assert.equal(countryAt(46.5,2.5),'France');
 assert.equal(countryAt(28.6,77.2),'India');
 assert.equal(countryAt(64,100),'Russia');
 assert.equal(countryAt(64,178),'Russia');
 assert.equal(countryAt(68,-173),'Russia');
 assert.equal(countryAt(-82,0),'Antarctica');
 assert.equal(countryAt(-82,370),'Antarctica');
 assert.equal(countryAt(-17.8,178.1),'Fiji');
});
test('holes and open water return no country',()=>{
 assert.equal(countryAt(-29.5,28.2),'Lesotho');
 assert.equal(countryAt(0,-30),null);
 assert.equal(countryAt(-40,-140),null);
 assert.equal(countryAt(NaN,0),null);
 assert.equal(countryAt(91,0),null);
});
test('nearest city is limited to 150 km and measured by haversine',()=>{
 assert.ok(Math.abs(haversineKm(0,0,0,1)-111.2)<.5);
 assert.equal(nearestPlace(48.9,2.4,list).name,'Paris');
 assert.equal(nearestPlace(48.9,2.4,list).km<15,true);
 assert.equal(nearestPlace(47.5,2.35,list),null);
 assert.equal(nearestPlace(35.7,-220.3,list).name,'Tokyo');
 assert.equal(nearestPlace(10,10,[]),null);
});
test('place titles read naturally',()=>{
 assert.equal(placeTitle(placeNameAt(48.9,2.4,list)),'Near Paris, France');
 assert.equal(placeTitle(placeNameAt(46.5,2.5,list)),'France');
 assert.equal(placeTitle(placeNameAt(0,-30,list)),'Open ocean');
 assert.equal(placeTitle({country:null,nearest:{name:'Honolulu',country:'United States',km:5}}),'Near Honolulu, United States');
});
