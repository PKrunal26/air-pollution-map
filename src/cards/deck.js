// The event card deck (src/cards/deck.json): checks on its hand-written content.

export const TYPES=['Wildfire','Peat fire','Crop burning','Savanna burning','Dust storm'];
export const RARITIES=['common','uncommon','rare'];
export const RARITY_COLOURS={common:'#8e9a84',uncommon:'#a9bccc',rare:'#e3c76a'};
// Shown names say how often an event happens, so a yearly event never reads as less important than a rare one.
export const RARITY_LABELS={common:'Every year',uncommon:'Every few years',rare:'Once in decades'};
export const VARIANT_KINDS=['co'];
// The monthly history starts here; a card's months must be inside it.
export const HISTORY_START='2022-08';

export const monthKey=validAt=>new Date(validAt).toISOString().slice(0,7);

const isMonth=m=>typeof m==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(m)&&m>=HISTORY_START;
const isPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
const isText=t=>typeof t==='string'&&t.trim().length>0;
export const BACK_BUDGET=600;
const backLength=c=>[...c.back,c.blamed,c.actual,c.helps?.text??'',c.sources.join('; ')].join('').length;

function questionProblem(q){
 if(!q||!isText(q.prompt))return 'question without prompt';
 if(!Array.isArray(q.options)||q.options.length!==4||!q.options.every(isText))return 'question needs four options';
 if(!Number.isInteger(q.answer)||q.answer<0||q.answer>3)return 'answer out of range';
 if(!isText(q.explanation))return 'question without explanation';
 if(!isText(q.source))return 'question without source';
 // Optional one line shown after a wrong answer: corrects the common belief without giving the answer away.
 if(q.wrongNote!==undefined&&!isText(q.wrongNote))return 'empty wrongNote';
 // Optional: the wrong option most people believe; struck out when the player gets it right.
 if(q.belief!==undefined&&!(Number.isInteger(q.belief)&&q.belief>=0&&q.belief<=3&&q.belief!==q.answer))return 'belief must be a wrong option';
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
 // The 300 × 600 back fits about this much text (paragraphs, often blamed, what helps, sources); more overflows it.
 if(backLength(c)>BACK_BUDGET)return `back text ${backLength(c)} characters, over ${BACK_BUDGET}`;
 // Optional: one sourced line on what reduces this pollution, shown on the back.
 if(c.helps!==undefined&&!(isText(c.helps?.text)&&isText(c.helps?.source)))return 'helps needs text and source';
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

// Unwrapped footprint longitudes: continuous across the date line.
const unwrapped=card=>{const xs=[];card.footprint.forEach(([x],i)=>xs.push(i?xs[i-1]+wrap(x-card.footprint[i-1][0]):x));return xs;};
// The footprint's centre (vertex mean), as [lon, lat]: where a shared card's link turns the globe.
export function footprintCentre(card){
 const xs=unwrapped(card),lon=wrap(xs.reduce((a,b)=>a+b,0)/xs.length),lat=card.footprint.reduce((a,[,y])=>a+y,0)/xs.length;
 return [lon,lat];
}

// Distance (km) from the pin to the footprint: 0 inside, Infinity beyond bufferKm. Measured in a local flat frame centred
// on the pin: fine at the scale of a buffer of a few hundred km. The outline is first made continuous (no jump at the
// date line), then moved by whole turns to sit nearest the pin.
function distance(card,lat,lon){
 const xs=unwrapped(card);
 const mid=xs.reduce((a,b)=>a+b,0)/xs.length,shift=wrap(mid-lon)-mid;
 const k=Math.cos(lat*Math.PI/180),pts=card.footprint.map(([,y],i)=>[(xs[i]+shift)*k*111.32,(y-lat)*110.57]);
 let within=false,best=Infinity;
 for(let i=0,j=pts.length-1;i<pts.length;j=i++){
  const [xi,yi]=pts[i],[xj,yj]=pts[j];
  if((yi>0)!==(yj>0)&&0<(xj-xi)*(0-yi)/(yj-yi)+xi)within=!within;
  const dx=xj-xi,dy=yj-yi,t=Math.max(0,Math.min(1,dx||dy?-(xi*dx+yi*dy)/(dx*dx+dy*dy):0));
  best=Math.min(best,Math.hypot(xi+t*dx,yi+t*dy));
 }
 return within?0:best<=card.bufferKm?best:Infinity;
}

// What a pin finds: a CO variant (CO layer on, base card owned), the card itself, a hint one month off, or nothing.
// layers: Set of enabled field ids; owned: Set of collected base card ids. Where buffers overlap (North India and
// Pakistani Punjab share a border), the nearest footprint wins; ties keep deck order.
export function cardAt(deck,{lat,lon,month,layers,owned}){
 // Two passes: a card that is here this month always beats another card's one-month-off hint.
 const at=monthIndex(month),here=deck.map(card=>({card,d:distance(card,lat,lon)})).filter(h=>h.d<Infinity).sort((a,b)=>a.d-b.d).map(h=>h.card);
 for(const card of here){
  const variant=(card.variants??[]).find(v=>v.months.includes(month)&&layers.has(v.field)&&owned.has(card.id));
  if(variant)return {status:'variant',card,variant};
  if(card.months.includes(month))return {status:'found',card,variant:null};
 }
 const near=here.find(card=>card.months.some(m=>Math.abs(monthIndex(m)-at)===1));
 return near?{status:'near-month',card:near,variant:null}:{status:'none',card:null,variant:null};
}
