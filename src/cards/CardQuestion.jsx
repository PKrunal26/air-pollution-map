import React,{useEffect,useRef,useState} from 'react';
import CardView from './CardView';
import {FaceDown} from './ReadoutCardRow';
import {RARITY_COLOURS} from './deck';
import ShareButton from './ShareButton';

const RARITY_NAMES={common:'Common',uncommon:'Uncommon',rare:'Rare'};
const LETTERS='ABCD';

// The focused question: the face-down card beside its question, then the outcome. One try per question.
// onAnswer(choice) applies the answer and returns whether it was right.
export default function CardQuestion({card,variant,question,total,foundCount,onAnswer,onClose,onShowCards}){
 const [pick,setPick]=useState(null),[right,setRight]=useState(null),[flipped,setFlipped]=useState(false);
 const box=useRef(null);
 useEffect(()=>{
  const opener=document.activeElement;
  box.current?.querySelector('button')?.focus({preventScroll:true});
  return()=>opener?.focus?.({preventScroll:true});
 },[]);
 // Escape closes from anywhere: answering disables the options, which can drop focus out of the dialog.
 const close=useRef(onClose);close.current=onClose; // the parent passes a new onClose on every render
 useEffect(()=>{
  const escape=e=>{if(e.key==='Escape'){e.stopPropagation();close.current();}};
  document.addEventListener('keydown',escape,true);return()=>document.removeEventListener('keydown',escape,true);
 },[]);
 // After answering, focus moves to the outcome's first button.
 useEffect(()=>{if(pick!==null)box.current?.querySelector('.card-question-actions button')?.focus({preventScroll:true});},[pick,right]);
 const keys=e=>{
  if(e.key!=='Tab')return;
  const items=[...box.current.querySelectorAll('button:not(:disabled)')];if(!items.length)return;
  const first=items[0],last=items.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 };
 const choose=i=>{if(pick!==null)return;setPick(i);setRight(onAnswer(i));};
 const label=`Card ${String(card.number).padStart(2,'0')}${variant?' · CO print':''} · ${RARITY_NAMES[card.rarity]}`;
 return <div className="card-question-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={box} className="card-question" role="dialog" aria-modal="true" aria-label={`${label}: question`} onKeyDown={keys} style={{'--rarity':RARITY_COLOURS[card.rarity]}}>
   <div className="card-question-card">{right?<div className="card-reveal"><CardView card={card} variant={variant} flipped={flipped} onFlip={()=>setFlipped(v=>!v)} total={total} foundAt={Date.now()} size={.46}/></div>:<FaceDown card={card} width={138}/>}</div>
   <div className="card-question-body">
    {right?<>
     <p className="card-question-meta">{label} · collected</p>
     <h2>Right: {question.options[question.answer]}</h2>
     <p className="card-question-text">{question.explanation}</p>
     {Number.isFinite(foundCount)&&<p className="card-question-meta">{foundCount.toLocaleString('en-US')} {foundCount===1?'person has':'people have'} found this card.</p>}
     <div className="card-question-actions">
      <ShareButton card={card} variant={variant}/>
      {onShowCards&&<button type="button" onClick={onShowCards}>See your cards</button>}
      <button type="button" onClick={onClose}>Keep exploring</button>
     </div>
    </>:<>
     <p className="card-question-meta">{label} · {pick===null?'question':'not collected yet'}</p>
     <h2>{question.prompt}</h2>
     <div className="card-question-options">{question.options.map((option,i)=><button type="button" key={i} disabled={pick!==null} className={pick===i?'is-picked':undefined} onClick={()=>choose(i)}><span>{LETTERS[i]}</span>{option}{pick===i&&<em>Your answer</em>}</button>)}</div>
     {pick===null?<p className="card-question-meta">One try. If you miss, a different question opens in an hour, or sooner if you find another card.</p>:<>
      <p className="card-question-text"><b>Not this time.</b>{question.wrongNote?` ${question.wrongNote}`:''}</p>
      <p className="card-question-meta">A different question opens in 1 hour, or as soon as you find another card.</p>
      <div className="card-question-actions"><button type="button" onClick={onClose}>Keep exploring</button></div>
     </>}
    </>}
   </div>
  </section>
 </div>;
}
