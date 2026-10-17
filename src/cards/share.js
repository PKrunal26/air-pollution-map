// Sharing a card. Share sends one short text message: the score and a link to the card's own page (public/c/<id>/),
// whose preview shows the card, its month and how to play. The story image (1080 × 1920, for Instagram stories) is shared
// on its own with no text: apps given a file and text together send them as two messages, or paste the file's path.
import {RARITY_COLOURS,RARITY_LABELS as RARITY_NAMES} from './deck.js';
import {monthLabel,formatStats} from './format.js';
import {track} from '../analytics.js';

export const SITE='pkrunal26.github.io/air-pollution-map';
export const cardLink=id=>`https://${SITE}/c/${id}/`;
export const howToPlay=n=>[`${n} real pollution events are hidden on a globe.`,'Find the place, name the cause.'];
const FONT='-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const face=(card,variant)=>variant?{...card,...card.variants.find(v=>v.kind===variant)}:card;
const byNumber=deck=>[...deck].sort((a,b)=>a.number-b.number);
export const collectedCount=(deck,collected)=>deck.filter(c=>c.id in collected).length;

// One square per card in card-number order, eight to a row: collected cards in their rarity's colour, missing ones dark.
const SQUARES={common:'🟩',uncommon:'🟦',rare:'🟨'};
export function scoreGrid(deck,collected){
 const squares=byNumber(deck).map(c=>c.id in collected?SQUARES[c.rarity]:'⬛'),rows=[];
 for(let i=0;i<squares.length;i+=8)rows.push(squares.slice(i,i+8).join(''));
 return rows;
}

// Short on purpose: the link's preview carries the picture, the month and how to play.
export function shareText({card,variant=null,deck,collected,earned=null}){
 return [
  `Who Owns the Air? · ${collectedCount(deck,collected)} / ${deck.length} cards`,
  ...scoreGrid(deck,collected),
  [`${card.name}${variant?' (CO print)':''}`,...(earned?.marks??[])].join(' · '),
  cardLink(card.id),
 ].join('\n');
}

export function storyLayout(){
 const width=1080,height=1920,w=540,h=1080,gap=44,captionH=230;
 const top=0.13*height,bottom=0.88*height,y=Math.round(top+(bottom-top-(h+gap+captionH))/2);
 return {width,height,card:{x:(width-w)/2,y,w,h},caption:{y1:y+h+gap,y2:y+h+gap+captionH}};
}
// The link preview (1200 × 630): the card alone, centred, so apps that crop the preview to a square still show it.
export function previewLayout(){
 const width=1200,height=630,h=570,w=285;
 return {width,height,card:{x:(width-w)/2,y:(height-h)/2,w,h}};
}

