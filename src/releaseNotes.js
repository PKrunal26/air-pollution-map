// Release notes: shown once to every visitor (new or returning) after a release, then remembered per browser.
// Bump `id` with each release worth telling people about; visitors who saw an older id see the new notes once.
export const RELEASE_KEY='air-atlas.release-seen';
export const RELEASE={
 id:'2026-10-17',
 date:'17 October 2026',
 items:[
  {title:'Event cards',text:'Sixteen real pollution events are hidden on the globe, from Canadian wildfire smoke to Saharan dust over the Caribbean. Click near the right place, answer what caused it, and the card is yours to keep and share.'},
  {title:'Monthly averages since 2022',text:'The time bar now holds two timelines: monthly averages since August 2022 in front, and today with the next two days behind it. Tap the one behind to bring it forward; both play.'},
  {title:'PM10 and carbon monoxide in past months',text:'Past months now show PM10 and carbon monoxide, as well as PM2.5, dust and nitrogen dioxide.'},
 ],
};
// Storage failures count as "already seen", so the notes never nag in windows that block storage.
export function releaseSeen(storage){
 try{return (storage===undefined?globalThis.localStorage:storage).getItem(RELEASE_KEY)===RELEASE.id;}catch{return true;}
}
export function saveReleaseSeen(storage){
 try{(storage===undefined?globalThis.localStorage:storage).setItem(RELEASE_KEY,RELEASE.id);}catch{}
}
