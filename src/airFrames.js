import {GLOBAL_FIELD_IDS} from './paintLayers.js';

// 3-hourly CAMS global frames for the time bar: float16, layer-major, gzip, one file per valid hour.
// Values are the provider's floats rounded to half precision; NaN marks the few cells the provider left missing.
export const FRAME_CELLS=900*451;
const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');

export function parseFrameManifest(m){
 const g=m?.grid;
 if(m?.schema!==1||m.kind!=='modeled'||m.domain!=='cams_global'||m.encoding!=='float16-le, layer-major'||g?.width!==900||g.height!==451||g.step!==.4||g.latStart!==-90||g.lonStart!==-180||JSON.stringify(m.fieldOrder)!==JSON.stringify(GLOBAL_FIELD_IDS)||!Array.isArray(m.frames)||m.frames.length<2||!Number.isInteger(m.snapshotIndex)||m.snapshotIndex<0||m.snapshotIndex>=m.frames.length||m.stepHours!==3)throw new Error('Invalid frame manifest');
 m.frames.forEach((f,i)=>{
  if(!Number.isFinite(f.validAt)||(i&&f.validAt-m.frames[i-1].validAt!==m.stepHours*3600e3)||f.byteLength!==FRAME_CELLS*GLOBAL_FIELD_IDS.length*2||f.compressedFile!==`air-frame-${String(i).padStart(2,'0')}.bin.gz`||!/^[a-f0-9]{64}$/.test(f.sha256??''))throw new Error('Invalid frame entry');
 });
 return m;
}

// Monthly means since August 2022 for a few fields (air-history.json). Frames are consecutive calendar months.
export function parseHistoryManifest(m){
 const g=m?.grid,fields=m?.fieldOrder;
 if(m?.schema!==1||m.kind!=='modeled'||m.domain!=='cams_global'||m.statistic!=='monthly mean'||m.step!=='month'||m.encoding!=='float16-le, layer-major'||g?.width!==900||g.height!==451||g.step!==.4||g.latStart!==-90||g.lonStart!==-180||!Array.isArray(fields)||!fields.length||fields.some(id=>!GLOBAL_FIELD_IDS.includes(id))||new Set(fields).size!==fields.length||!Array.isArray(m.frames)||m.frames.length<2)throw new Error('Invalid history manifest');
 m.frames.forEach((f,i)=>{
  const start=new Date(f.validAt);
  if(!Number.isFinite(f.validAt)||start.getUTCDate()!==1||start.getUTCHours()!==0||(i&&f.validAt!==m.frames[i-1].endAt)||!(f.endAt>f.validAt)||f.byteLength!==FRAME_CELLS*fields.length*2||f.compressedFile!==`air-month-${String(i).padStart(2,'0')}.bin.gz`||!/^[a-f0-9]{64}$/.test(f.sha256??''))throw new Error('Invalid history entry');
 });
 return m;
}

// Verifies length and checksum of a decompressed frame; returns its half-float bits.
export async function decodeFrame(entry,buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength!==entry.byteLength)throw new Error('Frame length mismatch');
 if(hex(await crypto.subtle.digest('SHA-256',buffer))!==entry.sha256)throw new Error('Frame checksum mismatch');
 if(new Uint16Array(new Uint8Array([1,0]).buffer)[0]!==1){const v=new DataView(buffer),out=new Uint16Array(buffer.byteLength/2);for(let i=0;i<out.length;i++)out[i]=v.getUint16(i*2,true);return out;}
 return new Uint16Array(buffer);
}

export function halfToFloat(h){
 const s=h&0x8000?-1:1,e=(h>>10)&31,f=h&1023;
 if(e===0)return s*f*2**-24;
 if(e===31)return f?NaN:s*Infinity;
 return s*(1+f/1024)*2**(e-15);
}
const HALF=Float32Array.from({length:65536},(_,h)=>halfToFloat(h));

// A float32 dataset for one frame, shaped like the snapshot (for the readout). Missing cells stay NaN.
export function frameDataset(manifest,index,bits){
 const fields={},frame=manifest.frames[index];
 manifest.fieldOrder.forEach((id,layer)=>{const out=new Float32Array(FRAME_CELLS),o=layer*FRAME_CELLS;for(let i=0;i<FRAME_CELLS;i++)out[i]=HALF[bits[o+i]];fields[id]=out;});
 return {schema:5,kind:'modeled',domain:'cams_global',grid:manifest.grid,units:manifest.units,referenceTime:manifest.referenceTime,validAt:frame.validAt,endAt:frame.endAt,statistic:manifest.statistic??null,frame:index,fields};
}

// Blend position (fractional frame index) -> the two frames and the mix between them.
export function framePair(position,count){
 const p=Math.max(0,Math.min(count-1,position)),a=Math.min(count-2,Math.floor(p));
 return {a,b:a+1,t:p-a};
}
export const nearestFrame=(position,count)=>Math.max(0,Math.min(count-1,Math.round(position)));

