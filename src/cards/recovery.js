// Recovery links (?deck=1.<code>): which cards and variants someone holds, so a collection can move to another browser.
// For each id in order.json at index i, bit 2i = base card, bit 2i+1 = its CO variant; bit n is in byte n>>3, mask
// 1<<(n&7); trailing zero bytes dropped; base64url without padding. Not secret and not tamper-proof, by design.

const toBase64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
function fromBase64url(text){
 if(!/^[A-Za-z0-9_-]*$/.test(text)||text.length%4===1)return null;
 try{return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}catch{return null;}
}

export function encodeDeck(collectedKeys,order){
 const bytes=new Uint8Array(Math.ceil(order.length*2/8));
 for(const key of collectedKeys){
  const [id,kind]=key.split(':'),i=order.indexOf(id);
  if(i<0||(kind&&kind!=='co'))continue;
  const n=2*i+(kind?1:0);bytes[n>>3]|=1<<(n&7);
 }
 let end=bytes.length;while(end&&!bytes[end-1])end--;
 return `1.${toBase64url(bytes.subarray(0,end))}`;
}

// Malformed codes give [] (nothing restored), never an error.
export function decodeDeck(code,order){
 if(typeof code!=='string'||!code.startsWith('1.'))return [];
 const bytes=fromBase64url(code.slice(2));
 if(!bytes)return [];
 const keys=[];
 order.forEach((id,i)=>{
  for(const [bit,key] of [[2*i,id],[2*i+1,`${id}:co`]])if((bytes[bit>>3]??0)&(1<<(bit&7)))keys.push(key);
 });
 return keys;
}
