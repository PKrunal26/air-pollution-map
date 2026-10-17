import React,{useEffect,useLayoutEffect,useRef} from 'react';
import CardView from './CardView';
import {FaceDown} from './ReadoutCardRow';

// The card's full-screen moment. It flies from its slot in the dialog to fill the screen, turns over and celebrates by
// how it was earned (not by rarity, which only sets the colour), waits for a tap, then flies back into the slot.
// Rings of halftone dots: regular circles, smaller further out, as on the globe. out: px past the card's half-height.
const RINGS=[{count:14,out:40,size:16},{count:20,out:100,size:11},{count:26,out:160,size:7}];
const LEVELS={
 explore:{rings:3,charge:1.1,shines:2,wave:true,stamp:true,turn:1200},
 full:{rings:2,charge:1.07,shines:1,turn:1200},
 medium:{rings:1,charge:1.04,shines:1,turn:900},
 quiet:{rings:0,charge:1,shines:0,turn:550},
};
const ease='cubic-bezier(.22,1,.36,1)';

function fullBox(){
 const phone=innerWidth<=700,k=Math.min(innerWidth*(phone?.84:.5)/300,innerHeight*.78/600);
 return {x:(innerWidth-300*k)/2,y:(innerHeight-600*k)/2-10,k};
}
function boxOf(el){const r=el.getBoundingClientRect();return {x:r.left,y:r.top,k:r.width/300};}
const at=b=>`translate(${b.x}px,${b.y}px) scale(${b.k})`;

// start: the box the card flies from (the face-down card before the dialog changed layout); defaults to the slot.
export default function CollectHero({card,variant,total,level,slot,start=null,landing,onReady,onLanded}){
 const hero=useRef(null),inner=useRef(null),wave=useRef(null),anims=useRef([]);
 const L=LEVELS[level]??LEVELS.quiet;
 const run=(el,frames,opts)=>{const a=el.animate(frames,{fill:'both',easing:ease,...opts});anims.current.push(a);return a;};
 // Out to full screen, then the turn and the celebration.
 useLayoutEffect(()=>{
  const h=hero.current,from=start??boxOf(slot.current),to=fullBox();
  run(h,[{transform:at(from)},{transform:at(to)}],{duration:650,easing:'cubic-bezier(.2,.9,.3,1)'});
  const flight=650,turnEnd=flight+L.turn*.85;
  run(inner.current,level==='quiet'?[{transform:'rotateY(180deg)'},{transform:'rotateY(0deg)'}]
   :[{transform:'rotateY(180deg) scale(1)'},{transform:`rotateY(180deg) scale(${L.charge})`,offset:.3},{transform:'rotateY(-8deg) scale(1)',offset:.82},{transform:'rotateY(0deg) scale(1)'}],{duration:L.turn,delay:flight});
  h.querySelectorAll('.hero-burst i').forEach(d=>run(d,[
   {opacity:0,transform:`rotate(${d.dataset.a}deg) translateX(60px) scale(.2)`},{opacity:1,offset:.02},{opacity:1,offset:.35},
   {opacity:0,transform:`rotate(${d.dataset.a}deg) translateX(${d.dataset.r}px) scale(1)`}],{duration:950,delay:turnEnd-150+Number(d.dataset.ring)*90,easing:'cubic-bezier(.15,.8,.25,1)'}));
  const shine=h.querySelector('.hero-shine');
  for(let i=0;i<L.shines;i++)run(shine,[{transform:'translateX(-130%)'},{transform:'translateX(130%)'}],{duration:700,delay:turnEnd+i*760,easing:'ease-in-out'});
  if(L.wave)run(wave.current,[{opacity:0,clipPath:'circle(0% at 50% 50%)'},{opacity:.5,offset:.25},{opacity:0,clipPath:'circle(75% at 50% 50%)'}],{duration:1500,delay:turnEnd-100,easing:'ease-out'});
  const stamp=h.querySelector('.hero-stamp');
  if(stamp)run(stamp,[{opacity:0,transform:'rotate(8deg) scale(2.4)'},{opacity:1,transform:'rotate(8deg) scale(.95)',offset:.7},{opacity:1,transform:'rotate(8deg) scale(1)'}],{duration:380,delay:turnEnd+500,easing:'cubic-bezier(.3,1.4,.5,1)'});
  const timer=setTimeout(onReady,turnEnd+(L.shines>1?1300:700));
  return()=>{clearTimeout(timer);anims.current.forEach(a=>a.cancel());anims.current=[];};
 },[]);
 // Back into the slot: everything finishes first, so an early tap never leaves the card mid-turn.
 useEffect(()=>{
  if(!landing)return;
  anims.current.forEach(a=>a.finish());
  const a=hero.current.animate([{transform:at(fullBox())},{transform:at(boxOf(slot.current))}],{duration:600,easing:'cubic-bezier(.3,.9,.3,1)',fill:'both'});
  a.onfinish=onLanded;
  return()=>a.cancel();
 },[landing]);
 const rings=RINGS.slice(0,L.rings);
 return <>
  <div ref={wave} className="hero-wave" aria-hidden="true"/>
  <div ref={hero} className="hero" aria-hidden="true">
   <div className="hero-burst">{rings.flatMap((ring,r)=>Array.from({length:ring.count},(_,i)=>
    <i key={`${r}-${i}`} data-a={(360/ring.count)*(i+(r%2)/2)} data-r={300+ring.out} data-ring={r} style={{width:ring.size,height:ring.size,left:-ring.size/2,top:-ring.size/2}}/>))}</div>
   <div ref={inner} className="hero-card">
    <div className="hero-face hero-back"><FaceDown card={card} width={300}/></div>
    <div className="hero-face hero-front"><CardView card={card} variant={variant} total={total} size={.999}/><span className="hero-shine"/></div>
   </div>
   {L.stamp&&<span className="hero-stamp">Found by exploring</span>}
  </div>
 </>;
}