async function fetchFrame(entry,signal){
 const response=await fetch(`data/${entry.compressedFile}?v=${entry.sha256.slice(0,12)}`,{signal});
 if(!response.ok)throw new Error('Frame unavailable');
 const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer);
 // A server may already have decoded Content-Encoding: gzip.
 if(bytes[0]!==0x1f||bytes[1]!==0x8b)return decodeFrame(entry,buffer);
 return decodeFrame(entry,await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
}

// Playback state shared by the globe (read every animation frame) and the time bar (subscribes).
// Frames are fetched on demand; a few decoded frames are kept, the rest come back from the HTTP cache.
const KEEP=5;
// kind: 'forecast' (3-hourly, has the snapshot hour) or 'history' (monthly means; always drawn from frames).
export function createTimeline(manifest,{reduced=false,kind='forecast',secondsPerStep=kind==='history'?.6:.9,start=manifest.snapshotIndex??0}={}){
 const n=manifest.frames.length,decoded=new Map(),loading=new Map(),listeners=new Set(),controller=new AbortController();
 let position=start,playing=false,failed=false,version=0;
 const emit=()=>{version++;listeners.forEach(f=>f());};
 const touch=i=>{const v=decoded.get(i);decoded.delete(i);decoded.set(i,v);};
 const load=i=>{
  if(i<0||i>=n||decoded.has(i)||loading.has(i)||failed)return;
  const job=fetchFrame(manifest.frames[i],controller.signal).then(bits=>{
   decoded.set(i,bits);
   for(const k of decoded.keys()){if(decoded.size<=KEEP)break;const {a,b}=framePair(position,n);if(k!==a&&k!==b&&k!==nearestFrame(position,n))decoded.delete(k);}
   emit();
  }).catch(e=>{if(e.name!=='AbortError'){failed=true;playing=false;emit();}}).finally(()=>loading.delete(i));
  loading.set(i,job);
 };
 const want=()=>{const {a,b}=framePair(position,n);load(a);load(b);if(playing){load(b+1>=n?0:b+1);}};
 const ready=i=>decoded.has(i);
 return {
  count:n,manifest,kind,
  get position(){return position;},get playing(){return playing;},get failed(){return failed;},get version(){return version;},
  // Snapshot hour, paused: the exact float32 snapshot (and the European layer) is shown instead of frames.
  get atSnapshot(){return kind==='forecast'&&!playing&&position===manifest.snapshotIndex;},
  subscribe(f){listeners.add(f);return()=>listeners.delete(f);},
  seek(p){position=Math.max(0,Math.min(n-1,p));want();emit();},
  play(){if(failed)return;if(position>=n-1)position=0;playing=true;want();emit();},
  pause(){playing=false;position=Math.round(position);want();emit();},
  toggle(){playing?this.pause():this.play();},
  step(d){playing=false;position=Math.max(0,Math.min(n-1,Math.round(position)+d));want();emit();},
  // Advances playback; holds (buffers) while the next frame is still loading. Returns true if the position moved.
  tick(dt){
   if(!playing)return false;
   const {a,b}=framePair(position,n);
   if(!ready(a)||!ready(b)){want();return false;}
   let next=position+dt/secondsPerStep;
   // Loops back to the first frame after reaching the last one.
   if(next>=n-1)next=0;
   const crossed=Math.floor(next)!==Math.floor(position)||Math.round(next)!==Math.round(position);
   position=next;want();if(crossed)emit();return true;
  },
  // {a,b,t,bitsA,bitsB} for rendering, or null while either frame is missing.
  frames(){
   const {a,b,t}=framePair(position,n);
   if(!ready(a)||!ready(b)){want();return null;}
   touch(a);touch(b);
   // Reduced motion: no blend, show the nearest real frame.
   const tt=reduced?(t<.5?0:1):t;
   return {a,b,t:tt,bitsA:decoded.get(a),bitsB:decoded.get(b),fields:manifest.fieldOrder,key:kind};
  },
  bits(i){if(!ready(i)){load(i);return null;}return decoded.get(i);},
  dispose(){controller.abort();listeners.clear();decoded.clear();},
 };
}

export async function fetchHistoryManifest(signal){
 if(typeof DecompressionStream==='undefined')throw new Error('Frames need DecompressionStream');
 const response=await fetch('data/air-history.json',{signal,cache:'no-cache'});
 if(!response.ok)throw new Error('History manifest unavailable');
 return parseHistoryManifest(await response.json());
}

export async function fetchFrameManifest(signal){
 if(typeof DecompressionStream==='undefined')throw new Error('Frames need DecompressionStream');
 const response=await fetch('data/air-frames.json',{signal,cache:'no-cache'});
 if(!response.ok)throw new Error('Frame manifest unavailable');
 return parseFrameManifest(await response.json());
}
