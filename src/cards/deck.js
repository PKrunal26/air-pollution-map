// The event card deck (src/cards/deck.json): checks on its hand-written content.

export const TYPES=['Wildfire','Peat fire','Crop burning','Savanna burning','Dust storm'];
export const RARITIES=['common','uncommon','rare'];
export const VARIANT_KINDS=['co'];
// The monthly history starts here; a card's months must be inside it.
export const HISTORY_START='2022-08';

export const monthKey=validAt=>new Date(validAt).toISOString().slice(0,7);

const isMonth=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m)&&m>=HISTORY_START;
const isPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const isText=t=>typeof t==='string'&&t.trim().length>0;

function questionProblem(q){
 if(!q||!isText(q.prompt))return 'question without prompt';
 if(!Array.isArray(q.options)||q.options.length!==4||!q.options.every(isText))return 'question needs four options';
 if(!Number.isInteger(q.answer)||q.answer<0||q.answer>3)return 'answer out of range';
 if(!isText(q.explanation))return 'question without explanation';
 if(!isText(q.source))return 'question without source';
 return null;
}
function statsProblem(s){
 return ['peak','whoX','areaKm2','reachKm'].every(k=>Number.isFinite(s?.[k]?.value))?null:'stats incomplete';
}
function cardProblem(c){
 if(!isText(c?.id))return 'missing id';
 if(!Number.isInteger(c.number)||c.number<1)return 'bad number';
 if(!isText(c.name))return 'missing name';
 if(!TYPES.includes(c.type))return `unknown type ${c.type}`;
 if(!RARITIES.includes(c.rarity))return `unknown rarity ${c.rarity}`;
 if(!isText(c.field))return 'missing field';
 if(!Array.isArray(c.months)||!c.months.length||!c.months.every(isMonth))return 'bad months';
 if(!Array.isArray(c.footprint)||c.footprint.length<3||!c.footprint.every(isPoint))return 'footprint needs at least 3 points';
 if(!(c.bufferKm>=0))return 'bad bufferKm';
 if(!isPoint(c.sourcePoint))return 'bad sourcePoint';
 const stats=statsProblem(c.stats);if(stats)return stats;
 if(!(c.scale>0))return 'bad scale';
 if(!['riddle','region','country','month'].every(k=>isText(c.clues?.[k])))return 'clues incomplete';
 if(!Array.isArray(c.questions)||c.questions.length<2||c.questions.length>3)return 'needs 2 or 3 questions';
 for(const q of c.questions){const p=questionProblem(q);if(p)return p;}
 if(!Array.isArray(c.back)||!c.back.length||!c.back.every(isText))return 'missing back text';
 if(!isText(c.blamed)||!isText(c.actual))return 'missing often-blamed text';
 if(!Array.isArray(c.sources)||!c.sources.length||!c.sources.every(isText))return 'missing sources';
 for(const v of c.variants??[]){
  if(!VARIANT_KINDS.includes(v?.kind))return `unknown variant ${v?.kind}`;
  if(!isText(v.field)||!Array.isArray(v.months)||!v.months.length||!v.months.every(isMonth))return 'bad variant';
  const vs=statsProblem(v.stats);if(vs)return `variant ${vs}`;
  if(!(v.scale>0))return 'bad variant scale';
  const q=questionProblem(v.question);if(q)return `variant ${q}`;
 }
 return null;
}

// Returns the deck unchanged, or throws Error('Invalid card <id>: <reason>').
export function validateDeck(deck){
 if(!Array.isArray(deck))throw new Error('Invalid card deck: not a list');
 const ids=new Set(),numbers=new Set();
 for(const c of deck){
  const problem=cardProblem(c)??(ids.has(c.id)?'duplicate id':numbers.has(c.number)?'duplicate number':null);
  if(problem)throw new Error(`Invalid card ${c?.id??'?'}: ${problem}`);
  ids.add(c.id);numbers.add(c.number);
 }
 return deck;
}