function cover(ctx,img,x,y,w,h){
 const s=Math.max(w/img.width,h/img.height),iw=img.width*s,ih=img.height*s;
 ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function backdrop(ctx,img,width,height,blur){
 ctx.fillStyle='#0b0e0d';ctx.fillRect(0,0,width,height);
 ctx.save();ctx.filter=`blur(${blur}px) brightness(.55)`;cover(ctx,img,-2*blur,-2*blur,width+4*blur,height+4*blur);ctx.restore();
}
// A dark pill at card scale k; rarity dots (level 1–3, sizes 4/6/8 at 1×) follow the text when given.
function pill(ctx,text,x,y,align,colour,k,dots=0){
 ctx.font=`${11*k}px ${FONT}`;const tw=ctx.measureText(text).width,dw=dots?5*k+18*k+6*k:0,w=tw+18*k+dw,left=align==='right'?x-w:x;
 roundRect(ctx,left,y,w,24*k,12*k);ctx.fillStyle='#0b0e0dd9';ctx.fill();ctx.strokeStyle='#e1e7d51f';ctx.lineWidth=k;ctx.stroke();
 ctx.fillStyle=colour;ctx.textBaseline='middle';ctx.fillText(text,left+9*k,y+12.5*k);
 if(!dots)return;
 let cx=left+9*k+tw+5*k;
 [4,6,8].forEach((d,i)=>{ctx.beginPath();ctx.arc(cx+d*k/2,y+12*k,d*k/2-k/2,0,2*Math.PI);ctx.strokeStyle=colour;ctx.lineWidth=k;ctx.stroke();if(i<dots){ctx.fillStyle=colour;ctx.fill();}cx+=(d+3)*k;});
}

// The front of the 300 × 600 card, drawn into box (scale k = box.w / 300).
export function drawCard(ctx,{card,variant=null,art},box){
 const f=face(card,variant),k=box.w/300,rarity=RARITY_COLOURS[card.rarity];
 ctx.save();ctx.shadowColor='#000a';ctx.shadowBlur=30*k;ctx.shadowOffsetY=12*k;roundRect(ctx,box.x,box.y,box.w,box.h,18*k);ctx.fillStyle='#0a0d0c';ctx.fill();ctx.restore();
 ctx.save();roundRect(ctx,box.x,box.y,box.w,box.h,18*k);ctx.clip();
 cover(ctx,art,box.x,box.y,box.w,460*k);
 const fade=ctx.createLinearGradient(0,box.y,0,box.y+box.h);fade.addColorStop(.62,'#0a0d0c00');fade.addColorStop(.75,'#0a0d0c');
 ctx.fillStyle=fade;ctx.fillRect(box.x,box.y,box.w,box.h);
 pill(ctx,card.type+(variant?' · CO':''),box.x+12*k,box.y+12*k,'left','#f2f5ec',k);
 pill(ctx,RARITY_NAMES[card.rarity],box.x+box.w-12*k,box.y+12*k,'right',rarity,k,['common','uncommon','rare'].indexOf(card.rarity)+1);
 const left=box.x+20*k;ctx.textBaseline='alphabetic';
 ctx.fillStyle='#9aa58c';ctx.font=`${12*k}px ${FONT}`;ctx.fillText(monthLabel(f.months),left,box.y+box.h-30*k-104*k);
 ctx.fillStyle='#f2f5ec';ctx.font=`600 ${21*k}px ${FONT}`;ctx.fillText(card.name,left,box.y+box.h-30*k-78*k,box.w-40*k);
 // Four stat groups spread edge to edge with equal gaps, like the card's space-between row.
 const stats=formatStats(f.stats),y=box.y+box.h-30*k-18*k;
 const widths=stats.map(s=>{
  ctx.font=`600 ${16*k}px ${FONT}`;const vw=ctx.measureText(s.value).width;
  ctx.font=`${10*k}px ${FONT}`;return {vw,w:Math.max(vw+(s.unit?3*k+ctx.measureText(s.unit).width:0),ctx.measureText(s.label).width)};
 });
 const gap=(box.w-40*k-widths.reduce((a,b)=>a+b.w,0))/3;let x=left;
 stats.forEach((s,i)=>{
  ctx.fillStyle='#f2f5ec';ctx.font=`600 ${16*k}px ${FONT}`;ctx.fillText(s.value,x,y);
  ctx.fillStyle='#9aa58c';ctx.font=`${10*k}px ${FONT}`;if(s.unit)ctx.fillText(s.unit,x+widths[i].vw+3*k,y);
  ctx.fillText(s.label,x,y+15*k);x+=widths[i].w+gap;
 });
 ctx.restore();
 roundRect(ctx,box.x+k,box.y+k,box.w-2*k,box.h-2*k,17*k);ctx.strokeStyle=rarity;ctx.lineWidth=2*k;ctx.stroke();
}

// The story: the card on its own wide map, blurred; below it the collection as a row of dots (filled in the rarity's
// colour when collected), the count and how it was won, how to play, and the address.
export function drawStory(ctx,{card,variant=null,images,deck,collected,earned=null},layout=storyLayout()){
 const {width,card:box,caption}=layout,cards=byNumber(deck),marks=earned?.marks??[];
 backdrop(ctx,images.wide,width,layout.height,40);
 drawCard(ctx,{card,variant,art:images.art},box);
 const d=20,step=d+12;let cx=(width-(cards.length*step-12))/2+d/2;
 cards.forEach(c=>{
  ctx.beginPath();ctx.arc(cx,caption.y1+d/2,d/2-1,0,2*Math.PI);
  if(c.id in collected){ctx.fillStyle=RARITY_COLOURS[c.rarity];ctx.fill();}else{ctx.strokeStyle='#e1e7d559';ctx.lineWidth=2;ctx.stroke();}
  cx+=step;
 });
 ctx.textAlign='center';ctx.textBaseline='alphabetic';
 ctx.fillStyle='#f2f5ec';ctx.font=`600 30px ${FONT}`;
 ctx.fillText([`${collectedCount(deck,collected)} / ${deck.length} cards`,...marks].join(' · '),width/2,caption.y1+76);
 ctx.fillStyle='#f2f5ecbf';ctx.font=`26px ${FONT}`;
 howToPlay(deck.length).forEach((line,i)=>ctx.fillText(line,width/2,caption.y1+126+i*38));
 ctx.fillStyle='#f2f5ec';ctx.font=`600 30px ${FONT}`;ctx.fillText(SITE,width/2,caption.y2-16);ctx.textAlign='left';
}

export function drawPreview(ctx,{card,images},layout=previewLayout()){
 backdrop(ctx,images.wide,layout.width,layout.height,30);
 drawCard(ctx,{card,art:images.art},layout.card);
}

const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});
export async function loadCardImages(card,variant=null,base=import.meta.env?.BASE_URL??'./'){
 const name=`${card.id}${variant?`-${variant}`:''}`;
 const [wide,art]=await Promise.all([load(`${base}cards/${name}-wide.svg`),load(`${base}cards/${name}.svg`)]);
 return {wide,art};
}

