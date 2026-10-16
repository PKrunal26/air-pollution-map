// A visitor's event cards: what they found and collected, and the wait after a wrong answer. Pure functions over a
// small state object; the browser copy lives in localStorage and every access tolerates storage being unavailable.
// Keys are card ids, or '<id>:<kind>' for a variant (e.g. 'indonesia-2026:co').

export const WAIT_MS=3600000;
export const STORAGE_KEY='air-atlas.cards';

export const emptyState=()=>({v:1,collected:{},found:{},attempts:{}});
export const variantKey=(id,kind)=>`${id}:${kind}`;
const kindOf=key=>key.includes(':')?key.slice(key.indexOf(':')+1):null;

// Finding a card you have neither collected nor found before clears every wait (the next question stays the same).
export function markFound(state,key,now){
 const fresh=!(key in state.collected)&&!(key in state.found);
 const attempts=fresh?Object.fromEntries(Object.entries(state.attempts).map(([k,a])=>[k,{...a,waitUntil:0}])):state.attempts;
 return {...state,attempts,found:key in state.found?state.found:{...state.found,[key]:now}};
}

export function questionFor(card,state,key){
 const kind=kindOf(key);
 if(kind)return {question:card.variants.find(v=>v.kind===kind).question,index:0};
 const index=(state.attempts[key]?.q??0)%card.questions.length;
 return {question:card.questions[index],index};
}

export function answer(state,key,card,choice,now){
 const correct=choice===questionFor(card,state,key).question.answer;
 if(correct)return {correct,state:{...state,collected:{...state.collected,[key]:now}}};
 const q=(state.attempts[key]?.q??0)+1;
 return {correct,state:{...state,attempts:{...state.attempts,[key]:{q,waitUntil:now+WAIT_MS}}}};
}

// Clamped so a clock moved back never makes the wait longer than an hour.
export const waitLeft=(state,key,now)=>Math.max(0,Math.min(WAIT_MS,(state.attempts[key]?.waitUntil??0)-now));

// Cards restored from a recovery link: added without a date, existing ones keep theirs.
export function mergeCollected(state,keys){
 const collected={...state.collected};
 for(const key of keys)if(!(key in collected))collected[key]=null;
 return {...state,collected};
}

const isMap=v=>v&&typeof v==='object'&&!Array.isArray(v);
export function loadCollection(storage=globalThis.localStorage){
 try{
  const s=JSON.parse(storage?.getItem(STORAGE_KEY)??'null');
  return s?.v===1&&isMap(s.collected)&&isMap(s.found)&&isMap(s.attempts)?s:emptyState();
 }catch{return emptyState();}
}
export function saveCollection(state,storage=globalThis.localStorage){
 try{storage?.setItem(STORAGE_KEY,JSON.stringify(state));}catch{}
}
