import React from 'react';
import {RARITY_COLOURS} from './deck';

const pad=n=>String(n).padStart(2,'0');

// A face-down card: the number on a halftone back, the rarity colour on the edge.
export function FaceDown({card,width=26}){
 return <span className="card-facedown" style={{'--rarity':RARITY_COLOURS[card.rarity],width,height:width*2,fontSize:width/9}} aria-hidden="true"><b>{pad(card.number)}</b></span>;
}

// The row a readout gains when the spot holds a card. Hovering shows only that a card is there; a pinned spot offers
// the question (or the card, once collected).
export default function ReadoutCardRow({hit,hover=false,collected,waitMs,onAnswer,onView}){
 const minutes=Math.max(1,Math.ceil(waitMs/60000)),variant=hit.status==='variant';
 const [title,note]=collected?[variant?'You have this print':'You have this card','']
  :hover?[variant?'A second print is here':'A card is here','Click to collect it']
  :waitMs>0?[variant?'A second print is here':'A card is here',`New question in ${minutes} min, or find another card`]
  :[variant?'A second print is here':'A card is here','Answer one question to collect it'];
 return <div className="card-row">
  <div className="card-row-main"><FaceDown card={hit.card}/><div><p className="card-row-title">{title}</p>{note&&<p className="card-row-note">{note}</p>}</div></div>
  {hover?null:collected?<button type="button" className="card-row-button" onClick={onView}>View</button>
   :<button type="button" className="card-row-button is-primary" disabled={waitMs>0} onClick={onAnswer}>Answer</button>}
 </div>;
}
