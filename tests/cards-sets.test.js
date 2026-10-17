import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cardSets,setsCompletedBy} from '../src/cards/sets.js';

const base=JSON.parse(readFileSync(new URL('./fixtures/cards-deck.json',import.meta.url),'utf8'));
// Fixture types: Peat fire, Wildfire, Dust storm. Add a second wildfire so one type forms a set.
const deck=[...base,{...base[1],id:'test-fire-2',number:4}];

test('a set per type with two or more cards, plus the full deck',()=>{
 assert.deepEqual(cardSets(deck).map(s=>[s.name,s.ids]),[['Wildfire',['test-dateline','test-fire-2']],['All cards',['test-fire','test-dateline','test-dust','test-fire-2']]]);
});
test('collecting the last card of a type completes that set only',()=>{
 const done=setsCompletedBy(deck,new Set(['test-dateline']),'test-fire-2');
 assert.deepEqual(done.map(s=>s.name),['Wildfire']);
});
test('the last card of the deck completes the full deck too',()=>{
 const done=setsCompletedBy(deck,new Set(['test-fire','test-dateline','test-dust']),'test-fire-2');
 assert.deepEqual(done.map(s=>s.name),['Wildfire','All cards']);
});
test('a set already complete is not completed again',()=>{
 assert.deepEqual(setsCompletedBy(deck,new Set(['test-dateline','test-fire-2']),'test-fire-2'),[]);
});
