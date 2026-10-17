import React from 'react';
import {RARITY_COLOURS,RARITY_LABELS as RARITY_NAMES} from './deck';
import {monthLabel,formatStats,foundLabel} from './format';
import '../styles/cards.css';

const BASE=import.meta.env?.BASE_URL??'./';
export const artUrl=(card,variant,wide=false)=>`${BASE}cards/${card.id}${variant?`-${variant}`:''}${wide?'-wide':''}.svg`;
const pad=n=>String(n).padStart(2,'0');

export function RarityDots({rarity}){
 const level=['common','uncommon','rare'].indexOf(rarity)+1;
 return <span className="card-dots" aria-hidden="true">{[4,6,8].map((s,i)=><i key={s} style={{width:s,height:s,background:i<level?'currentColor':'transparent'}}/>)}</span>;
}

// The parts of a card or of its CO print that differ: field data, stats, scale.
export const cardFace=(card,variant)=>variant?{...card,...card.variants.find(v=>v.kind===variant)}:card;

function Front({card,variant,hidden}){
 const face=cardFace(card,variant);
 return <div className="card-face card-front" aria-hidden={hidden||undefined}>
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

function Back({card,variant,foundAt,earned,total,hidden}){
 const face=cardFace(card,variant),found=foundLabel(foundAt);
 return <div className="card-face card-back" aria-hidden={hidden||undefined}>
  <div className="card-strip"><img src={artUrl(card,variant)} alt="" draggable="false"/></div>
  <div className="card-back-body">
   <p className="card-month">{monthLabel(face.months)} · {card.region}</p>
   <h3 className="card-title">{card.name}</h3>
   {card.back.map((p,i)=><p key={i} className="card-para">{p}</p>)}
   <div className="card-blamed"><p>Often blamed</p><p>{card.blamed} {card.actual}</p></div>
   {card.helps&&<div className="card-blamed"><p>What helps</p><p>{card.helps.text}</p></div>}
   <p className="card-sources">Full dot at {face.scale.toLocaleString('en-US')} µg/m³; × WHO compares the average day with WHO's 24-hour guideline. Sources: {card.sources.join('; ')}.</p>
   <p className="card-foot"><span>{pad(card.number)} / {pad(total)}{earned?.marks.length?` · ${earned.marks.join(' · ')}`:''}</span>{found&&<span>{found}</span>}</p>
  </div>
 </div>;
}

// A card at 300 × 600, scaled by `size`. Below full size it is a thumbnail: front only, no flip. At full size the
// faces stay plain content (headings and text are not allowed inside a button); a transparent flip button covers the
// card, and the face turned away is hidden from screen readers.
export default function CardView({card,variant=null,flipped=false,onFlip,foundAt=null,earned=null,total,size=1}){
 const thumb=size<1,colour=RARITY_COLOURS[card.rarity];
 const style={'--card-scale':size,'--rarity':colour};
 const inner=<div className="card-scaler"><div className={`card-inner${flipped&&!thumb?' is-flipped':''}`}>
  <Front card={card} variant={variant} hidden={flipped&&!thumb}/>
  {!thumb&&<Back card={card} variant={variant} foundAt={foundAt} earned={earned} total={total} hidden={!flipped}/>}
  <span className="card-ring"/>
 </div></div>;
 if(thumb)return <div className="event-card is-thumb" style={style}>{inner}</div>;
 return <div className="event-card is-flippable" style={style}>{inner}<button type="button" className="card-flip" aria-pressed={flipped} aria-label={`Flip the card: showing the ${flipped?'back':'front'}`} onClick={onFlip}/></div>;
}
