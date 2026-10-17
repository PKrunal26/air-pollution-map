import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateDeck,monthKey,HISTORY_START} from '../src/cards/deck.js';

const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
const fixture=()=>read('./fixtures/cards-deck.json');
// A copy of the fixture with one change to the first card.
const changed=edit=>{const deck=fixture();edit(deck[0],deck);return deck;};

test('valid fixture passes',()=>{
 assert.deepEqual(validateDeck(fixture()),fixture());
});
test('real deck validates',()=>{
 assert.doesNotThrow(()=>validateDeck(read('../src/cards/deck.json')));
});
test('rejects',()=>{
 const cases=[
  ['duplicate id',(c,d)=>{d[1].id=c.id;}],
  ['duplicate number',(c,d)=>{d[1].number=c.number;}],
  ['unknown type',c=>{c.type='Volcano';}],
  ['rarity epic',c=>{c.rarity='epic';}],
  ['month before history',c=>{c.months=['2021-12'];}],
  ['footprint with 2 points',c=>{c.footprint=[[0,0],[1,1]];}],
  ['answer out of range',c=>{c.questions[0].answer=4;}],
  ['question without source',c=>{delete c.questions[0].source;}],
  ['one question',c=>{c.questions=c.questions.slice(0,1);}],
  ['four questions',c=>{c.questions=[...c.questions,...c.questions];}],
  ['variant kind pm10',c=>{c.variants[0].kind='pm10';}],
 ];
 for(const [name,edit] of cases)assert.throws(()=>validateDeck(changed(edit)),/Invalid card/,name);
});
test('monthKey',()=>{
 assert.equal(monthKey(Date.UTC(2024,10,1)),'2024-11');
 assert.equal(HISTORY_START,'2022-08');
});
// Every card id published so far, in order (live since 17 Oct 2026). Recovery links and found counts depend on them,
// so this list is copied here rather than read from order.json: removing an id from both files still fails.
const SHIPPED=["canada-2023", "indonesia-2026", "north-india-november", "punjab-pakistan-november", "south-america-2024", "canada-2025", "yakutia-2024", "athens-dust-2024", "iberia-2025", "harmattan", "north-savanna-burning", "saharan-dust-caribbean", "south-savanna-burning", "mainland-sea-burning", "mexico-burning", "gobi-dust"];
test('deck only grows',()=>{
 const order=read('../src/cards/order.json'),ids=read('../src/cards/deck.json').map(c=>c.id);
 assert.deepEqual(order.slice(0,SHIPPED.length),SHIPPED,'published ids are never removed or reordered');
 assert.deepEqual(ids.slice(0,order.length),order,'order.json must be a prefix of the deck ids, in order');
 assert.ok(ids.every(id=>order.includes(id)),'every deck id must be recorded in order.json');
});

import {cardAt} from '../src/cards/deck.js';
const at=(lat,lon,month,extra={})=>cardAt(fixture(),{lat,lon,month,layers:new Set(),owned:new Set(),...extra});
// Kilometres per degree of latitude, for placing points a set distance outside an edge.
const KM=110.57;

test('inside, right month → found',()=>{
 const hit=at(0,113,'2026-09');
 assert.equal(hit.status,'found');assert.equal(hit.card.id,'test-fire');assert.equal(hit.variant,null);
});
test('the place is enough: any month, or Today, finds the card',()=>{
 assert.equal(at(0,113,'2026-11').status,'found');
 assert.equal(at(0,113,'2023-02').status,'found');
 assert.equal(at(0,113,null).status,'found','Today shows no month');
});
test('100 km outside edge → found',()=>{
 assert.equal(at(4+100/KM,113,'2026-09').status,'found');
});
test('200 km outside → none',()=>{
 assert.equal(at(4+200/KM,113,'2026-09').status,'none');
});
test('date line footprint matches both sides',()=>{
 assert.equal(at(-15,179.5,'2024-07').card?.id,'test-dateline');
 assert.equal(at(-15,-179.5,'2024-07').card?.id,'test-dateline');
 assert.equal(at(-15,0,'2024-07').status,'none');
});
test('polar pin does not match tropical card',()=>{
 assert.equal(at(89,114,'2026-09').status,'none');
});
test('variant needs CO layer and owned base',()=>{
 assert.equal(at(0,113,'2026-09',{owned:new Set(['test-fire'])}).status,'found');
 assert.equal(at(0,113,'2026-09',{layers:new Set(['carbon_monoxide'])}).status,'found');
 const hit=at(0,113,'2026-09',{layers:new Set(['carbon_monoxide']),owned:new Set(['test-fire'])});
 assert.equal(hit.status,'variant');assert.equal(hit.variant.kind,'co');
});
test('first matching card wins',()=>{
 const deck=fixture();deck[2]={...deck[0],id:'later',number:9};
 assert.equal(cardAt(deck,{lat:0,lon:113,month:'2026-09',layers:new Set(),owned:new Set()}).card.id,'test-fire');
});

test('art block is optional but must hold three numbers',()=>{
 assert.doesNotThrow(()=>validateDeck(changed(c=>{c.art={lon0:97.5,lon1:116.5,latCenter:2};})));
 assert.throws(()=>validateDeck(changed(c=>{c.art={lon0:97.5,lon1:116.5};})),/Invalid card/);
 assert.throws(()=>validateDeck(changed(c=>{c.art={lon0:120,lon1:100,latCenter:2};})),/Invalid card/);
});

