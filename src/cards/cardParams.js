// ?card=<id> opens a shared card; ?deck=1.<code> restores a collection. Unknown or malformed values are ignored.
// Kept apart from parseEmbedParams so the embed options stay exactly as they are.
export function parseCardParams(search,knownIds){
 const params=new URLSearchParams(search),card=params.get('card'),deck=params.get('deck');
 return {
  card:card&&knownIds.has(card)?card:null,
  deck:deck&&deck.length<=200&&/^1\.[A-Za-z0-9_-]*$/.test(deck)?deck:null,
 };
}
