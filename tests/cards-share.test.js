import test from 'node:test';
import assert from 'node:assert/strict';
import {storyLayout} from '../src/cards/share.js';

test('storyLayout keeps card and caption inside Instagram safe zones',()=>{
 const l=storyLayout();
 assert.equal(l.width,1080);assert.equal(l.height,1920);
 assert.equal(l.card.w,600);assert.equal(l.card.h,1200);
 assert.equal(l.card.x,(1080-600)/2,'card is centred');
 assert.ok(l.card.y>=0.13*1920,'card clears the top 13%');
 assert.ok(l.caption.y1>l.card.y+l.card.h,'caption sits below the card');
 assert.ok(l.caption.y2<=0.88*1920,'caption clears the bottom 12%');
});

import {fetchFoundCount} from '../src/cards/share.js';
test('found count parses separators and hides on failure',async()=>{
 const reply=(ok,body)=>async()=>({ok,json:async()=>body});
 assert.equal(await fetchFoundCount('x',reply(true,{count:'1,204'})),1204);
 assert.equal(await fetchFoundCount('x',reply(false,{})),null);
 assert.equal(await fetchFoundCount('x',reply(true,{count:''})),null);
 assert.equal(await fetchFoundCount('x',async()=>{throw new Error('offline');}),null);
});
