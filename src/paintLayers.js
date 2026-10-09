// Fixed display ranges, not health categories or equivalent doses.
export const PAINT_LAYERS=[
 {id:'pm2_5',label:'PM₂.₅',name:'Fine particles',colour:'#edc65b',rgb:[.93,.78,.36],range:100,defaultStrength:100},
 {id:'nitrogen_dioxide',label:'NO₂',name:'Nitrogen dioxide',colour:'#54c7d6',rgb:[.33,.78,.84],range:20,defaultStrength:100},
 {id:'ozone',label:'O₃',name:'Ozone',colour:'#d780b9',rgb:[.84,.50,.73],range:120,defaultStrength:35},
 {id:'dust',label:'Dust',name:'Dust',colour:'#d57d50',rgb:[.84,.49,.31],range:100,defaultStrength:75},
];
export const initialPaint=()=>Object.fromEntries(PAINT_LAYERS.map(p=>[p.id,{enabled:true,strength:p.defaultStrength}]));

// Commutative pigment absorption: checkbox order cannot change the mix.
// Only display weights are combined; concentrations are never summed.
export function mixPigments(samples,paint) {
 let total=0,absorption=[0,0,0];
 for(const layer of PAINT_LAYERS){
  const value=samples[layer.id],setting=paint[layer.id];
  if(!setting?.enabled||!Number.isFinite(value)||value<0)continue;
  const weight=Math.min(value/layer.range,1)*Math.max(0,Math.min(setting.strength/100,1));
  total+=weight;layer.rgb.forEach((c,i)=>{absorption[i]+=-Math.log(c)*weight;});
 }
 return {colour:absorption.map(a=>Math.exp(-a/Math.max(total,.0001))),opacity:1-Math.exp(-total*1.2)};
}
