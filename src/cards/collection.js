// A visitor's event cards: what they found and collected, and the wait after a wrong answer. Pure functions over a
// small state object; the browser copy lives in localStorage and every access tolerates storage being unavailable.
// Keys are card ids, or '<id>:<kind>' for a variant (e.g. 'indonesia-2026:co').

export const WAIT_MS=3600000;
export const STORAGE_KEY='air-atlas.cards';

// clues: furthest clue step opened per card (1 region, 2 country, 3 month); seen: the clue view was opened at all;
// earned: how each card was won ({level, marks}), kept for the back of the card.
export const emptyState=()=>({v:1,collected:{},found:{},attempts:{},clues:{},seen:{},earned:{}});
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

// Opening a card's clue (steps 0: the riddle only) marks it seen; the furthest step is kept.
export function openClue(state,id,steps){
 return {...state,seen:{...state.seen,[id]:true},clues:{...state.clues,[id]:Math.max(state.clues[id]??0,steps)}};
}

// How a card is being won, which sets the size of the moment (not its rarity). Reading the riddle is the hunt, not a
// hint; clue steps are. A CO print has no clue steps of its own: full if right first time, quiet otherwise.
export function earnedFor(state,key){
 const firstTry=!state.attempts[key];
 if(kindOf(key))return firstTry?{level:'full',marks:['First try']}:{level:'quiet',marks:[]};
 const seen=!!state.seen[key],hints=(state.clues[key]??0)>0;
 if(!seen&&firstTry)return {level:'explore',marks:['Found by exploring','First try']};
 if(firstTry&&!hints)return {level:'full',marks:['First try','No hints']};
 if(firstTry)return {level:'medium',marks:['First try']};
 if(!seen)return {level:'medium',marks:['Found by exploring']};
 if(!hints)return {level:'medium',marks:['No hints']};
 return {level:'quiet',marks:[]};
}

export function answer(state,key,card,choice,now){
 const correct=choice===questionFor(card,state,key).question.answer;
 if(correct)return {correct,state:{...state,collected:{...state.collected,[key]:now},earned:{...state.earned,[key]:earnedFor(state,key)}}};
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
// localStorage itself can throw on access (site data blocked), so it is looked up inside the try.
const resolve=storage=>storage===undefined?globalThis.localStorage:storage;
export function loadCollection(storage){
 try{
  const s=JSON.parse(resolve(storage)?.getItem(STORAGE_KEY)??'null');
  if(!(s?.v===1&&isMap(s.collected)&&isMap(s.found)&&isMap(s.attempts)))return emptyState();
  return {...s,clues:isMap(s.clues)?s.clues:{},seen:isMap(s.seen)?s.seen:{},earned:isMap(s.earned)?s.earned:{}};
 }catch{return emptyState();}
}

// Two tabs each hold their own copy: union what was collected and found (earliest date wins, a known date beats
// none). Every rule is order-independent (merge(a,b) equals merge(b,a)), so two tabs settle on the same state instead
// of rewriting each other's save forever: attempts keep the later try, clues the furthest step, earned the same pick.
const earliest=(a,b)=>a==null?b??null:b==null?a:Math.min(a,b);
function union(a,b){
 const out={...a};
 for(const [k,v] of Object.entries(b))out[k]=k in out?earliest(out[k],v):v;
 return out;
}
const furthest=(a,b)=>{const out={...a};for(const [k,v] of Object.entries(b))out[k]=Math.max(out[k]??0,v);return out;};
const pick=(a,b,better)=>{const out={...a};for(const [k,v] of Object.entries(b))out[k]=k in out?better(out[k],v):v;return out;};
const laterTry=(a,b)=>(b.q-a.q||b.waitUntil-a.waitUntil)>0?b:a;
const sameChoice=(a,b)=>JSON.stringify(b)>JSON.stringify(a)?b:a;
export const mergeStates=(mine,other)=>({v:1,collected:union(mine.collected,other.collected),found:union(mine.found,other.found),
 attempts:pick(mine.attempts,other.attempts,laterTry),clues:furthest(mine.clues??{},other.clues??{}),
 seen:pick(mine.seen??{},other.seen??{},(a,b)=>a||b),earned:pick(mine.earned??{},other.earned??{},sameChoice)});

// JSON with object keys sorted, so equal states serialise the same whatever order their keys were added in.
const canonical=v=>JSON.stringify(v,(k,x)=>isMap(x)?Object.fromEntries(Object.keys(x).sort().map(key=>[key,x[key]])):x);

export function saveCollection(state,storage){
 try{
  const store=resolve(storage);if(!store)return;
  // Writes only when something changed: every write fires a storage event in the other tabs, which merge and save.
  const next=canonical(mergeStates(state,loadCollection(store)));
  if(store.getItem(STORAGE_KEY)!==next)store.setItem(STORAGE_KEY,next);
 }catch{}
}
