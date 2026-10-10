import * as THREE from 'three';
import {PAINT_LAYERS} from './paintLayers';
import {scalesFor} from './fieldStats';
import {DOT_COUNTS,REGIONAL_DOT_COUNTS,FULL_RADIUS,PLATE_OFFSET,buildAirGeometry,gridBounds,detailLevel,dotSpacing,plateOffset} from './sphereSampling';

// Halftone: one solid-ink disc per enabled layer, radius = FULL_RADIUS*sqrt(value/range) in lattice-spacing units,
// each on its own fixed offset plate (from the layer's catalogue index, independent of which other layers are on). Pack four independent fields per attribute; all layers mix per fragment.
const GROUPS=Math.ceil(PAINT_LAYERS.length/4);
const sequence=fn=>Array.from({length:GROUPS},(_,i)=>fn(i)).join('\n');
const SLOT_LAYERS=PAINT_LAYERS.map((l,slot)=>({id:l.id,range:l.range,slot}));
const lane=i=>`${Math.floor(i/4)}.${'xyzw'[i%4]}`;
// Disposes GPU buffers, then drops the typed arrays. Never call on a geometry assigned to a Points object.
const release=g=>{g.dispose();Object.keys(g.attributes).forEach(n=>g.deleteAttribute(n));};
const MUTED_INK=.55;
// sRGB 0..1 -> OKLab. Every pigment shares one lightness (tested), so overlaps are mixed by hue and chroma only.
const toLinear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
function oklab([r,g,b]){
 [r,g,b]=[r,g,b].map(toLinear);
 const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
 return [.2104542553*l+.793617785*m-.0040720468*s,1.9779984951*l-2.428592205*m+.4505937099*s,.0259040371*l+.7827717662*m-.808675766*s];
}
const LABS=PAINT_LAYERS.map(l=>oklab(l.rgb)),INK_L=LABS.reduce((s,v)=>s+v[0],0)/LABS.length;
const REGIONAL_FAR=3.2,REGIONAL_KEEP_MS=8000;
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

