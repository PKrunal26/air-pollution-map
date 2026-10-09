// Robust field statistics for the baseline-aware display scale. Pure, deterministic, no I/O.
export const CV_THRESHOLD=.5,FLOOR_P=.05,CEILING_P=.99;

// Per-value weights: cos(lat) on the global grid (rows are latitudes), 1 for the regional box (near-uniform area).
export function latWeights(grid,domain) {
 const w=new Float64Array(grid.width*grid.height);
 for(let y=0;y<grid.height;y++){const c=domain==='cams_global'?Math.max(0,Math.cos((grid.latStart+y*grid.step)*Math.PI/180)):1;w.fill(c,y*grid.width,(y+1)*grid.width);}
 return w;
}
export function weightedMeanStd(values,weights) {
 let s=0,sw=0;
 for(let i=0;i<values.length;i++){s+=values[i]*weights[i];sw+=weights[i];}
 const mean=sw>0?s/sw:0;let v=0;
 for(let i=0;i<values.length;i++)v+=weights[i]*(values[i]-mean)**2;
 return {mean,std:sw>0?Math.sqrt(v/sw):0};
}
export const coefficientOfVariation=(values,weights)=>{const {mean,std}=weightedMeanStd(values,weights);return mean>0?std/mean:Infinity;};
// Smallest value whose cumulative weight reaches p of the total (p in 0..1).
export function weightedPercentiles(values,weights,ps) {
 const order=Uint32Array.from(values.keys()).sort((a,b)=>values[a]-values[b]||a-b);
 let total=0;for(let i=0;i<order.length;i++)total+=weights[order[i]];
 const out=ps.map(()=>values[order[order.length-1]]);let acc=0,k=0;
 const sorted=ps.map((p,i)=>[p,i]).sort((a,b)=>a[0]-b[0]);
 for(let i=0;i<order.length&&k<sorted.length;i++){
  acc+=weights[order[i]];
  while(k<sorted.length&&acc>=sorted[k][0]*total-1e-12){out[sorted[k][1]]=values[order[i]];k++;}
 }
 return out;
}
// emphasis: forced 'muted'|'normal' (catalogue override or the global verdict) wins, else CV < CV_THRESHOLD decides.
// The percentile sort only runs for muted fields (or full=true), keeping the load-time pass cheap.
export function fieldScale(values,grid,domain,{emphasis,full=false}={}) {
 const w=latWeights(grid,domain),cv=coefficientOfVariation(values,w),muted=(emphasis?emphasis==='muted':cv<CV_THRESHOLD);
 if(!muted&&!full)return {cv,emphasis:'normal'};
 const [floor,ceiling]=weightedPercentiles(values,w,[FLOOR_P,CEILING_P]);
 return {cv,floor,ceiling,emphasis:muted&&ceiling>floor?'muted':'normal'};
}
// Display weight before strength: baseline-aware for muted fields, plain value/range otherwise. 0..1.
export function displayWeight(value,scale,range) {
 if(!(value>0))return 0;
 if(scale?.emphasis==='muted')return Math.max(0,Math.min(1,(value-scale.floor)/(scale.ceiling-scale.floor)));
 return Math.min(value/range,1);
}
// Scales per dataset, cached by dataset object. `base` (global scales) forces the regional verdict per layer so a layer
// has one ink emphasis; floor/ceiling stay the regional set's own. Catalogue `emphasis` overrides both.
const cache=new WeakMap();
export function scalesFor(data,layers,base=null) {
 if(!data)return {};
 const hit=cache.get(data);if(hit&&hit.base===base)return hit.scales;
 const scales={};
 for(const l of layers){const f=data.fields[l.id];if(f)scales[l.id]=fieldScale(f,data.grid,data.domain,{emphasis:l.emphasis??base?.[l.id]?.emphasis});}
 cache.set(data,{base,scales});return scales;
}
// One verdict per layer for the UI: emphasis plus the mapped span (global preferred, else regional).
export const layerSpan=(id,global,regional)=>global?.[id]??regional?.[id];
