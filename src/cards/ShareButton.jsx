import React,{useEffect,useState} from 'react';
import {prepareStory,shareStory} from './share';

const NOTES={downloaded:'Saved to your downloads.',failed:'Could not make the image. Try again later.'};

// Share: the story image is prepared when the button appears, so a tap goes straight to the share sheet.
export default function ShareButton({card,variant=null}){
 const [file,setFile]=useState(null),[note,setNote]=useState('');
 useEffect(()=>{let live=true;prepareStory(card,variant).then(f=>{if(!live)return;f?setFile(f):setNote(NOTES.failed);});return()=>{live=false;};},[card,variant]);
 const share=async()=>{setNote('');const result=await shareStory(file,card);setNote(NOTES[result]??'');};
 return <>
  <button type="button" className="is-primary" disabled={!file} onClick={share}>{file||note?'Share':'Preparing image…'}</button>
  {note&&<p className="card-share-note" role="status">{note}</p>}
 </>;
}