// Renders the story PNG ahead of time: iOS only opens the share sheet straight from a tap, so the tap must not wait.
export async function prepareStory({card,variant=null,deck,collected,earned=null}){
 try{
  const images=await loadCardImages(card,variant),layout=storyLayout(),canvas=document.createElement('canvas');
  canvas.width=layout.width;canvas.height=layout.height;
  drawStory(canvas.getContext('2d'),{card,variant,images,deck,collected,earned},layout);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  return blob?new File([blob],`${card.id}${variant?`-${variant}`:''}.png`,{type:'image/png'}):null;
 }catch{return null;}
}

// The message goes to the share sheet, or to the clipboard where there is none. 'shared' | 'copied' | 'cancelled' | 'failed'.
export async function shareMessage(text,name){
 if(navigator.share){
  try{await navigator.share({text});track(`card-shared/${name}`);return 'shared';}
  catch(e){if(e?.name==='AbortError')return 'cancelled';}
 }
 try{await navigator.clipboard.writeText(text);track(`card-shared/${name}`);return 'copied';}catch{return 'failed';}
}

// The story image alone. Phones get the share sheet (straight to Instagram); computers save the file, since desktop
// share sheets send a file to messaging apps doubled and with its path. 'shared' | 'cancelled' | 'downloaded'.
export async function shareStory(file){
 const name=file.name.replace(/\.png$/,''),phone=globalThis.matchMedia?.('(pointer:coarse)').matches;
 if(phone&&navigator.canShare?.({files:[file]})){
  try{await navigator.share({files:[file]});track(`card-story/${name}`);return 'shared';}
  catch(e){if(e?.name==='AbortError')return 'cancelled';}
 }
 const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
 track(`card-story/${name}`);return 'downloaded';
}

// "N people found this card", from GoatCounter's public counter; null whenever it is unavailable (the line is hidden).
export async function fetchFoundCount(id,fetcher=globalThis.fetch){
 try{
  const res=await fetcher(`https://krunalp.goatcounter.com/counter/${encodeURIComponent(`card-collected/${id}`)}.json`);
  if(!res.ok)return null;
  const n=Number(String((await res.json()).count??'').replace(/[^\d]/g,''));
  return Number.isFinite(n)&&n>0?n:null;
 }catch{return null;}
}
