import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCardParams} from '../src/cards/cardParams.js';

const ids=new Set(['indonesia-2026','canada-2023']);

test('known card id kept',()=>{
 assert.equal(parseCardParams('?card=indonesia-2026',ids).card,'indonesia-2026');
});
test('unknown card ignored',()=>{
 assert.equal(parseCardParams('?card=nope',ids).card,null);
});
test('deck code validated',()=>{
 assert.equal(parseCardParams('?deck=1.AQI',ids).deck,'1.AQI');
 assert.equal(parseCardParams('?deck=1.',ids).deck,'1.');
 assert.equal(parseCardParams('?deck=2.AQI',ids).deck,null);
 assert.equal(parseCardParams('?deck=1.a%2Bb',ids).deck,null);
 assert.equal(parseCardParams(`?deck=1.${'A'.repeat(199)}`,ids).deck,null);
});
test('both together',()=>{
 assert.deepEqual(parseCardParams('?t=2024-11&card=canada-2023&deck=1.Bw',ids),{card:'canada-2023',deck:'1.Bw'});
});
test('no params gives nulls',()=>{
 assert.deepEqual(parseCardParams('',ids),{card:null,deck:null});
});
