import {fetchNativeAsset} from './nativeAsset.js';
export function parseGlobalAir(payload) {
 const g=payload?.grid;
 if(payload?.schema!==1||payload.pollutant!=='pm2_5'||(payload.schema!==5&&payload.unit!=='μg/m³')||payload.domain!=='cams_global'||payload.kind!=='modeled'||!Number.isFinite(payload.validAt)||payload.validAt<=0||g?.width!==72||g.height!==37||g.step!==5||g.latStart!==-90||g.lonStart!==-180||g.order!=='south-to-north, west-to-east'||!Array.isArray(payload.values)||payload.values.length!==g.width*g.height||payload.values.some(v=>!Number.isFinite(v)||v<0||v>6553.5))throw new Error('Invalid global PM₂.₅ grid');
 return payload;
}

// Used to compare against exact city API readings; interpolation is only visual.
export function sampleGlobalAir(data,lat,lon) {
 const {width,height,step}=data.grid;
 const x=(((lon+180)/step)%width+width)%width,y=Math.max(0,Math.min(height-1,(lat+90)/step));
 const x0=Math.floor(x),y0=Math.floor(y),x1=(x0+1)%width,y1=Math.min(y0+1,height-1),fx=x-x0,fy=y-y0;
 const v=(x,y)=>data.values[y*width+x];
 return (v(x0,y0)*(1-fx)+v(x1,y0)*fx)*(1-fy)+(v(x0,y1)*(1-fx)+v(x1,y1)*fx)*fy;
}
import {PAINT_LAYERS,LEGACY_FIELD_IDS,GLOBAL_FIELD_IDS,EUROPE_FIELD_IDS} from './paintLayers.js';

export function parseGlobalLayers(payload) {
 const g=payload?.grid;
 const supportedGrid=payload?.schema===2?g?.width===72&&g.height===37&&g.step===5:[3,5].includes(payload?.schema)&&g?.width===900&&g.height===451&&g.step===.4;
 if(!supportedGrid||(payload.schema!==5&&payload.unit!=='μg/m³')||payload.domain!=='cams_global'||payload.kind!=='modeled'||!Number.isFinite(payload.validAt)||payload.validAt<=0||g.latStart!==-90||g.lonStart!==-180||g.order!=='south-to-north, west-to-east')throw new Error('Invalid global layer metadata');
 for(const id of (payload.schema===5?GLOBAL_FIELD_IDS:LEGACY_FIELD_IDS)){const layer=PAINT_LAYERS.find(l=>l.id===id);if(payload.schema===5&&payload.units?.[id]!==layer.unit)throw new Error(`Invalid ${layer.label} unit`);const values=payload.fields?.[id];if(!(Array.isArray(values)||values instanceof Float32Array)||values.length!==g.width*g.height||values.some(v=>!Number.isFinite(v)||v<0))throw new Error(`Invalid ${layer.label} field`);}
 return payload;
}

// Decode the provider's native float values; verify integrity before any visual clamping.
export async function decodeNativeLayers(metadata,buffer) {
 const count=900*451,order=metadata?.schema===5?GLOBAL_FIELD_IDS:LEGACY_FIELD_IDS;
 if(![3,5].includes(metadata?.schema)||metadata.encoding!=='float32-le, layer-major'||metadata.dataFile!=='global-air-native.bin'||JSON.stringify(metadata.fieldOrder)!==JSON.stringify(order)||metadata.byteLength!==count*order.length*4||!(buffer instanceof ArrayBuffer)||buffer.byteLength!==metadata.byteLength||!/^[a-f0-9]{64}$/.test(metadata.sha256??''))throw new Error('Invalid native data encoding');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==metadata.sha256)throw new Error('Native data checksum mismatch');
 const fields={},littleEndian=new Uint16Array(new Uint8Array([1,0]).buffer)[0]===1;
 order.forEach((id,layer)=>{
  const offset=layer*count*4;
  if(littleEndian)fields[id]=new Float32Array(buffer,offset,count);
  else{const view=new DataView(buffer,offset,count*4);fields[id]=Float32Array.from({length:count},(_,i)=>view.getFloat32(i*4,true));}
 });
 return parseGlobalLayers({...metadata,fields});
}

export async function fetchNativeLayers(signal,onProgress) {
 const metadataResponse=await fetch('/data/global-air-native.json',{signal,cache:'no-cache'});
 if(!metadataResponse.ok)throw new Error('Native metadata unavailable');
 const metadata=await metadataResponse.json();
 return decodeNativeLayers(metadata,await fetchNativeAsset(metadata,'global-air-native.bin',signal,onProgress));
}

export async function decodeEuropeLayers(metadata,buffer) {
 const g=metadata?.grid,count=700*420,order=metadata?.schema===6?EUROPE_FIELD_IDS:LEGACY_FIELD_IDS;
 if(![4,6].includes(metadata?.schema)||metadata.domain!=='cams_europe'||(metadata.schema!==6&&metadata.unit!=='μg/m³')||metadata.kind!=='modeled'||!Number.isFinite(metadata.validAt)||metadata.validAt<=0||g?.width!==700||g.height!==420||g.step!==.1||g.latStart!==30.05||g.lonStart!==-24.95||g.order!=='south-to-north, west-to-east'||metadata.encoding!=='float32-le, layer-major'||metadata.dataFile!=='europe-air-native.bin'||JSON.stringify(metadata.fieldOrder)!==JSON.stringify(order)||metadata.byteLength!==count*order.length*4||!(buffer instanceof ArrayBuffer)||buffer.byteLength!==metadata.byteLength)throw new Error('Invalid regional data encoding');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==metadata.sha256)throw new Error('Regional data checksum mismatch');
 const fields={},view=new DataView(buffer);
 order.forEach((id,layer)=>{
  if(metadata.schema===6&&metadata.units?.[id]!==PAINT_LAYERS.find(l=>l.id===id).unit)throw new Error('Invalid regional unit');
  const values=new Float32Array(count);
  for(let i=0;i<count;i++){const v=view.getFloat32((layer*count+i)*4,true);if(!Number.isFinite(v)||v<0)throw new Error('Invalid regional value');values[i]=v;}
  fields[id]=values;
 });
 return {...metadata,fields};
}

export async function fetchEuropeLayers(signal,onProgress) {
 const response=await fetch('/data/europe-air-native.json',{signal});
 if(!response.ok)throw new Error('Regional metadata unavailable');
 const metadata=await response.json();
 return decodeEuropeLayers(metadata,await fetchNativeAsset(metadata,'europe-air-native.bin',signal,onProgress));
}
