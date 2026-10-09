import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// A reproducible, timestamped global sample of real CAMS estimates.
// This is a 5-degree display grid, not the model's native 0.4-degree grid.
const hour=process.argv[2];
if(!/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(hour??''))throw new Error('Supply a UTC hour YYYY-MM-DDTHH:00');
const timestamp=Date.parse(`${hour}:00Z`)/1000;
async function request(url){
 for(let attempt=0;attempt<3;attempt++){
  try{return await fetch(url,{signal:AbortSignal.timeout(60000)});}catch(error){if(attempt===2)throw error;console.log('Connection interrupted: retrying');await new Promise(r=>setTimeout(r,5000));}
 }
}
const cache=resolve(process.argv[3]??'../../work/global-air');
await mkdir(cache,{recursive:true});
const width=72,height=37,step=5;
const points=Array.from({length:width*height},(_,i)=>({lat:-90+Math.floor(i/width)*step,lon:-180+(i%width)*step}));
const values=[],modelCoordinates=[];
for(let offset=0;offset<points.length;offset+=96){
 const batch=points.slice(offset,offset+96),file=resolve(cache,`${hour.replaceAll(':','-')}-${offset}.json`);
 let payload;
 try{payload=JSON.parse(await readFile(file,'utf8'));}catch{
  const url=new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.search=new URLSearchParams({latitude:batch.map(p=>p.lat).join(','),longitude:batch.map(p=>p.lon).join(','),hourly:'pm2_5',domains:'cams_global',timezone:'GMT',timeformat:'unixtime',start_hour:hour,end_hour:hour,cell_selection:'nearest'}).toString();
  let response=await request(url);
  if(response.status===429){console.log('Provider rate limit: waiting one minute');await new Promise(r=>setTimeout(r,60000));response=await request(url);}
  if(!response.ok)throw new Error(`Batch ${offset}: HTTP ${response.status}: ${await response.text()}`);
  payload=await response.json();await writeFile(file,JSON.stringify(payload));
  await new Promise(r=>setTimeout(r,12000));
 }
 if(!Array.isArray(payload)||payload.length!==batch.length)throw new Error(`Incomplete batch ${offset}`);
 payload.forEach((p,index)=>{
  const v=p.hourly?.pm2_5?.[0];
  if(p.hourly_units?.pm2_5!=='μg/m³'||p.hourly_units?.time!=='unixtime'||p.hourly.time.length!==1||p.hourly.time[0]!==timestamp||!Number.isFinite(v)||v<0||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude))throw new Error(`Invalid sample ${offset+index}`);
  const requested=batch[index];
  const longitudeDistance=Math.abs(((p.longitude-requested.lon+540)%360)-180);
  if(Math.abs(p.latitude-requested.lat)>.5||longitudeDistance>.5)throw new Error(`Misplaced sample ${offset+index}`);
  values.push(v);modelCoordinates.push([p.latitude,p.longitude]);
 });
 console.log(`Validated ${values.length}/${points.length}`);
}
const snapshot={schema:1,pollutant:'pm2_5',unit:'μg/m³',kind:'modeled',domain:'cams_global',provider:'CAMS / ECMWF via Open-Meteo',source:'https://open-meteo.com/en/docs/air-quality-api',licence:'CC BY 4.0',validAt:timestamp*1000,retrievedAt:new Date().toISOString(),grid:{width,height,step,latStart:-90,lonStart:-180,order:'south-to-north, west-to-east'},values,modelCoordinates};
await mkdir('public/data',{recursive:true});
await writeFile('public/data/global-pm25.json',JSON.stringify(snapshot));
console.log(JSON.stringify({validAt:new Date(snapshot.validAt).toISOString(),samples:values.length,min:Math.min(...values),max:Math.max(...values)}));
