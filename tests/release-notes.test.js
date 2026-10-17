import test from 'node:test';
import assert from 'node:assert/strict';
import {RELEASE,RELEASE_KEY,releaseSeen,saveReleaseSeen} from '../src/releaseNotes.js';

const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v))};};

test('release notes show once per release',()=>{
 const store=memory();
 assert.equal(releaseSeen(store),false,'a new visitor has not seen them');
 saveReleaseSeen(store);
 assert.equal(releaseSeen(store),true);
 store.setItem(RELEASE_KEY,'2020-01-01');
 assert.equal(releaseSeen(store),false,'an older release id shows the new notes again');
});
test('blocked storage never nags',()=>{
 const broken={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(releaseSeen(broken),true);
 assert.doesNotThrow(()=>saveReleaseSeen(broken));
});
test('notes are short, plain and dated',()=>{
 assert.match(RELEASE.id,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(RELEASE.items.length>=1&&RELEASE.items.length<=4);
 for(const item of RELEASE.items){assert.ok(item.title.length<=48,item.title);assert.ok(item.text.length<=260,item.title);}
});
