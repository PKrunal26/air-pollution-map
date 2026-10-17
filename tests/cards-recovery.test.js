import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeDeck,decodeDeck} from '../src/cards/recovery.js';

const order=['a','b','c','d','e','f','g','h','i'];
const sorted=keys=>[...keys].sort();

test('round trip',()=>{
 const keys=['a','c','c:co','i','h:co'];
 assert.deepEqual(sorted(decodeDeck(encodeDeck(keys,order),order)),sorted(keys));
});
test('empty collection encodes to "1."',()=>{
 assert.equal(encodeDeck([],order),'1.');
 assert.deepEqual(decodeDeck('1.',order),[]);
});
test('old shorter code decodes with newer cards uncollected',()=>{
 const code=encodeDeck(['a','b:co'],['a','b']);
 assert.deepEqual(sorted(decodeDeck(code,['a','b','c'])),['a','b:co']);
});
test('bits beyond order are ignored',()=>{
 const code=encodeDeck(['a','i'],order);
 assert.deepEqual(decodeDeck(code,['a','b']),['a']);
});
test('garbage gives empty',()=>{
 for(const bad of ['xyz','2.AA','1.!!','',null,undefined,'1.A'])assert.deepEqual(decodeDeck(bad,order),[],String(bad));
});
test('variant bit only when variant collected',()=>{
 assert.deepEqual(decodeDeck(encodeDeck(['a'],order),order),['a']);
 assert.deepEqual(decodeDeck(encodeDeck(['a:co'],order),order),['a:co']);
});
test('keys not in order are dropped when encoding',()=>{
 assert.deepEqual(decodeDeck(encodeDeck(['zzz','a'],order),order),['a']);
});
