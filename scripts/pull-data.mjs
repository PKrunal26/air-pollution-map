// Downloads the published data (public/data is not in git) from the live site, or DATA_URL, into public/data.
// Usage: npm run data:pull
// Every file is checked against the sha256 in its manifest; files already present with the right checksum are kept.
// Native snapshots are fetched gzip-compressed and their raw .bin (the browser fallback, also read by tests) is
// written from the decompressed bytes.
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

const BASE=(process.env.DATA_URL||'https://pkrunal26.github.io/air-pollution-map/data/').replace(/\/?$/,'/');
const OUT=new URL('../public/data/',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const local=async name=>{try{return await readFile(new URL(name,OUT));}catch{return null;}};

async function download(name){
 for(let attempt=1;;attempt++){
  try{
   const response=await fetch(BASE+name);
   if(!response.ok)throw new Error(`${name}: HTTP ${response.status}`);
   return Buffer.from(await response.arrayBuffer());
  }catch(e){if(attempt===3)throw e;await new Promise(r=>setTimeout(r,2000*attempt));}
 }
}
const json=async name=>{const bytes=await download(name);await writeFile(new URL(name,OUT),bytes);return JSON.parse(bytes);};
// A gzip file whose decompressed bytes must hash to `sha256`; returns the decompressed bytes.
async function gz(name,sha256){
 const have=await local(name);
 if(have){try{const raw=gunzipSync(have);if(sha(raw)===sha256)return raw;}catch{}}
 const bytes=await download(name),raw=gunzipSync(bytes);
 if(sha(raw)!==sha256)throw new Error(`${name}: checksum mismatch`);
 await writeFile(new URL(name,OUT),bytes);return raw;
}

await mkdir(OUT,{recursive:true});
const jobs=[];
for(const stem of ['global-air-native','europe-air-native','weather-native']){
 const meta=await json(`${stem}.json`);
 jobs.push(async()=>{const raw=await gz(meta.compressedFile,meta.sha256);const have=await local(meta.dataFile);if(!have||sha(have)!==meta.sha256)await writeFile(new URL(meta.dataFile,OUT),raw);});
}
for(const name of ['air-frames.json','europe-frames.json','air-history.json','europe-history.json']){
 const manifest=await json(name);
 for(const frame of manifest.frames)if(frame)jobs.push(()=>gz(frame.compressedFile,frame.sha256));
}
let done=0;
const worker=async()=>{while(jobs.length){await jobs.shift()();done++;}};
await Promise.all(Array.from({length:8},worker));
console.log(`public/data: ${done} files verified from ${BASE}`);
