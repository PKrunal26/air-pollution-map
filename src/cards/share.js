// The story image (1080 × 1920): the card, straight and centred on its own wide map, blurred; the address below.
// Instagram draws its own controls over the top 13% and bottom 12%, so nothing goes there.
import {RARITY_COLOURS,RARITY_LABELS as RARITY_NAMES} from './deck.js';
import {monthLabel,formatStats} from './format.js';
import {track} from '../analytics.js';

export const SITE='pkrunal26.github.io/air-pollution-map';
const FONT='-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function storyLayout(){
 const width=1080,height=1920,w=600,h=1200,gap=44,captionH=90;
 const top=0.13*height,bottom=0.88*height,y=Math.round(top+(bottom-top-(h+gap+captionH))/2);
 return {width,height,card:{x:(width-w)/2,y,w,h},caption:{y1:y+h+gap,y2:y+h+gap+captionH}};
}

const face=(card,variant)=>variant?{...card,...card.variants.find(v=>v.kind===variant)}:card;
function cover(ctx,img,x,y,w,h){
 const s=Math.max(w/img.width,h/img.height),iw=img.width*s,ih=img.height*s;
 ctx.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
// A dark pill; dots (rarity level 1–3, sizes 4/6/8 at 1×) follow the text when given.
function pill(ctx,text,x,y,align,colour,dots=0){
 ctx.font=`22px ${FONT}`;const tw=ctx.measureText(text).width,dw=dots?10+2*(8+12+16+6):0,w=tw+36+dw,left=align==='right'?x-w:x;
 roundRect(ctx,left,y,w,48,24);ctx.fillStyle='#0b0e0dd9';ctx.fill();ctx.strokeStyle='#e1e7d51f';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle=colour;ctx.textBaseline='middle';ctx.fillText(text,left+18,y+25);
 if(!dots)return;
 let cx=left+18+tw+10;
 [8,12,16].forEach((d,i)=>{ctx.beginPath();ctx.arc(cx+d/2,y+24,d/2-1,0,2*Math.PI);ctx.strokeStyle=colour;ctx.lineWidth=2;ctx.stroke();if(i<dots){ctx.fillStyle=colour;ctx.fill();}cx+=d+6;});
}

// Draws onto a 1080 × 1920 context. images: {wide, art} loaded Image objects. The card is the 300 × 600 card at 2×.
export function drawStory(ctx,{card,variant=null,images},layout=storyLayout()){
 const {width,height,card:box,caption}=layout,f=face(card,variant),k=box.w/300,rarity=RARITY_COLOURS[card.rarity];
 ctx.fillStyle='#0b0e0d';ctx.fillRect(0,0,width,height);
 ctx.save();ctx.filter='blur(40px) brightness(.55)';cover(ctx,images.wide,-80,-80,width+160,height+160);ctx.restore();
 ctx.save();ctx.shadowColor='#000a';ctx.shadowBlur=60;ctx.shadowOffsetY=24;roundRect(ctx,box.x,box.y,box.w,box.h,18*k);ctx.fillStyle='#0a0d0c';ctx.fill();ctx.restore();
 ctx.save();roundRect(ctx,box.x,box.y,box.w,box.h,18*k);ctx.clip();
 cover(ctx,images.art,box.x,box.y,box.w,460*k);
 const fade=ctx.createLinearGradient(0,box.y,0,box.y+box.h);fade.addColorStop(.62,'#0a0d0c00');fade.addColorStop(.75,'#0a0d0c');
 ctx.fillStyle=fade;ctx.fillRect(box.x,box.y,box.w,box.h);
 pill(ctx,card.type+(variant?' · CO':''),box.x+12*k,box.y+12*k,'left','#f2f5ec');
 pill(ctx,RARITY_NAMES[card.rarity],box.x+box.w-12*k,box.y+12*k,'right',rarity,['common','uncommon','rare'].indexOf(card.rarity)+1);
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
 ctx.textAlign='center';ctx.fillStyle='#f2f5ecbf';ctx.font=`26px ${FONT}`;ctx.fillText('Find it yourself',width/2,caption.y1+30);
 ctx.fillStyle='#f2f5ec';ctx.font=`600 30px ${FONT}`;ctx.fillText(SITE,width/2,caption.y1+72);ctx.textAlign='left';
}

const load=src=>new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});

// Renders the story PNG ahead of time: iOS only opens the share sheet straight from a tap, so the tap must not wait.
export async function prepareStory(card,variant=null,base=import.meta.env?.BASE_URL??'./'){
 try{
  const name=`${card.id}${variant?`-${variant}`:''}`;
  const [wide,art]=await Promise.all([load(`${base}cards/${name}-wide.svg`),load(`${base}cards/${name}.svg`)]);
  const layout=storyLayout(),canvas=document.createElement('canvas');canvas.width=layout.width;canvas.height=layout.height;
  drawStory(canvas.getContext('2d'),{card,variant,images:{wide,art}},layout);
  const blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
  return blob?new File([blob],`${name}.png`,{type:'image/png'}):null;
 }catch{return null;}
}

// Opens the share sheet where files can be shared, otherwise downloads the PNG. 'shared' | 'cancelled' | 'downloaded'.
export async function shareStory(file,card){
 const name=file.name.replace(/\.png$/,'');
 if(navigator.canShare?.({files:[file]})){
  try{await navigator.share({files:[file],title:card.name,text:`Find it yourself: https://${SITE}/?card=${card.id}`});track(`card-shared/${name}`);return 'shared';}
  catch(e){if(e?.name==='AbortError')return 'cancelled';}
 }
 const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);
 track(`card-shared/${name}`);return 'downloaded';
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
