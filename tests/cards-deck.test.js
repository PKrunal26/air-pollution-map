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
test('deck only grows',()=>{
 const order=read('../src/cards/order.json'),ids=read('../src/cards/deck.json').map(c=>c.id);
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
test('inside, wrong month two away → none',()=>{
 assert.equal(at(0,113,'2026-11').status,'none');
});
test('inside, month one after → near-month',()=>{
 assert.equal(at(0,113,'2026-10').status,'near-month');
 assert.equal(at(0,113,'2026-08').status,'near-month');
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

test('a real find beats an earlier card\'s one-month-off hint',()=>{
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
