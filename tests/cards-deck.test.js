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
