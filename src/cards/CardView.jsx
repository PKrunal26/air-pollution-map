import React from 'react';
import {RARITY_COLOURS} from './deck';
import {monthLabel,formatStats,foundLabel} from './format';
import '../styles/cards.css';

const BASE=import.meta.env?.BASE_URL??'./';
export const artUrl=(card,variant,wide=false)=>`${BASE}cards/${card.id}${variant?`-${variant}`:''}${wide?'-wide':''}.svg`;
const RARITY_NAMES={common:'Common',uncommon:'Uncommon',rare:'Rare'};
const pad=n=>String(n).padStart(2,'0');

export function RarityDots({rarity}){
 const level=['common','uncommon','rare'].indexOf(rarity)+1;
 return <span className="card-dots" aria-hidden="true">{[4,6,8].map((s,i)=><i key={s} style={{width:s,height:s,background:i<level?'currentColor':'transparent'}}/>)}</span>;
}

// The parts of a card or of its CO print that differ: field data, stats, scale.
export const cardFace=(card,variant)=>variant?{...card,...card.variants.find(v=>v.kind===variant)}:card;

function Front({card,variant}){
 const face=cardFace(card,variant);
 return <div className="card-face card-front">
  <img className="card-art" src={artUrl(card,variant)} alt="" draggable="false"/>
  <div className="card-fade"/>
  <div className="card-pills"><span>{card.type}{variant?' · CO':''}</span><span className="card-rarity">{RARITY_NAMES[card.rarity]} <RarityDots rarity={card.rarity}/></span></div>
  <div className="card-front-text">
   <p className="card-month">{monthLabel(face.months)}</p>
   <h3 className="card-title">{card.name}</h3>
   <dl className="card-stats">{formatStats(face.stats).map(s=><div key={s.label}><dt>{s.label}</dt><dd>{s.value}{s.unit&&<small>{s.unit}</small>}</dd></div>)}</dl>
  </div>
 </div>;
}

function Back({card,variant,foundAt,total}){
 const face=cardFace(card,variant),found=foundLabel(foundAt);
 return <div className="card-face card-back">
  <div className="card-strip"><img src={artUrl(card,variant)} alt="" draggable="false"/></div>
  <div className="card-back-body">
   <p className="card-month">{monthLabel(face.months)} · {card.region}</p>
   <h3 className="card-title">{card.name}</h3>
   {card.back.map((p,i)=><p key={i} className="card-para">{p}</p>)}
   <div className="card-blamed"><p>Often blamed</p><p>{card.blamed} {card.actual}</p></div>
   <p className="card-sources">Full dot at {face.scale.toLocaleString('en-US')} µg/m³. Sources: {card.sources.join('; ')}.</p>
   <p className="card-foot"><span>{pad(card.number)} / {pad(total)}</span>{found&&<span>{found}</span>}</p>
  </div>
 </div>;
}

// A card at 300 × 600, scaled by `size`. Below full size it is a thumbnail: front only, no flip.
export default function CardView({card,variant=null,flipped=false,onFlip,foundAt=null,total,size=1}){
 const thumb=size<1,colour=RARITY_COLOURS[card.rarity];
 const style={'--card-scale':size,'--rarity':colour};
 const inner=<div className="card-scaler"><div className={`card-inner${flipped&&!thumb?' is-flipped':''}`}>
  <Front card={card} variant={variant}/>
  {!thumb&&<Back card={card} variant={variant} foundAt={foundAt} total={total}/>}
  <span className="card-ring"/>
 </div></div>;
 if(thumb)return <div className="event-card is-thumb" style={style}>{inner}</div>;
 return <button type="button" className="event-card" style={style} aria-pressed={flipped} aria-label={`${card.name}, ${flipped?'back':'front'}. Flip the card`} onClick={onFlip}>{inner}</button>;
}
