import React from 'react';
import CardView from './CardView';
import {FaceDown} from './ReadoutCardRow';
import {RARITY_COLOURS} from './deck';

// Rings of halftone dots burst from behind the card: one ring for a yearly event, three for a once-in-decades one.
// Each ring is a regular circle of dots, smaller further out (dot size reads as intensity, as on the globe).
// out: how far past the card's half-height each ring travels.
const RINGS=[{count:14,out:28,size:10},{count:20,out:62,size:7},{count:26,out:96,size:4.5}];
const LEVEL={common:1,uncommon:2,rare:3};

// Collecting a card: it charges up face-down, flips with a little overshoot, dots burst out and a light sweeps across it.
export default function CardReveal({card,variant,total,size=.6}){
 const rings=RINGS.slice(0,LEVEL[card.rarity]);
 return <div className={`reveal is-${card.rarity}`} style={{'--rarity':RARITY_COLOURS[card.rarity],'--w':`${300*size}px`,'--h':`${600*size}px`}}>
  <div className="reveal-burst" aria-hidden="true">{rings.flatMap((ring,r)=>Array.from({length:ring.count},(_,i)=>
   <i key={`${r}-${i}`} style={{'--a':`${(360/ring.count)*(i+(r%2)/2)}deg`,'--r':`${300*size+ring.out}px`,'--s':`${ring.size}px`,'--d':`${880+r*90}ms`}}/>))}</div>
  <div className="reveal-flip"><div className="reveal-inner">
   <div className="reveal-face reveal-back"><FaceDown card={card} width={300*size}/></div>
   <div className="reveal-face reveal-front"><CardView card={card} variant={variant} total={total} size={size}/><span className="reveal-shine"/></div>
  </div></div>
 </div>;
}
