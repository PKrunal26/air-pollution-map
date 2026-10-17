import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {storyLayout,previewLayout,scoreGrid,shareText,cardLink,fetchFoundCount} from '../src/cards/share.js';
import DECK from '../src/cards/deck.json' with {type:'json'};

test('storyLayout keeps card and caption inside Instagram safe zones',()=>{
 const l=storyLayout();
 assert.equal(l.width,1080);assert.equal(l.height,1920);
 assert.equal(l.card.w*2,l.card.h,'card keeps its 1:2 shape');
 assert.equal(l.card.x,(1080-l.card.w)/2,'card is centred');
 assert.ok(l.card.y>=0.13*1920,'card clears the top 13%');
 assert.ok(l.caption.y1>l.card.y+l.card.h,'caption sits below the card');
 assert.ok(l.caption.y2<=0.88*1920,'caption clears the bottom 12%');
});

test('previewLayout centres the whole card in a 1200 × 630 picture',()=>{
 const l=previewLayout();
 assert.equal(l.width,1200);assert.equal(l.height,630);
 assert.equal(l.card.w*2,l.card.h);assert.equal(l.card.x*2+l.card.w,1200);
 assert.ok(l.card.y>=0&&l.card.y+l.card.h<=630);
});

const deck=[
 {id:'a',number:2,rarity:'rare'},{id:'b',number:1,rarity:'common'},{id:'c',number:3,rarity:'uncommon'},
 ...Array.from({length:7},(_,i)=>({id:`x${i}`,number:4+i,rarity:'common'})),
];
test('scoreGrid: card-number order, rarity colours, rows of eight',()=>{
 assert.deepEqual(scoreGrid(deck,{a:1,c:null}),['⬛🟨🟦⬛⬛⬛⬛⬛','⬛⬛']);
 assert.deepEqual(scoreGrid(deck,{}),['⬛⬛⬛⬛⬛⬛⬛⬛','⬛⬛']);
});

test('shareText: one short message with score, card, marks and the card link',()=>{
 const card=DECK.find(c=>c.id==='canada-2023');
 const lines=shareText({card,deck:DECK,collected:{'canada-2023':1,'indonesia-2026:co':2},earned:{marks:['First try','No hints']}}).split('\n');
 assert.deepEqual(lines,[
  `Who Owns the Air? · 1 / ${DECK.length} cards`,
  '🟨⬛⬛⬛⬛⬛⬛⬛','⬛⬛⬛⬛⬛⬛⬛⬛',
  'Canadian wildfire smoke · First try · No hints',
  'https://pkrunal26.github.io/air-pollution-map/c/canada-2023/',
 ],'CO prints do not count as cards');
 const co=shareText({card:DECK.find(c=>c.id==='indonesia-2026'),variant:'co',deck:DECK,collected:{},earned:{marks:[]}});
 assert.equal(co.split('\n')[3],'Indonesian peat haze (CO print)');
});

test('every card has a link page and a preview picture (run npm run cards:pages after changing the deck)',()=>{
 for(const card of DECK){
  const page=new URL(`../public/c/${card.id}/index.html`,import.meta.url);
  assert.ok(existsSync(page),`missing page for ${card.id}`);
  const html=readFileSync(page,'utf8');
  assert.ok(html.includes(`og/${card.id}.jpg`)&&html.includes(`?card=${card.id}`)&&html.includes(card.name.replace(/&/g,'&amp;')),`stale page for ${card.id}`);
  assert.ok(existsSync(new URL(`../public/cards/og/${card.id}.jpg`,import.meta.url)),`missing preview for ${card.id}`);
  assert.equal(cardLink(card.id),`https://pkrunal26.github.io/air-pollution-map/c/${card.id}/`);
 }
});

test('found count parses separators and hides on failure',async()=>{
 const reply=(ok,body)=>async()=>({ok,json:async()=>body});
 assert.equal(await fetchFoundCount('x',reply(true,{count:'1,204'})),1204);
 assert.equal(await fetchFoundCount('x',reply(false,{})),null);
 assert.equal(await fetchFoundCount('x',reply(true,{count:''})),null);
 assert.equal(await fetchFoundCount('x',async()=>{throw new Error('offline');}),null);
});
