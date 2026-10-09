import {buildAirGeometry} from './sphereSampling.js';

// Builds dot geometry off the main thread; field data is registered once, then reused per build.
const sets=new Map();
self.onmessage=({data:m})=>{
 if(m.type==='data')sets.set(m.id,m.data);
 else if(m.type==='drop')sets.delete(m.id);
 else if(m.type==='build'){
  try{
   const g=buildAirGeometry(sets.get(m.id),m.layers,m.count,m.bounds,m.slots);
   self.postMessage({job:m.job,...g},[g.positions.buffer,g.locations.buffer,...g.weights.map(w=>w.buffer)]);
  }catch(e){self.postMessage({job:m.job,error:String(e)});}
 }
};
