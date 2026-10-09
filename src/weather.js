import {fetchNativeAsset} from './nativeAsset.js';
export const WEATHER_FIELDS=['temperature_2m','relative_humidity_2m','wind_u_component_10m','wind_v_component_10m'];
export const WEATHER_LAYERS=[
 {id:'wind',label:'Wind',name:'Wind',colour:'#99a7b0',scale:'10 m · m/s',lo:'calm',hi:'strong',defaultStrength:70},
 {id:'temperature',label:'Temperature',name:'Temperature',colour:'#de9056',scale:'−40 — 40 °C',lo:'−40',hi:'40+ °C',defaultStrength:65},
 {id:'humidity',label:'Humidity',name:'Relative humidity',colour:'#1cb9cd',scale:'0 — 100 %',lo:'0',hi:'100 %',defaultStrength:55},
];
export const initialWeather=()=>Object.fromEntries(WEATHER_LAYERS.map(l=>[l.id,{enabled:false,strength:l.defaultStrength}]));
export async function decodeWeather(meta,buffer){
 const g=meta?.grid,count=1440*721;
 if(meta?.schema!==1||meta.domain!=='ecmwf_ifs025'||meta.kind!=='modeled'||!Number.isFinite(meta.validAt)||meta.validAt<=0||g?.width!==1440||g.height!==721||g.step!==.25||g.latStart!==-90||g.lonStart!==-180||g.order!=='south-to-north, west-to-east'||meta.encoding!=='float32-le, layer-major'||meta.dataFile!=='weather-native.bin'||JSON.stringify(meta.fieldOrder)!==JSON.stringify(WEATHER_FIELDS)||meta.byteLength!==count*16||!(buffer instanceof ArrayBuffer)||buffer.byteLength!==meta.byteLength||!/^[a-f0-9]{64}$/.test(meta.sha256??''))throw new Error('Invalid weather encoding');
 const units=['°C','%','m/s','m/s'];
 if(WEATHER_FIELDS.some((id,i)=>meta.units?.[id]!==units[i]))throw new Error('Invalid weather units');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
 if(hash!==meta.sha256)throw new Error('Weather checksum mismatch');
 const view=new DataView(buffer),fields={};
 WEATHER_FIELDS.forEach((id,layer)=>{
  const values=new Float32Array(count);
  for(let i=0;i<count;i++){
   const v=view.getFloat32((layer*count+i)*4,true);
   if(!Number.isFinite(v)||(layer===0&&(v< -100||v>70))||(layer===1&&(v<0||v>100))||(layer>1&&Math.abs(v)>150))throw new Error('Invalid weather value');
   values[i]=v;
  }
  fields[id]=values;
 });
 return {...meta,fields};
}
export async function fetchWeather(signal){
 const response=await fetch('/data/weather-native.json',{signal});
 if(!response.ok)throw new Error('Weather metadata unavailable');
 const meta=await response.json();
 return decodeWeather(meta,await fetchNativeAsset(meta,'weather-native.bin',signal));
}
// Longitude wraps; latitude clamps at the poles. U is eastward, V northward.
export function sampleWeather(data,id,lat,lon){
 const {width,height,step,latStart,lonStart}=data.grid,a=data.fields[id];
 const x=(((lon-lonStart)/step%width)+width)%width,y=Math.max(0,Math.min(height-1,(lat-latStart)/step));
 const x0=Math.floor(x),x1=(x0+1)%width,y0=Math.floor(y),y1=Math.min(y0+1,height-1),fx=x-x0,fy=y-y0;
 return (a[y0*width+x0]*(1-fx)+a[y0*width+x1]*fx)*(1-fy)+(a[y1*width+x0]*(1-fx)+a[y1*width+x1]*fx)*fy;
}
