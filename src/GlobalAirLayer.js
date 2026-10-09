import * as THREE from 'three';
import {PAINT_LAYERS} from './paintLayers';
import {DOT_COUNTS,REGIONAL_DOT_COUNT,sphereSamples,gridBounds,sampleField,detailLevel} from './sphereSampling';

export function createGlobalAirLayer(scene) {
 const material=new THREE.ShaderMaterial({
  uniforms:{amount:{value:new THREE.Vector4()},contrast:{value:1},densityGain:{value:1.2},focalPixels:{value:1000},spacing:{value:.02},regionMix:{value:0},isRegion:{value:0},regionBounds:{value:new THREE.Vector4(-25,30,45,72)},pigment0:{value:new THREE.Vector3(...PAINT_LAYERS[0].rgb)},pigment1:{value:new THREE.Vector3(...PAINT_LAYERS[1].rgb)},pigment2:{value:new THREE.Vector3(...PAINT_LAYERS[2].rgb)},pigment3:{value:new THREE.Vector3(...PAINT_LAYERS[3].rgb)}},
  vertexShader:`attribute vec4 sampleWeights;attribute vec2 location;uniform vec4 amount;uniform float contrast;uniform float densityGain;uniform float focalPixels;uniform float spacing;uniform float regionMix;uniform float isRegion;uniform vec4 regionBounds;
   varying vec4 inkWeights;varying float visibility;
   void main(){vec4 weights=sampleWeights*amount;float total=dot(weights,vec4(1.));
    inkWeights=weights;
    vec4 mv=modelViewMatrix*vec4(position,1.);float facing=dot(normalize(normalMatrix*position),normalize(-mv.xyz));
    float edge=min(min(location.x-regionBounds.x,regionBounds.z-location.x),min(location.y-regionBounds.y,regionBounds.w-location.y));
    float inside=smoothstep(0.,1.5,edge);
    visibility=mix(1.-inside*regionMix,inside*regionMix,isRegion)*smoothstep(0.,.08,facing);
    gl_PointSize=clamp(spacing*focalPixels*1.62*(.8+.2*(1.-exp(-total*1.7)))/max(-mv.z,.05),2.25,36.);
    gl_Position=projectionMatrix*mv;
   }`,
  // Expanded sprites preserve ink size while allowing 2.5x print misregistration without clipping.
  // Sample coordinates and source concentrations never move.
  fragmentShader:`uniform float contrast;uniform float densityGain;uniform vec3 pigment0;uniform vec3 pigment1;uniform vec3 pigment2;uniform vec3 pigment3;varying vec4 inkWeights;varying float visibility;
   float ink(vec2 p,vec2 offset){float r=length(p-offset);float aa=max(fwidth(r)*.55,.012);return 1.-smoothstep(.345-aa,.345+aa,r);}
   void main(){if(visibility<.001)discard;vec2 p=(gl_PointCoord-.5)*1.5;
    vec4 coverage=vec4(ink(p,vec2(-.2375,-.1125)),ink(p,vec2(.25,.1375)),ink(p,vec2(-.0625,.2625)),ink(p,vec2(.1375,-.2625)));
    vec4 weights=inkWeights*coverage;float total=dot(weights,vec4(1.));if(total<.001)discard;
    vec3 absorption=-log(pigment0)*weights.x-log(pigment1)*weights.y-log(pigment2)*weights.z-log(pigment3)*weights.w;
    vec3 colour=exp(-absorption/max(total,.0001)*contrast);
    float opacity=(1.-exp(-total*densityGain*2.4))*visibility;
    gl_FragColor=vec4(colour,opacity);
   }`,
  transparent:true,depthWrite:false,depthTest:false,
 });
 const marks=new THREE.Points(new THREE.BufferGeometry(),material);
 const regionalMaterial=material.clone();regionalMaterial.uniforms.isRegion.value=1;
 const regionalMarks=new THREE.Points(new THREE.BufferGeometry(),regionalMaterial);
 marks.visible=regionalMarks.visible=false;marks.renderOrder=regionalMarks.renderOrder=2;scene.add(marks,regionalMarks);
 let current=null,currentRegional=null,level=0,regionalGeometry=null,lastDetail='';const geometries=new Map();
 function geometryFor(data,count,bounds=null){
  const samples=sphereSamples(count,bounds),length=samples.length/5;
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(length*3),weights=new Float32Array(length*4),locations=new Float32Array(length*2);
  for(let n=0;n<length;n++){
   const o=n*5,lat=samples[o+3],lon=samples[o+4];
   positions[n*3]=samples[o]*1.002;positions[n*3+1]=samples[o+1]*1.002;positions[n*3+2]=samples[o+2]*1.002;
   locations[n*2]=lon;locations[n*2+1]=lat;
   PAINT_LAYERS.forEach((layer,i)=>{weights[n*4+i]=Math.min(sampleField(data,layer.id,lat,lon)/layer.range,1);});
  }
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('sampleWeights',new THREE.BufferAttribute(weights,4));geometry.setAttribute('location',new THREE.BufferAttribute(locations,2));geometry.computeBoundingSphere();return geometry;
 }
 return {
  update({data,regional,paint,surface,camera,height,pixelRatio,onDetail}) {
   const strengths=PAINT_LAYERS.map(layer=>{const setting=paint?.[layer.id];return setting?.enabled?setting.strength/100:0;});
   const distance=camera.position.length();
   if(data!==current){geometries.forEach(g=>g.dispose());geometries.clear();current=data;}
   if(regional!==currentRegional){regionalGeometry?.dispose();regionalGeometry=null;currentRegional=regional;}
   level=detailLevel(distance,level);
   if(data&&!geometries.has(level))geometries.set(level,geometryFor(data,DOT_COUNTS[level]));
   if(data){if(!marks.geometry.getAttribute('position'))marks.geometry.dispose();marks.geometry=geometries.get(level);}
   const regionAvailable=regional&&data&&regional.validAt===data.validAt;
   // Actual regional fields replace the global model inside their coverage when close.
   const regionMix=regionAvailable?THREE.MathUtils.smoothstep(1.7-distance,0,.25):0;
   if(regionMix>0&&!regionalGeometry){regionalMarks.geometry.dispose();regionalGeometry=geometryFor(regional,REGIONAL_DOT_COUNT,gridBounds(regional.grid));regionalMarks.geometry=regionalGeometry;}
   const bounds=regional?gridBounds(regional.grid):null;
   [material,regionalMaterial].forEach((m,i)=>{
    m.uniforms.contrast.value=surface==='white'?1.8:surface==='charcoal'?.85:1;
    m.uniforms.densityGain.value=surface==='white'?2.1:surface==='charcoal'?1.9:1.2;
    m.uniforms.amount.value.fromArray(strengths);m.uniforms.regionMix.value=regionMix;
    m.uniforms.focalPixels.value=height*pixelRatio/(2*Math.tan(camera.fov*Math.PI/360));
    m.uniforms.spacing.value=Math.sqrt(4*Math.PI/(i===1?REGIONAL_DOT_COUNT:DOT_COUNTS[level]));
    if(bounds)m.uniforms.regionBounds.value.set(bounds.west,bounds.south,bounds.east,bounds.north);
   });
   marks.visible=!!data&&strengths.some(s=>s>0);regionalMarks.visible=marks.visible&&regionMix>0&&!!regionalGeometry;
   const centre=camera.position.clone().normalize(),lat=Math.asin(centre.y)*180/Math.PI,lon=Math.atan2(-centre.z,centre.x)*180/Math.PI;
   const regionInView=bounds&&lat>bounds.south&&lat<bounds.north&&lon>bounds.west&&lon<bounds.east;
   const detail=regionMix>.5&&regionInView?'regional':DOT_COUNTS[level]===DOT_COUNTS[0]?'overview':level===1?'medium':'native';
   if(detail!==lastDetail){lastDetail=detail;onDetail?.(detail);}
  },
  dispose(){scene.remove(marks,regionalMarks);geometries.forEach(g=>g.dispose());regionalGeometry?.dispose();material.dispose();regionalMaterial.dispose();},
 };
}
