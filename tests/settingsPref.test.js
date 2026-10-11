import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTINGS_KEY,loadSettings,mergeLayers,saveSettings} from '../src/settingsPref.js';

const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};
const defaults={pm2_5:{enabled:true,strength:80},ozone:{enabled:false,strength:60}};

test('saved settings round-trip through storage',()=>{
 const storage=memory(),paint={pm2_5:{enabled:false,strength:40},ozone:{enabled:true,strength:60}};
 saveSettings({paint,weather:{wind:{enabled:true,strength:50}},surface:'white'},storage);
 const loaded=loadSettings(storage);
 assert.deepEqual(mergeLayers(defaults,loaded.paint),paint);
 assert.equal(loaded.surface,'white');
 assert.deepEqual(loaded.weather,{wind:{enabled:true,strength:50}});
});

test('merging keeps defaults for new layers and drops unknown or malformed entries',()=>{
 const merged=mergeLayers(defaults,{pm2_5:{enabled:'yes',strength:250},gone:{enabled:true},ozone:null});
 assert.deepEqual(merged,{pm2_5:{enabled:true,strength:100},ozone:{enabled:false,strength:60}});
 assert.equal(mergeLayers(defaults,null),defaults);
});

test('missing, corrupt or blocked storage gives no settings',()=>{
 assert.equal(loadSettings(memory()),null);
 const corrupt=memory();corrupt.setItem(SETTINGS_KEY,'{oops');
 assert.equal(loadSettings(corrupt),null);
 assert.equal(loadSettings({getItem:()=>{throw new Error('blocked');}}),null);
 assert.equal(loadSettings(null),null);
 const odd=memory();odd.setItem(SETTINGS_KEY,JSON.stringify({surface:'neon'}));
 assert.equal(loadSettings(odd).surface,null);
 assert.doesNotThrow(()=>saveSettings({paint:{},weather:{},surface:'white'},{setItem:()=>{throw new Error('full');}}));
});
