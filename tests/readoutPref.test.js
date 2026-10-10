import test from 'node:test';
import assert from 'node:assert/strict';
import {READOUT_KEY,loadReadout,saveReadout} from '../src/readoutPref.js';

const withStorage=(storage,fn)=>{const had=Object.getOwnPropertyDescriptor(globalThis,'localStorage');Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});try{fn();}finally{if(had)Object.defineProperty(globalThis,'localStorage',had);else delete globalThis.localStorage;}};
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};

test('hover readout defaults on and round-trips through storage',()=>withStorage(memory(),()=>{
 assert.equal(loadReadout(),true);
 saveReadout(false);assert.equal(localStorage.getItem(READOUT_KEY),'off');assert.equal(loadReadout(),false);
 saveReadout(true);assert.equal(loadReadout(),true);
}));
test('blocked or missing storage falls back to on without throwing',()=>{
 const blocked={getItem(){throw new Error('denied');},setItem(){throw new Error('denied');}};
 withStorage(blocked,()=>{assert.equal(loadReadout(),true);assert.doesNotThrow(()=>saveReadout(false));});
 assert.equal(loadReadout(),true);assert.doesNotThrow(()=>saveReadout(true));
});

test('first-visit picker is remembered, offers the common pollutants and stays quiet when storage is blocked', async () => {
 const {loadOnboarded,saveOnboarded,ONBOARDED_KEY,PICKER_LAYERS}=await import('../src/onboarding.js');
 const {PAINT_LAYERS}=await import('../src/paintLayers.js');
 const store=new Map();
 globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v))};
 assert.equal(loadOnboarded(),false);
 saveOnboarded();assert.equal(store.get(ONBOARDED_KEY),'1');assert.equal(loadOnboarded(),true);
 globalThis.localStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(loadOnboarded(),true);assert.doesNotThrow(saveOnboarded);
 delete globalThis.localStorage;
 assert.deepEqual(PICKER_LAYERS.map(([id])=>id),PAINT_LAYERS.filter(l=>l.group==='Pollutants').map(l=>l.id).sort((a,b)=>PICKER_LAYERS.findIndex(p=>p[0]===a)-PICKER_LAYERS.findIndex(p=>p[0]===b)));
});
