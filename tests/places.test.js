import test from 'node:test';
import assert from 'node:assert/strict';
import {places,searchPlaces,parseCoordinates} from '../src/places.js';

test('place list is large, unique and well-formed',()=>{
 assert.ok(places.length>=150);
 assert.equal(new Set(places.map(p=>p.id)).size,places.length);
 for(const p of places){assert.ok(p.name&&p.country);assert.ok(Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180);}
 assert.deepEqual(places.slice(0,12).map(p=>p.id),['delhi','beijing','london','lagos','saopaulo','newyork','mumbai','tokyo','sydney','paris','cairo','jakarta']);
});
test('search is accent-insensitive and ranks prefixes first',()=>{
 assert.equal(searchPlaces('sao paulo')[0].id,'saopaulo');
 assert.equal(searchPlaces('Berlin')[0].id,'berlin');
 assert.equal(searchPlaces('bombay')[0].id,'mumbai');
 const r=searchPlaces('san');assert.ok(r.length>2);assert.ok(r[0].name.toLowerCase().startsWith('san'));
 assert.ok(searchPlaces('germany').some(p=>p.id==='munich'));
 assert.deepEqual(searchPlaces('zzzz'),[]);
});
test('typed coordinates parse',()=>{
 const c=parseCoordinates('48.85, 2.35');
 assert.equal(c.name,'48.85° N, 2.35° E');assert.equal(c.country,'Coordinates');assert.equal(c.lat,48.85);assert.equal(c.lon,2.35);assert.ok(c.id.startsWith('coord-'));
 assert.equal(parseCoordinates('48.85 2.35').lon,2.35);
 assert.equal(parseCoordinates('-33.87,151.21').name,'33.87° S, 151.21° E');
 assert.equal(parseCoordinates('40.7N 74W').lon,-74);
 assert.equal(parseCoordinates('91, 0'),null);assert.equal(parseCoordinates('10, 181'),null);assert.equal(parseCoordinates('paris'),null);assert.equal(parseCoordinates('48'),null);
});
