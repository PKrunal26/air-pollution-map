import {Raycaster,Sphere,Vector2,Vector3} from 'three';
import {pointToLocation} from './airProbe.js';

export function createGlobeProbe({canvas,container,camera,onProbe,isEnabled}){
 const ray=new Raycaster(),sphere=new Sphere(new Vector3(),1),hit=new Vector3(),ndc=new Vector2();
 const marker=document.createElement('span');
 marker.className='globe-probe';marker.setAttribute('aria-hidden','true');marker.hidden=true;container.appendChild(marker);
 let pointer=null,gesture=null,location=null,worldPoint=null,lastKey='',lastTime=0,lastReset=0,pendingCentre=false;
 const pointers=new Set();
 function emit(next){
  location=next;
  const key=next?`${next.lat.toFixed(3)},${next.lon.toFixed(3)},${next.pinned}`:'';
  if(key!==lastKey){lastKey=key;onProbe(next);}
  if(!next){worldPoint=null;marker.hidden=true;}
 }
 function clear(){pointer=null;pendingCentre=false;emit(null);}
 function inspect(x,y,pinned){
  const rect=canvas.getBoundingClientRect();
  ndc.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
  camera.updateMatrixWorld();ray.setFromCamera(ndc,camera);
  if(!ray.ray.intersectSphere(sphere,hit)){emit(null);return;}
  worldPoint=hit.clone();emit({...pointToLocation(hit),pinned});
 }
 function move(event){
  if(gesture){if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6)gesture.moved=true;return;}
  if(event.pointerType==='touch'||event.buttons||location?.pinned)return;
  pointer={x:event.clientX,y:event.clientY};
 }
 function down(event){
  if(event.button!==0)return;
  pointers.add(event.pointerId);
  gesture=pointers.size===1?{x:event.clientX,y:event.clientY,moved:false}:null;
  clear();
 }
 function up(event){
  const tap=pointers.size===1&&gesture&&!gesture.moved;
  pointers.delete(event.pointerId);gesture=null;
  if(tap&&isEnabled()){inspect(event.clientX,event.clientY,true);if(location)container.focus({preventScroll:true});}
 }
 function leave(){pointer=null;if(gesture)gesture.moved=true;if(!location?.pinned)emit(null);}
 function cancel(){pointers.clear();gesture=null;clear();}
 const listeners={pointermove:move,pointerdown:down,pointerup:up,pointerleave:leave,pointercancel:cancel,wheel:clear};
 Object.entries(listeners).forEach(([name,fn])=>canvas.addEventListener(name,fn,{passive:true}));
 const blur=()=>{if(!location?.pinned)clear();};
 window.addEventListener('blur',blur);
 return {
  clear,
  inspectCentre(){pendingCentre=true;},
  update({enabled,reset,time}){
   if(reset!==lastReset||!enabled){lastReset=reset;clear();return;}
   if(pendingCentre){
    pendingCentre=false;worldPoint=camera.position.clone().normalize();emit({...pointToLocation(worldPoint),pinned:true});
   }
   if(pointer&&!gesture&&!location?.pinned&&time-lastTime>=.08){lastTime=time;inspect(pointer.x,pointer.y,false);}
   if(!worldPoint)return;
   const facing=worldPoint.dot(camera.position.clone().normalize()),screen=worldPoint.clone().project(camera);
   marker.hidden=facing<=1/camera.position.length()+.005||Math.abs(screen.x)>1||Math.abs(screen.y)>1;
   marker.style.transform=`translate(${(screen.x*.5+.5)*container.clientWidth}px,${(-screen.y*.5+.5)*container.clientHeight}px) translate(-50%,-50%)`;
  },
  dispose(){Object.entries(listeners).forEach(([name,fn])=>canvas.removeEventListener(name,fn));window.removeEventListener('blur',blur);marker.remove();},
 };
}