// Geometry is built in a module Worker (transferred typed arrays); falls back to the main thread.
function createBuilder() {
 let worker=null,serial=0;const jobs=new Map(),sets=new Map();
 const runSync=(job)=>setTimeout(()=>{const j=jobs.get(job.id);if(!j)return;jobs.delete(job.id);try{j.resolve(buildAirGeometry(sets.get(j.set).data,sets.get(j.set).layers,j.count,j.bounds,PAINT_LAYERS.length));}catch(e){j.reject(e);}});
 const fail=()=>{worker?.terminate();worker=null;jobs.forEach((j,id)=>runSync({id}));};
 try{
  if(typeof Worker!=='undefined'){
   worker=new Worker(new URL('./airGeometryWorker.js',import.meta.url),{type:'module'});
   worker.onmessage=({data:m})=>{const j=jobs.get(m.job);if(!j)return;jobs.delete(m.job);m.error?j.reject(new Error(m.error)):j.resolve(m);};
   worker.onerror=fail;
  }
 }catch{worker=null;}
 return {
  register(data,base) {
   const id=++serial,fields={};
   for(const l of PAINT_LAYERS){const f=data.fields[l.id];if(f)fields[l.id]=f instanceof Float32Array?f:Float32Array.from(f);}
   const payload={grid:data.grid,domain:data.domain,fields};
   const scales=scalesFor(data,PAINT_LAYERS,base),layers=SLOT_LAYERS.map(l=>({...l,scale:scales[l.id]}));
   sets.set(id,{data:payload,layers});worker?.postMessage({type:'data',id,data:payload});return id;
  },
  drop(id) {sets.delete(id);worker?.postMessage({type:'drop',id});},
  build(set,count,bounds) {
   return new Promise((resolve,reject)=>{
    const id=++serial;jobs.set(id,{resolve,reject,set,count,bounds});
    if(worker)worker.postMessage({type:'build',job:id,id:set,layers:sets.get(set).layers,count,bounds,slots:PAINT_LAYERS.length});else runSync({id});
   });
  },
  dispose() {worker?.terminate();worker=null;jobs.clear();sets.clear();},
 };
}
function toGeometry(g) {
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(g.positions,3));
 g.weights.forEach((w,i)=>geometry.setAttribute(`sampleWeights${i}`,new THREE.BufferAttribute(w,4,true)));
 geometry.setAttribute('location',new THREE.BufferAttribute(g.locations,2));
 geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1.01);return geometry;
}
export function createGlobalAirLayer(scene) {
const uniforms={halfView:{value:new THREE.Vector2(1,1)},spacing:{value:.01},regionMix:{value:0},isRegion:{value:0},regionBounds:{value:new THREE.Vector4(-25,30,45,72)}};
 for(let i=0;i<GROUPS;i++){
  for(const n of ['amount','regionalFields','globalFields','plateX','plateY','ink'])uniforms[`${n}${i}`]={value:new THREE.Vector4()};
 }
 LABS.forEach(([,a,b],i)=>{uniforms[`pigment${i}`]={value:new THREE.Vector3(a,b,Math.hypot(a,b))};});
 // Vertex: builds the Earth-fixed tangent frame (east/north from lat/lon) and its screen Jacobian, so discs and plate
 // offsets live on the surface and are foreshortened like it. Fragment works in lattice-spacing units, edges are
 // anti-aliased analytically from that Jacobian (the exact per-pixel step of the distance field).
 const material=new THREE.ShaderMaterial({uniforms,
  vertexShader:`attribute vec2 location;uniform vec2 halfView;uniform float spacing;uniform float regionMix;uniform float isRegion;uniform vec4 regionBounds;varying vec4 invM;varying float spritePx;
   ${sequence(i=>`attribute vec4 sampleWeights${i};uniform vec4 amount${i};uniform vec4 regionalFields${i};uniform vec4 globalFields${i};varying vec4 radius${i};`)}
   void main(){
    vec4 mv=modelViewMatrix*vec4(position,1.);float w=-mv.z;mat3 rot=mat3(modelViewMatrix);
    float th=radians(location.x),ph=radians(location.y);float st=sin(th),ct=cos(th),sp=sin(ph),cp=cos(ph);
    vec3 e=rot*vec3(-st,0.,-ct),n=rot*vec3(-sp*ct,cp,sp*st);
    float facing=dot(normalize(rot*position),normalize(-mv.xyz));
    vec2 sc=halfView*vec2(projectionMatrix[0][0],projectionMatrix[1][1])/w*spacing;
    vec2 je=sc*(e.xy+mv.xy/w*e.z),jn=sc*(n.xy+mv.xy/w*n.z);
    float det=je.x*jn.y-je.y*jn.x;if(abs(det)<1e-3)det=1e-3;
    float a=dot(je,je)+dot(jn,jn);float major=sqrt(.5*(a+sqrt(max(a*a-4.*det*det,0.))));
    invM=vec4(jn.y,-jn.x,-je.y,je.x)/det;
    float edge=min(min(location.x-regionBounds.x,regionBounds.z-location.x),min(location.y-regionBounds.y,regionBounds.w-location.y));
    float inside=smoothstep(0.,1.5,edge);
    float limb=smoothstep(.06,.28,facing);
    ${sequence(i=>`vec4 globalFade${i}=vec4(1.)-inside*regionMix*regionalFields${i};
     vec4 regionalFade${i}=inside*mix(vec4(1.),vec4(regionMix),globalFields${i});
     vec4 fade${i}=sqrt(max(mix(globalFade${i},regionalFade${i},isRegion),0.))*limb;
     radius${i}=${FULL_RADIUS}*sqrt(clamp(sampleWeights${i}*amount${i},0.,1.))*fade${i};`)}
    spritePx=2.*${FULL_RADIUS+PLATE_OFFSET}*major+2.;
    gl_PointSize=spritePx;gl_Position=facing<.04?vec4(2.,2.,2.,1.):projectionMatrix*mv;
   }`,
  fragmentShader:`varying vec4 invM;varying float spritePx;
   ${sequence(i=>`varying vec4 radius${i};uniform vec4 plateX${i};uniform vec4 plateY${i};uniform vec4 ink${i};`)}
   ${PAINT_LAYERS.map((_,i)=>`uniform vec3 pigment${i};`).join('\n')}
   vec4 acc=vec4(0.);
   float pix=1.;
   void plate(float r,vec2 centre,vec3 pigment,float ink,vec2 t){
    if(r<=0.)return;
    vec2 q=t-centre;float d=length(q);vec2 dir=d>1e-5?q/d:vec2(1.,0.);
    float step1=length(vec2(invM.x*dir.x+invM.z*dir.y,invM.y*dir.x+invM.w*dir.y));
    // Discs under half a pixel keep ink area pi*r^2: a half-pixel disc scaled by (2r/pix)^2, so they fade, never drop out.
    float re=max(r,.5*pix),k=min(1.,4.*r*r/(pix*pix));
    float c=ink*k*clamp((re-d)/max(step1,1e-5)+.5,0.,1.);
    acc+=vec4(pigment*c,c);
   }
   void main(){
    vec2 px=vec2(gl_PointCoord.x-.5,.5-gl_PointCoord.y)*spritePx;
    vec2 t=vec2(invM.x*px.x+invM.y*px.y,invM.z*px.x+invM.w*px.y);
    pix=sqrt(abs(invM.x*invM.w-invM.y*invM.z));
    ${PAINT_LAYERS.map((_,i)=>`plate(radius${lane(i)},vec2(plateX${lane(i)},plateY${lane(i)}),pigment${i},ink${lane(i)},t);`).join('\n')}
    if(acc.w<.002)discard;
    gl_FragColor=acc;
   }`,transparent:true,depthWrite:false,depthTest:false,
  // Additive and order-independent: every disc on screen adds (a·c, b·c, chroma·c, c) to a float buffer.
  blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.OneFactor,blendDstAlpha:THREE.OneFactor,
 });
 const marks=new THREE.Points(new THREE.BufferGeometry(),material);
 const regionalMaterial=material.clone();regionalMaterial.uniforms.isRegion.value=1;
 const regionalMarks=new THREE.Points(new THREE.BufferGeometry(),regionalMaterial);
 marks.visible=regionalMarks.visible=false;
 const inkScene=new THREE.Scene();inkScene.add(marks,regionalMarks);
 const target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:false});
 // Overlapping discs from any sprite are averaged in OKLab: hue from the mean a/b direction, chroma restored to the
 // mean chroma so mixes stay as saturated as their inks instead of greying out. Lightness is the shared ink lightness.
 const composite=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
  uniforms:{ink:{value:target.texture},size:{value:new THREE.Vector2(1,1)},lightness:{value:INK_L},contrast:{value:1}},
  vertexShader:`void main(){gl_Position=vec4(position.xy,0.,1.);}`,
  fragmentShader:`uniform sampler2D ink;uniform vec2 size;uniform float lightness;uniform float contrast;
   float encode(float c){c=clamp(c,0.,1.);return c<=.0031308?12.92*c:1.055*pow(c,1./2.4)-.055;}
   void main(){
    vec4 s=texture2D(ink,gl_FragCoord.xy/size);
    if(s.w<.002)discard;
    vec2 ab=s.xy/s.w;float m=length(ab);ab=m>1e-5?ab/m*(s.z/s.w):vec2(0.);
    float L=pow(lightness,contrast);
    float l=L+.3963377774*ab.x+.2158037573*ab.y,mm=L-.1055613458*ab.x-.0638541728*ab.y,q=L-.0894841775*ab.x-1.291485548*ab.y;
    l*=l*l;mm*=mm*mm;q*=q*q;
    vec3 rgb=vec3(4.0767416621*l-3.3077115913*mm+.2309699292*q,-1.2684380046*l+2.6097574011*mm-.3413193965*q,-.0041960863*l-.7034186147*mm+1.707614701*q);
    gl_FragColor=vec4(encode(rgb.r),encode(rgb.g),encode(rgb.b),min(1.,s.w));
   }`,transparent:true,depthWrite:false,depthTest:false,
 }));
 composite.frustumCulled=false;composite.renderOrder=2;composite.visible=false;scene.add(composite);
 const bufferSize=new THREE.Vector2(),clear=new THREE.Color();
 composite.onBeforeRender=(renderer,_scene,camera)=>{
  renderer.getDrawingBufferSize(bufferSize);
  if(target.width!==bufferSize.x||target.height!==bufferSize.y)target.setSize(bufferSize.x,bufferSize.y);
  composite.material.uniforms.size.value.copy(bufferSize);
  const previous=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();renderer.getClearColor(clear);
  renderer.setRenderTarget(target);renderer.setClearColor(0x000000,0);renderer.clear(true,false,false);
  renderer.render(inkScene,camera);
  renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);
 };
 const builder=createBuilder(),geometries=new Map(),pending=new Set();
 let current=null,currentRegional=null,level=0,lastDetail='',globalId=0,regionalId=0,regionalGeometry=null,regionalBuilt=-1,regionalLevel=0,regionalPending=false,regionalReadyAt=0,epoch=0,regionalEpoch=0,disposed=false,lastShown=-1,prevShown=-1,farSince=0,reported=false;
 const ensureLevel=l=>{
  if(geometries.has(l)||pending.has(l)||!globalId)return;
  const mine=epoch;pending.add(l);
  builder.build(globalId,DOT_COUNTS[l],null).then(g=>{if(disposed||mine!==epoch)return;if(l!==level&&l!==lastShown&&l!==prevShown)return;geometries.set(l,toGeometry(g));}).catch(()=>{}).finally(()=>{if(mine===epoch)pending.delete(l);});
 };
 const shown=l=>{if(geometries.has(l))return l;let best=-1,gap=9;geometries.forEach((g,k)=>{if(Math.abs(k-l)<gap){gap=Math.abs(k-l);best=k;}});return best;};
 // Keep only the displayed level and the one shown before it; everything else is released.
 const display=k=>{
  if(k<0)return;
  if(k!==lastShown){prevShown=lastShown;lastShown=k;}
  const g=geometries.get(k);if(marks.geometry!==g)marks.geometry=g;
  geometries.forEach((v,key)=>{if(key!==lastShown&&key!==prevShown&&v!==marks.geometry){geometries.delete(key);release(v);}});
 };
 const ensureRegional=(bounds,l)=>{
  if(regionalPending||!regionalId||(regionalGeometry&&regionalBuilt===l))return;
  const mine=regionalEpoch;regionalPending=true;
  builder.build(regionalId,REGIONAL_DOT_COUNTS[l],bounds).then(g=>{
   if(disposed||mine!==regionalEpoch)return;
   const old=regionalGeometry;regionalGeometry=toGeometry(g);regionalBuilt=l;regionalMarks.geometry=regionalGeometry;
   if(old)release(old);else regionalReadyAt=performance.now();
  }).catch(()=>{}).finally(()=>{if(mine===regionalEpoch)regionalPending=false;});
 };
 return {
  update({data,regional,paint,surface,camera,width,height,pixelRatio,onDetail,onVisible}) {
   const strengths=PAINT_LAYERS.map(layer=>{const setting=paint?.[layer.id];return setting?.enabled?setting.strength/100:0;});
   const distance=camera.position.length();
   if(data!==current){
    epoch++;marks.geometry=new THREE.BufferGeometry();geometries.forEach(release);geometries.clear();pending.clear();lastShown=prevShown=-1;
    if(globalId)builder.drop(globalId);current=data;globalId=data?builder.register(data):0;
   }
   if(regional!==currentRegional){
    regionalEpoch++;regionalMarks.geometry=new THREE.BufferGeometry();if(regionalGeometry)release(regionalGeometry);regionalGeometry=null;regionalBuilt=-1;regionalPending=false;
    if(regionalId)builder.drop(regionalId);currentRegional=regional;regionalId=regional?builder.register(regional,scalesFor(data,PAINT_LAYERS)):0;
   }
   // On-screen px per world unit at the nearest surface point (device pixels); picks the lattice density.
   const pxPerUnit=height*pixelRatio/2/(Math.tan(camera.fov*Math.PI/360)*Math.max(.05,distance-1));
   level=detailLevel(pxPerUnit,level);regionalLevel=detailLevel(pxPerUnit,regionalLevel,REGIONAL_DOT_COUNTS);
   if(data){ensureLevel(level);display(shown(level));}
   const regionAvailable=!!(regional&&data&&regional.validAt===data.validAt);
   const regionOnlyEnabled=regionAvailable&&PAINT_LAYERS.some((l,i)=>strengths[i]>0&&regional.fields[l.id]&&!data.fields[l.id]);
   const bounds=regionAvailable?gridBounds(regional.grid):null;
   // The regional set is small (~180k dots, ~15 MB) and rebuilds in the worker in well under a second, so it is
   // released after the camera has stayed far out for a while and rebuilt on the way back in (prefetch at 2.4).
   if(regionalGeometry&&distance>REGIONAL_FAR&&!regionOnlyEnabled){
    const now=performance.now();if(!farSince)farSince=now;
    if(now-farSince>REGIONAL_KEEP_MS){regionalMarks.geometry=new THREE.BufferGeometry();release(regionalGeometry);regionalGeometry=null;regionalBuilt=-1;regionalMarks.visible=false;farSince=0;}
   }else farSince=0;
   // Start the regional build before it is needed (well outside the 1.7 crossfade start).
   if(regionAvailable&&(distance<2.4||regionOnlyEnabled))ensureRegional(bounds,regionalLevel);
   // Global marks only fade once regional marks exist, and the crossfade eases in after a late build.
   const ramp=regionalGeometry?(reduced()?1:Math.min(1,(performance.now()-regionalReadyAt)/350)):0;
   const regionMix=regionAvailable?THREE.MathUtils.smoothstep(1.7-distance,0,.25)*ramp:0;
   if(regionalGeometry&&regionalMarks.geometry!==regionalGeometry)regionalMarks.geometry=regionalGeometry;
   const plate=PAINT_LAYERS.map((_,i)=>plateOffset(i));
   // Near-uniform fields (e.g. ozone) get muted ink: lower plate coverage (opacity), same hue, applied before the commutative mix.
   const gs=scalesFor(data,PAINT_LAYERS),rs=scalesFor(regionAvailable?regional:null,PAINT_LAYERS,gs);
   const inkOf=PAINT_LAYERS.map(l=>(gs[l.id]??rs[l.id])?.emphasis==='muted'?MUTED_INK:1);
   composite.material.uniforms.contrast.value=surface==='white'?1.8:surface==='charcoal'?.85:1;
   [material,regionalMaterial].forEach(m=>{
    m.uniforms.regionMix.value=regionMix;
    m.uniforms.halfView.value.set(width*pixelRatio/2,height*pixelRatio/2);
    m.uniforms.spacing.value=dotSpacing(m===material?DOT_COUNTS[lastShown>=0?lastShown:level]:REGIONAL_DOT_COUNTS[Math.max(0,regionalBuilt)])*1.002;
    for(let i=0;i<GROUPS;i++){
     const lanes=Array.from({length:4},(_,j)=>i*4+j);
     m.uniforms[`amount${i}`].value.fromArray(lanes.map(k=>strengths[k]??0));
     m.uniforms[`regionalFields${i}`].value.fromArray(lanes.map(k=>regionAvailable&&regional.fields[PAINT_LAYERS[k]?.id]?1:0));
     m.uniforms[`globalFields${i}`].value.fromArray(lanes.map(k=>data?.fields[PAINT_LAYERS[k]?.id]?1:0));
     m.uniforms[`ink${i}`].value.fromArray(lanes.map(k=>inkOf[k]??1));
     m.uniforms[`plateX${i}`].value.fromArray(lanes.map(k=>plate[k]?.[0]??0));
     m.uniforms[`plateY${i}`].value.fromArray(lanes.map(k=>plate[k]?.[1]??0));
    }
    if(bounds)m.uniforms.regionBounds.value.set(bounds.west,bounds.south,bounds.east,bounds.north);
   });
   marks.visible=!!data&&marks.geometry.getAttribute('position')!==undefined&&strengths.some((s,i)=>s>0&&data.fields[PAINT_LAYERS[i].id]);
   // Reported after the frame that first draws global dots has been rendered.
   if(!reported&&marks.visible){reported=true;requestAnimationFrame(()=>{if(!disposed)onVisible?.();});}
   regionalMarks.visible=!!regionalGeometry&&(regionMix>0||regionOnlyEnabled)&&strengths.some(s=>s>0);
   composite.visible=marks.visible||regionalMarks.visible;
   const centre=camera.position.clone().normalize(),lat=Math.asin(centre.y)*180/Math.PI,lon=Math.atan2(-centre.z,centre.x)*180/Math.PI;
   const regionInView=bounds&&lat>bounds.south&&lat<bounds.north&&lon>bounds.west&&lon<bounds.east;
   const detail=regionMix>.5&&regionInView?'regional':level<3?'overview':level<5?'medium':'native';
   if(detail!==lastDetail){lastDetail=detail;onDetail?.(detail);}
  },
  dispose(){disposed=true;inkScene.remove(marks,regionalMarks);scene.remove(composite);composite.geometry.dispose();composite.material.dispose();target.dispose();geometries.forEach(release);geometries.clear();if(regionalGeometry)release(regionalGeometry);regionalGeometry=null;builder.dispose();material.dispose();regionalMaterial.dispose();},
 };
}