test('wrongNote is optional text on a question',()=>{
 assert.doesNotThrow(()=>validateDeck(changed(c=>{c.questions[0].wrongNote='Fireworks add a night or two; this haze lasts the month.';})));
 assert.throws(()=>validateDeck(changed(c=>{c.questions[0].wrongNote='';})),/Invalid card/);
});

test('featuredMonth is optional and must be one of the months',()=>{
 assert.doesNotThrow(()=>validateDeck(changed(c=>{c.featuredMonth='2026-09';})));
 assert.throws(()=>validateDeck(changed(c=>{c.featuredMonth='2026-10';})),/Invalid card/);
});

test('where areas overlap, the card whose month is showing wins',()=>{
 const deck=fixture();deck[1]={...deck[0],id:'later',number:9,months:['2026-10']};
 const hit=cardAt(deck,{lat:0,lon:113,month:'2026-10',layers:new Set(),owned:new Set()});
 assert.equal(hit.status,'found');assert.equal(hit.card.id,'later');
});

import {RARITY_LABELS} from '../src/cards/deck.js';
test('rarity reads as how often it happens, not as value',()=>{
 assert.deepEqual(RARITY_LABELS,{common:'Every year',uncommon:'Every few years',rare:'Once in decades'});
});
test('helps is optional but needs text and a source',()=>{
 assert.doesNotThrow(()=>validateDeck(changed(c=>{c.helps={text:'Cleaner cooking fuel cuts this smoke at source.',source:'HEI 2025'};})));
 assert.throws(()=>validateDeck(changed(c=>{c.helps={text:'No source'};})),/Invalid card/);
 assert.throws(()=>validateDeck(changed(c=>{c.helps='just text';})),/Invalid card/);
});

test('back text stays within what the card back can hold',()=>{
 assert.throws(()=>validateDeck(changed(c=>{c.back=['x'.repeat(601)];})),/Invalid card/);
});

test('belief marks a wrong option as the common belief',()=>{
 assert.doesNotThrow(()=>validateDeck(changed(c=>{c.questions[0].belief=0;})));
 assert.throws(()=>validateDeck(changed(c=>{c.questions[0].belief=c.questions[0].answer;})),/Invalid card/);
 assert.throws(()=>validateDeck(changed(c=>{c.questions[0].belief=4;})),/Invalid card/);
});

test('where buffers overlap, the nearest footprint wins',()=>{
 const base=fixture()[0],square=(x0,x1)=>[[x0,0],[x1,0],[x1,4],[x0,4]];
 const deck=[{...base,id:'west',footprint:square(10,14),variants:[]},{...base,id:'east',footprint:square(14,18),variants:[]}];
 const pick=lon=>cardAt(deck,{lat:2,lon,month:base.months[0],layers:new Set(),owned:new Set()}).card.id;
 assert.equal(pick(13.9),'west');assert.equal(pick(14.1),'east');
 assert.equal(pick(18.5),'east','in the east buffer and the west buffer, east is nearer');
});

test('real deck: Lahore finds the Pakistani card, Amritsar the Indian one',()=>{
 const deck=validateDeck(read('../src/cards/deck.json'));
 const pick=(lat,lon)=>cardAt(deck,{lat,lon,month:'2024-11',layers:new Set(),owned:new Set()}).card?.id;
 assert.equal(pick(31.55,74.35),'punjab-pakistan-november');
 assert.equal(pick(31.63,74.87),'north-india-november');
 assert.equal(pick(28.61,77.21),'north-india-november');
});

import {footprintCentre} from '../src/cards/deck.js';
test('footprint centre stays on the near side of the date line',()=>{
 const [lon,lat]=footprintCentre({footprint:[[178,0],[-178,0],[-178,2],[178,2]]});
 assert.ok(Math.abs(Math.abs(lon)-180)<1e-9);assert.equal(lat,1);
});

test('real deck: overlapping areas go to the card of the month shown, else the nearest',()=>{
 const deck=validateDeck(read('../src/cards/deck.json'));
 const pick=(lat,lon,month)=>cardAt(deck,{lat,lon,month,layers:new Set(),owned:new Set()}).card?.id;
 // Northern Cameroon lies in both the Harmattan (January) and Central African fires (December) areas.
 assert.equal(pick(9,17.5,'2024-12'),'north-savanna-burning');
 assert.equal(pick(9,17.5,'2025-01'),'harmattan');
 assert.equal(pick(9,17.5,'2026-11'),pick(9,17.5,null),'otherwise nearest, then deck order, whatever the month');
 assert.equal(pick(31.55,74.35,'2026-12'),'punjab-pakistan-november','Lahore in any month');
 assert.equal(pick(-2,114,'2027-09'),'indonesia-2026');
});
test('300 km of leeway around every card',()=>{
 const deck=validateDeck(read('../src/cards/deck.json'));
 assert.ok(deck.every(c=>c.bufferKm===300));
 // Athens is inside the Greek footprint; Thessaloniki is about 100 km beyond its northern edge.
 assert.equal(cardAt(deck,{lat:40.64,lon:22.94,month:null,layers:new Set(),owned:new Set()}).card?.id,'athens-dust-2024');
});
