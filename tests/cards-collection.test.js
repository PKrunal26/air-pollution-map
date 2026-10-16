import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {emptyState,variantKey,markFound,questionFor,answer,waitLeft,WAIT_MS,loadCollection,saveCollection,mergeCollected} from '../src/cards/collection.js';

const deck=JSON.parse(readFileSync(new URL('./fixtures/cards-deck.json',import.meta.url),'utf8'));
const fire=deck[0],dust=deck[2];
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};

test('find then answer right collects',()=>{
 let s=markFound(emptyState(),'test-fire',1000);
 assert.equal(s.found['test-fire'],1000);
 const r=answer(s,'test-fire',fire,fire.questions[0].answer,2000);
 assert.equal(r.correct,true);assert.equal(r.state.collected['test-fire'],2000);
});
test('wrong answer starts one-hour wait and moves to next question',()=>{
 const s=markFound(emptyState(),'test-fire',0);
 const r=answer(s,'test-fire',fire,0,5000);
 assert.equal(r.correct,false);assert.equal(r.state.collected['test-fire'],undefined);
 assert.equal(WAIT_MS,3600000);
 assert.equal(waitLeft(r.state,'test-fire',5000),3600000);
 assert.equal(questionFor(fire,r.state,'test-fire').index,1);
});
test('question index wraps around the pool',()=>{
 let s=emptyState();
 for(let i=0;i<4;i++)s=answer(s,'test-dust',dust,3,i).state; // option 3 is wrong for every dust question
 assert.equal(questionFor(dust,s,'test-dust').index,1);
 assert.equal(questionFor(dust,s,'test-dust').question,dust.questions[1]);
});
test('finding a new card clears every wait',()=>{
 let s=answer(markFound(emptyState(),'test-fire',0),'test-fire',fire,0,0).state;
 s=markFound(s,'test-dust',10);
 assert.equal(waitLeft(s,'test-fire',10),0);
 assert.equal(questionFor(fire,s,'test-fire').index,1,'the next question stays the next one');
});
test('re-finding a collected card does not clear waits',()=>{
 let s=answer(markFound(emptyState(),'test-dust',0),'test-dust',dust,dust.questions[0].answer,0).state;
 s=answer(markFound(s,'test-fire',0),'test-fire',fire,0,0).state;
 s=markFound(s,'test-dust',10);
 assert.equal(waitLeft(s,'test-fire',10),WAIT_MS-10);
});
test('wait never exceeds one hour even if clock moves back',()=>{
 const s=answer(emptyState(),'test-fire',fire,0,10000000).state;
 assert.equal(waitLeft(s,'test-fire',0),WAIT_MS);
 assert.equal(waitLeft(s,'test-fire',10000000+WAIT_MS*2),0);
});
test('variant uses its own question and key',()=>{
 const key=variantKey('test-fire','co');
 assert.equal(key,'test-fire:co');
 assert.equal(questionFor(fire,emptyState(),key).question,fire.variants[0].question);
 const r=answer(emptyState(),key,fire,fire.variants[0].question.answer,7);
 assert.equal(r.correct,true);assert.equal(r.state.collected[key],7);assert.equal(r.state.collected['test-fire'],undefined);
});
test('throwing storage keeps working in memory',()=>{
 const broken={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
 assert.deepEqual(loadCollection(broken),emptyState());
 assert.doesNotThrow(()=>saveCollection(markFound(emptyState(),'test-fire',1),broken));
 assert.deepEqual(loadCollection(undefined),emptyState());
});
test('bad JSON gives empty state',()=>{
 const store=memory();store.setItem('air-atlas.cards','{nope');
 assert.deepEqual(loadCollection(store),emptyState());
 store.setItem('air-atlas.cards','{"v":9}');
 assert.deepEqual(loadCollection(store),emptyState());
});
test('save then load round-trips',()=>{
 const store=memory(),s=answer(markFound(emptyState(),'test-fire',1),'test-fire',fire,0,2).state;
 saveCollection(s,store);
 assert.deepEqual(loadCollection(store),s);
});
test('mergeCollected keeps existing dates',()=>{
 const s=answer(emptyState(),'test-fire',fire,fire.questions[0].answer,99).state;
 const m=mergeCollected(s,['test-fire','test-dust','test-fire:co']);
 assert.equal(m.collected['test-fire'],99);
 assert.equal(m.collected['test-dust'],null);
 assert.equal(m.collected['test-fire:co'],null);
 assert.equal(s.collected['test-dust'],undefined,'input state is not changed');
});

test('blocked localStorage getter does not crash load or save',()=>{
 const had=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('SecurityError');}});
 try{
  assert.deepEqual(loadCollection(),emptyState());
  assert.doesNotThrow(()=>saveCollection(emptyState()));
 }finally{
  if(had)Object.defineProperty(globalThis,'localStorage',had);else delete globalThis.localStorage;
 }
});
test('saving merges with what another tab saved',()=>{
 const store=memory();
 const tabA=answer(emptyState(),'test-fire',fire,fire.questions[0].answer,50).state;
 saveCollection(tabA,store);
 const tabB=markFound(emptyState(),'test-dust',60); // older tab, never saw test-fire
 saveCollection(tabB,store);
 const saved=loadCollection(store);
 assert.equal(saved.collected['test-fire'],50,'tab A\'s card survives');
 assert.equal(saved.found['test-dust'],60);
});
