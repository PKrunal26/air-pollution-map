// Sets: every card of one type (only types with two or more cards) and the full deck. Completing one is a bigger moment.
export function cardSets(deck){
 const types=[...new Set(deck.map(c=>c.type))];
 const byType=types.map(type=>({id:`type:${type}`,name:type,ids:deck.filter(c=>c.type===type).map(c=>c.id)})).filter(s=>s.ids.length>=2);
 return [...byType,{id:'all',name:'All cards',ids:deck.map(c=>c.id)}];
}

// The sets that collecting `id` completes, given what was collected before it.
export function setsCompletedBy(deck,collectedBefore,id){
 const after=new Set([...collectedBefore,id]);
 return cardSets(deck).filter(s=>s.ids.includes(id)&&!s.ids.every(x=>collectedBefore.has(x))&&s.ids.every(x=>after.has(x)));
}
