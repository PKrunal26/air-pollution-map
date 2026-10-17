import React,{useEffect,useRef,useState} from 'react';
import CardView from './CardView';
import {FaceDown} from './ReadoutCardRow';
import {RARITY_COLOURS,RARITY_LABELS as RARITY_NAMES} from './deck';
import ShareButton from './ShareButton';
import CollectHero from './CollectHero';

const LETTERS='ABCD';
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthName=key=>key?`${MONTHS[Number(key.slice(5))-1]} ${key.slice(0,4)}`:null;
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// Your find, step by step: what you did to earn the card.
function findSteps({card,variant,month,earned}){
 const blind=earned?.marks.includes('Found by exploring');
 return [variant?'Turned on the CO layer':blind?'Found it without the clue':'Read the clue',`Found it in ${card.clues.country}`,month&&`Picked ${monthName(month)}`,'Knew the cause'].filter(Boolean);
}

// The focused question, one try. A right answer locks in, the card takes the screen (CollectHero), then it settles back
// into this dialog with the recap: your find, the marks you earned, and how far your collection and its set have come.
// onAnswer(choice) applies the answer and returns whether it was right; `result` ({earned, set, setsDone}) follows from it.
export default function CardQuestion({card,variant,question,total,month,result,foundCount,onAnswer,onClose,onShowCards,onRecap}){
 const [pick,setPick]=useState(null),[stage,setStage]=useState('ask'),[landing,setLanding]=useState(false),[landed,setLanded]=useState(false);
 const box=useRef(null),slot=useRef(null),stageRef=useRef(stage),timer=useRef(0);stageRef.current=stage;
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const close=useRef(onClose);close.current=onClose; // the parent passes a new onClose on every render
 useEffect(()=>{
  const opener=document.activeElement;
  box.current?.querySelector('button')?.focus({preventScroll:true});
  return()=>opener?.focus?.({preventScroll:true});
 },[]);
 // Escape: during the full-screen moment it continues; otherwise it closes.
 useEffect(()=>{
  const key=e=>{
   if(stageRef.current==='hero'){if(e.key==='Escape'||e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();setLanding(true);}return;}
   if(e.key==='Escape'){e.stopPropagation();close.current();}
  };
  document.addEventListener('keydown',key,true);return()=>document.removeEventListener('keydown',key,true);
 },[]);
 useEffect(()=>{if(stage==='recap'||(stage==='ask'&&pick!==null))box.current?.querySelector('.card-question-actions button')?.focus({preventScroll:true});},[stage,pick]);
 const keys=e=>{
  if(e.key!=='Tab')return;
  const items=[...box.current.querySelectorAll('button:not(:disabled)')];if(!items.length)return;
  const first=items[0],last=items.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 };
 const choose=i=>{
  if(pick!==null)return;setPick(i);
  // The options are disabled now: keep focus in the dialog, not on the page behind it.
  box.current?.focus({preventScroll:true});
  if(!onAnswer(i))return;
  setStage('locked');
  timer.current=setTimeout(()=>{if(reduced()){setLanded(true);setStage('recap');onRecap?.();}else setStage('hero');},800);
 };
 const landedNow=()=>{setLanded(true);setStage('recap');onRecap?.();};
 const label=`Card ${String(card.number).padStart(2,'0')}${variant?' · CO print':''} · ${RARITY_NAMES[card.rarity]}`;
 const collecting=stage==='hero'||stage==='recap';
 const phone=typeof innerWidth==='number'&&innerWidth<=700;
 const set=result?.set,done=result?.setsDone??[];
 return <div className={`card-question-backdrop${stage==='hero'?' is-hero':''}`} onClick={e=>{if(stage==='hero'){setLanding(true);return;}if(e.target===e.currentTarget)onClose();}}>
  <section ref={box} className={`card-question${collecting?' is-collected':''}${stage==='recap'?' is-recap':''}`} role="dialog" aria-modal="true" aria-label={`${label}: question`} tabIndex={-1} onKeyDown={keys} style={{'--rarity':RARITY_COLOURS[card.rarity]}}>
   <div className="card-question-card" ref={slot}>{collecting
    ?<div className="collect-slot" style={{visibility:landed?'visible':'hidden'}}><CardView card={card} variant={variant} total={total} size={phone?.4:.6}/></div>
    :<FaceDown card={card} width={138}/>}</div>
   <div className="card-question-body">
    {collecting?<>
     <p className="card-question-meta">{label} · collected</p>
     <h2>Right: {question.options[question.answer]}</h2>
     {Number.isInteger(question.belief)&&<p className="collect-belief"><s>{question.options[question.belief]}</s> is the common belief, not the cause.</p>}
     <p className="card-question-text">{question.explanation}</p>
     <ul className="collect-steps">{findSteps({card,variant,month,earned:result?.earned}).map((s,i)=><li key={i} style={{'--i':i}}><i>✓</i>{s}</li>)}</ul>
     {result?.earned?.marks.length>0&&<p className="collect-marks">{result.earned.marks.map((m,i)=><span key={m} style={{'--i':i}}>{m}</span>)}</p>}
     {set&&<div className="collect-set" style={{'--from':`${100*set.before/set.total}%`,'--to':`${100*set.after/set.total}%`}}>
      <p><span>{set.name}</span><span>{set.after} of {set.total}</span></p><i><b/></i>
      {done.map(s=><p key={s.id} className="collect-done">{s.id==='all'?'Every card found.':`${s.name} set complete: every ${s.name.toLowerCase()} event found.`}</p>)}
     </div>}
     {Number.isFinite(foundCount)&&<p className="card-question-meta">{foundCount.toLocaleString('en-US')} {foundCount===1?'person has':'people have'} found this card.</p>}
     <div className="card-question-actions">
      <ShareButton card={card} variant={variant}/>
      {onShowCards&&<button type="button" onClick={onShowCards}>See your cards</button>}
      <button type="button" onClick={onClose}>Keep exploring</button>
     </div>
    </>:<>
     <p className="card-question-meta">{label} · {pick===null?'question':stage==='locked'?'right':'not collected yet'}</p>
     <h2>{question.prompt}</h2>
     <div className="card-question-options">{question.options.map((option,i)=>{
      const right=stage==='locked'&&i===question.answer,belief=stage==='locked'&&i===question.belief;
      return <button type="button" key={i} disabled={pick!==null} className={right?'is-right':pick===i?'is-picked':belief?'is-belief':undefined} onClick={()=>choose(i)}>
       <span>{LETTERS[i]}</span>{belief?<s>{option}</s>:option}{pick===i&&<em>Your answer</em>}</button>;})}</div>
     {pick===null?<p className="card-question-meta">One try. If you miss, a different question opens in an hour, or sooner if you find another card.</p>
     :stage==='ask'&&<>
      <p className="card-question-text"><b>Not this time.</b>{question.wrongNote?` ${question.wrongNote}`:''}</p>
      <p className="card-question-meta">{variant?'You can try again in 1 hour, or as soon as you find another card.':'A different question opens in 1 hour, or as soon as you find another card.'}</p>
      <div className="card-question-actions"><button type="button" onClick={onClose}>Keep exploring</button></div>
     </>}
    </>}
   </div>
  </section>
  {stage==='hero'&&<CollectHero card={card} variant={variant} total={total} level={result?.earned?.level??'quiet'} slot={slot} landing={landing} onReady={()=>{}} onLanded={landedNow}/>}
  {stage==='hero'&&<p className="hero-tap">Tap to continue</p>}
  {/* The full-screen moment is visual only; this line tells screen readers what happened. */}
  <p className="visually-hidden" role="status">{collecting?`Collected: ${card.name}. Right: ${question.options[question.answer]}.`:''}</p>
 </div>;
}
