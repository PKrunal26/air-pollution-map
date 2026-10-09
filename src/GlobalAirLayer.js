import * as THREE from 'three';
import {PAINT_LAYERS} from './paintLayers';

export function createGlobalAirLayer(scene) {
 const material=new THREE.ShaderMaterial({
  uniforms:{amount:{value:new THREE.Vector4()},contrast:{value:1},densityGain:{value:1.2},pixelRatio:{value:Math.min(window.devicePixelRatio,2)},sampleScale:{value:1},pigment0:{value:new THREE.Vector3(...PAINT_LAYERS[0].rgb)},pigment1:{value:new THREE.Vector3(...PAINT_LAYERS[1].rgb)},pigment2:{value:new THREE.Vector3(...PAINT_LAYERS[2].rgb)},pigment3:{value:new THREE.Vector3(...PAINT_LAYERS[3].rgb)}},
  vertexShader:`attribute vec4 sampleWeights;uniform vec4 amount;uniform float contrast;uniform float densityGain;uniform float pixelRatio;uniform float sampleScale;
   uniform vec3 pigment0;uniform vec3 pigment1;uniform vec3 pigment2;uniform vec3 pigment3;varying vec3 colour;varying float opacity;
   void main(){vec4 weights=sampleWeights*amount;float total=dot(weights,vec4(1.));
    vec3 absorption=-log(pigment0)*weights.x-log(pigment1)*weights.y-log(pigment2)*weights.z-log(pigment3)*weights.w;
    colour=exp(-absorption/max(total,.0001)*contrast);
    vec4 mv=modelViewMatrix*vec4(position,1.);float facing=dot(normalize(normalMatrix*position),normalize(-mv.xyz));
    opacity=total>.001?(.65+.35*(1.-exp(-total*densityGain)))*smoothstep(0.,.08,facing):0.;
    gl_PointSize=(3.+6.*(1.-exp(-total*1.7)))*pixelRatio*sampleScale*3.8/max(-mv.z,1.);
    gl_Position=projectionMatrix*mv;
   }`,
  fragmentShader:`varying vec3 colour;varying float opacity;void main(){float r=length(gl_PointCoord-.5);if(r>.5||opacity<.001)discard;gl_FragColor=vec4(colour,opacity*(1.-smoothstep(.40,.5,r)));}`,
  // Facing hides occluded samples; depth testing would cut billboard circles into the globe.
  transparent:true,depthWrite:false,depthTest:false,
 });
 const geometry=new THREE.BufferGeometry(),marks=new THREE.Points(geometry,material);
 marks.visible=false;marks.renderOrder=2;scene.add(marks);let current=null;
 return {
  update({data,paint,surface}) {
   material.uniforms.contrast.value=surface==='white'?1.8:surface==='charcoal'?.85:1;
   material.uniforms.densityGain.value=surface==='white'?2.1:surface==='charcoal'?1.9:1.2;
   const strengths=PAINT_LAYERS.map(layer=>{const setting=paint?.[layer.id];return setting?.enabled?setting.strength/100:0;});
   marks.visible=!!data&&strengths.some(s=>s>0);material.uniforms.amount.value.fromArray(strengths);
   if(!data||current===data)return;
   current=data;material.uniforms.sampleScale.value=Math.sqrt(data.grid.step/5);
   const count=data.grid.width*(data.grid.height-2)+2;
   const positions=new Float32Array(count*3),weights=new Float32Array(count*4);let cursor=0;
   for(let row=0;row<data.grid.height;row++)for(let col=0;col<data.grid.width;col++){
    const lat=data.grid.latStart+row*data.grid.step,lon=data.grid.lonStart+col*data.grid.step;
    // Longitude samples coincide at the poles: draw that location once.
    if(Math.abs(lat)===90&&col!==0)continue;
    const phi=lat*Math.PI/180,theta=lon*Math.PI/180,r=1.002;
    positions[cursor*3]=r*Math.cos(phi)*Math.cos(theta);positions[cursor*3+1]=r*Math.sin(phi);positions[cursor*3+2]=-r*Math.cos(phi)*Math.sin(theta);
    const index=row*data.grid.width+col;
    PAINT_LAYERS.forEach((layer,i)=>{weights[cursor*4+i]=Math.min(data.fields[layer.id][index]/layer.range,1);});cursor++;
   }
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
   geometry.setAttribute('sampleWeights',new THREE.BufferAttribute(weights,4));
   geometry.computeBoundingSphere();
  },
  dispose(){scene.remove(marks);geometry.dispose();material.dispose();},
 };
}
