import React,{useEffect,useState} from 'react';
import {prepareStory,shareMessage,shareStory,shareText,collectedCount} from './share';

const NOTES={
 copied:'Copied. Paste it into a message.',
 downloaded:'Story image saved to your downloads.',
 failed:'Could not share. Try again later.',
 imageFailed:'Could not make the story image. Try again later.',
};

// Share sends a text message with the score and the card's link. The story image is prepared when the buttons appear,
// so a tap goes straight to the share sheet (iOS only opens it from a tap that does not wait).
// story=false leaves out the story image (the collect recap keeps to two buttons; the full-size card has it).
export default function ShareButton({card,variant=null,deck,collected,earned=null,story:withStory=true}){
 const [file,setFile]=useState(null),[note,setNote]=useState(''),have=collectedCount(deck,collected);
 useEffect(()=>{
  if(!withStory)return;
  let live=true;setFile(null);
  prepareStory({card,variant,deck,collected,earned}).then(f=>{if(!live)return;f?setFile(f):setNote(NOTES.imageFailed);});
  return()=>{live=false;};
 },[card,variant,have,withStory]);
 const share=async()=>{setNote('');const result=await shareMessage(shareText({card,variant,deck,collected,earned}),`${card.id}${variant?`-${variant}`:''}`);setNote(NOTES[result]??'');};
 const story=async()=>{setNote('');const result=await shareStory(file);setNote(NOTES[result]??'');};
 return <>
  <button type="button" className="is-primary" onClick={share}>Share</button>
  {withStory&&<button type="button" disabled={!file} onClick={story}>{file||note?'Story image':'Preparing image…'}</button>}
  {note&&<p className="card-share-note" role="status">{note}</p>}
 </>;
}
