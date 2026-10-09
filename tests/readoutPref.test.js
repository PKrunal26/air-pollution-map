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
