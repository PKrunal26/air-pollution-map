// The event card deck (src/cards/deck.json): checks on its hand-written content.

export const TYPES=['Wildfire','Peat fire','Crop burning','Savanna burning','Dust storm'];
export const RARITIES=['common','uncommon','rare'];
export const RARITY_COLOURS={common:'#8e9a84',uncommon:'#a9bccc',rare:'#e3c76a'};
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
 // Optional one line shown after a wrong answer: corrects the common belief without giving the answer away.
 if(q.wrongNote!==undefined&&!isText(q.wrongNote))return 'empty wrongNote';
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
 // Optional: the month shown on the card's art and opened by shared links (default: the first month).
 if(c.featuredMonth!==undefined&&!c.months.includes(c.featuredMonth))return 'featuredMonth not in months';
 if(!Array.isArray(c.footprint)||c.footprint.length<3||!c.footprint.every(isPoint))return 'footprint needs at least 3 points';
 if(!(c.bufferKm>=0))return 'bad bufferKm';
 if(!isPoint(c.sourcePoint))return 'bad sourcePoint';
 const stats=statsProblem(c.stats);if(stats)return stats;
 if(!(c.scale>0))return 'bad scale';
 // Optional crop for scripts/card-tools.py art: longitudes west to east, centre latitude.
 if(c.art!==undefined&&!(['lon0','lon1','latCenter'].every(k=>Number.isFinite(c.art?.[k]))&&c.art.lon0<c.art.lon1))return 'bad art crop';
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

const monthIndex=m=>{const [y,mo]=m.split('-').map(Number);return y*12+mo-1;};
const wrap=d=>{const r=((d+180)%360+360)%360-180;return r===-180?180:r;};

// Footprint test in a local flat frame centred on the pin (km): fine at the scale of a buffer of a few hundred km.
// The outline is first made continuous (no jump at the date line), then moved by whole turns to sit nearest the pin.
function inside(card,lat,lon){
 const xs=[];card.footprint.forEach(([x],i)=>xs.push(i?xs[i-1]+wrap(x-card.footprint[i-1][0]):x));
 const mid=xs.reduce((a,b)=>a+b,0)/xs.length,shift=wrap(mid-lon)-mid;
 const k=Math.cos(lat*Math.PI/180),pts=card.footprint.map(([,y],i)=>[(xs[i]+shift)*k*111.32,(y-lat)*110.57]);
 let within=false,best=Infinity;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const [xi,yi]=pts[i],[xj,yj]=pts[j];
  if((yi>0)!==(yj>0)&&0<(xj-xi)*(0-yi)/(yj-yi)+xi)within=!within;
  const dx=xj-xi,dy=yj-yi,t=Math.max(0,Math.min(1,dx||dy?-(xi*dx+yi*dy)/(dx*dx+dy*dy):0));
  best=Math.min(best,Math.hypot(xi+t*dx,yi+t*dy));
 }
 return within||best<=card.bufferKm;
}

// What a pin finds: a CO variant (CO layer on, base card owned), the card itself, a hint one month off, or nothing.
// layers: Set of enabled field ids; owned: Set of collected base card ids. First match in deck order wins.
export function cardAt(deck,{lat,lon,month,layers,owned}){
 const at=monthIndex(month);
 for(const card of deck){
  if(!inside(card,lat,lon))continue;
  const variant=(card.variants??[]).find(v=>v.months.includes(month)&&layers.has(v.field)&&owned.has(card.id));
  if(variant)return {status:'variant',card,variant};
  if(card.months.includes(month))return {status:'found',card,variant:null};
  if(card.months.some(m=>Math.abs(monthIndex(m)-at)===1))return {status:'near-month',card,variant:null};
 }
 return {status:'none',card:null,variant:null};
}
