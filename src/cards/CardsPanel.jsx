import React,{useEffect,useState} from 'react';
import {X} from '@phosphor-icons/react';
import CardView,{artUrl} from './CardView';
import {FaceDown} from './ReadoutCardRow';
import {RARITY_COLOURS,RARITY_LABELS as RARITY_NAMES} from './deck';
import {waitLeft,variantKey} from './collection';
import {cardSets} from './sets';

const FILTERS=[['All',null],['Wildfire','Wildfire'],['Peat','Peat fire'],['Crop','Crop burning'],['Savanna','Savanna burning'],['Dust','Dust storm']];
const STEPS=[['region','Region'],['country','Country'],['month','Month']];
const MONTH_LETTERS='JFMAMJJASOND';
const pad=n=>String(n).padStart(2,'0');

// One bar per set (each type with two or more cards, then the whole deck); a finished set shows its bar full and lit.
function Progress({deck,cards}){
 return <div className="cards-progress">{cardSets(deck).map(set=>{
  const got=set.ids.filter(id=>id in cards.collected).length,done=got===set.ids.length;
  return <div key={set.id} className={done?'is-done':undefined}><p><span>{set.name}</span><span>{got}/{set.ids.length}</span></p><i><b style={{width:`${100*got/set.ids.length}%`}}/></i></div>;
 })}</div>;
}

function Slot({card,cards,now,total,onOpen,onClue}){
 const owned=card.id in cards.collected,found=card.id in cards.found,wait=waitLeft(cards,card.id,now);
 const moreToFind=owned&&(card.variants??[]).some(v=>!(variantKey(card.id,v.kind) in cards.collected));
 if(owned)return <button type="button" className="cards-slot" onClick={()=>onOpen(card)} aria-label={`${card.name}, open`}>
  <CardView card={card} total={total} size={.3}/>{moreToFind&&<span className="cards-more" title="A second print of this card exists"/>}
 </button>;
 return <button type="button" className="cards-slot" onClick={()=>onClue(card)} aria-label={`Card ${pad(card.number)}${found?', found':''}, clue`}>
  {found?<span className="cards-seen" style={{'--rarity':RARITY_COLOURS[card.rarity]}}><img src={artUrl(card,null)} alt=""/><b>{pad(card.number)}</b></span>:<FaceDown card={card} width={90}/>}
  {found&&wait>0&&<span className="cards-wait">Found · {Math.ceil(wait/60000)} min</span>}
 </button>;
}

function ClueView({card,opened,onOpenStep,onBack}){
 const monthOpen=opened>=3,calendar=new Set(card.months.map(m=>Number(m.slice(5))-1));
 return <div className="cards-clue">
  <button type="button" className="cards-back" onClick={onBack}>← All cards</button>
  <div className="cards-clue-card"><FaceDown card={card} width={130}/></div>
  <p className="cards-meta">{pad(card.number)} · {RARITY_NAMES[card.rarity]} · {card.type}</p>
  <p className="cards-riddle">{card.clues.riddle}</p>
  <p className="cards-meta">Clues</p>
  <div className="cards-steps">{STEPS.map(([key,label],i)=>i<opened
   ?<div key={key} className="cards-step is-open"><span>{label}</span>{key==='month'?card.clues.month:card.clues[key]}</div>
   :<button key={key} type="button" className="cards-step" disabled={i>opened} onClick={()=>onOpenStep(i+1)}><span>{label}</span>Show</button>)}</div>
  <div className={`cards-months${monthOpen?' is-open':''}`} aria-label={monthOpen?`Found in ${card.clues.month}`:'Month not shown yet'}>
   {[...MONTH_LETTERS].map((m,i)=><span key={i} className={monthOpen&&calendar.has(i)?'is-on':undefined}>{m}</span>)}
  </div>
 </div>;
}

// The Compendium: every slot of the deck, your progress, the clues, and the recovery link.
export default function CardsPanel({deck,cards,now,total,clueFor,onClose,onOpen,onClue,saveLink}){
 const [filter,setFilter]=useState(null),[clue,setClue]=useState(clueFor??null),[copied,setCopied]=useState(false);
 // Arriving on a clue (from a shared card) counts as opening it.
 useEffect(()=>{if(clueFor)onClue(clueFor,0);},[]);
 const shown=deck.filter(c=>!filter||c.type===filter);
 const copy=async()=>{const url=saveLink();try{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{window.prompt('Copy this link to keep your cards',url);}};
 const owned=deck.filter(c=>c.id in cards.collected).length;
 const current=clue&&deck.find(c=>c.id===clue);
 return <section className="cards-panel" aria-label="Cards" onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();current?setClue(null):onClose();}}}>
  <div className="cards-head"><h2>Cards</h2><span>{owned} of {deck.length}</span><button type="button" className="icon-button" aria-label="Close cards" onClick={onClose}><X size={16} weight="light"/></button></div>
  <div className="cards-scroll scroll-fade">
   {current?<ClueView card={current} opened={cards.clues[current.id]??0} onOpenStep={n=>onClue(current.id,n)} onBack={()=>setClue(null)}/>:<>
    <Progress deck={deck} cards={cards}/>
    <div className="cards-filters" role="group" aria-label="Filter by type">{FILTERS.map(([label,type])=><button key={label} type="button" aria-pressed={filter===type} onClick={()=>setFilter(type)}>{label}</button>)}</div>
    <div className="cards-grid">{shown.map(card=><Slot key={card.id} card={card} cards={cards} now={now} total={total} onOpen={onOpen} onClue={c=>{onClue(c.id,0);setClue(c.id);}}/>)}</div>
   </>}
  </div>
  <div className="cards-foot"><p>Your cards are kept in this browser. Save a link to keep them anywhere.</p><button type="button" onClick={copy}>{copied?'Link copied':'Save link'}</button></div>
 </section>;
}
