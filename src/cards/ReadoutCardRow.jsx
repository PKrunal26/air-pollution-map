import React from 'react';
import {RARITY_COLOURS} from './deck';

const pad=n=>String(n).padStart(2,'0');

// A face-down card: the number on a halftone back, the rarity colour on the edge.
export function FaceDown({card,width=26}){
 return <span className="card-facedown" style={{'--rarity':RARITY_COLOURS[card.rarity],width,height:width*2,fontSize:width/9}} aria-hidden="true"><b>{pad(card.number)}</b></span>;
}

// The row a pinned readout gains when the spot holds a card (or one is near in time).
export default function ReadoutCardRow({hit,collected,waitMs,onAnswer,onView}){
 if(hit.status==='near-month')return <p className="card-row-hint">Something happened here in another month.</p>;
 const minutes=Math.max(1,Math.ceil(waitMs/60000)),variant=hit.status==='variant';
 const [title,note]=collected?[variant?'You have this print':'You have this card','']
  :waitMs>0?[variant?'A second print is here':'A card is here',`New question in ${minutes} min, or find another card`]
  :[variant?'A second print is here':'A card is here','Answer one question to collect it'];
 return <div className="card-row">
  <div className="card-row-main"><FaceDown card={hit.card}/><div><p className="card-row-title">{title}</p>{note&&<p className="card-row-note">{note}</p>}</div></div>
  {collected?<button type="button" className="card-row-button" onClick={onView}>View</button>
   :<button type="button" className="card-row-button is-primary" disabled={waitMs>0} onClick={onAnswer}>Answer</button>}
 </div>;
}
