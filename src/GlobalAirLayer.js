import * as THREE from 'three';
import {PAINT_LAYERS} from './paintLayers';

export function createGlobalAirLayer(scene) {
 const material=new THREE.ShaderMaterial({
  uniforms:{field:{value:null},amount:{value:new THREE.Vector4()},pigment0:{value:new THREE.Vector3(...PAINT_LAYERS[0].rgb)},pigment1:{value:new THREE.Vector3(...PAINT_LAYERS[1].rgb)},pigment2:{value:new THREE.Vector3(...PAINT_LAYERS[2].rgb)},pigment3:{value:new THREE.Vector3(...PAINT_LAYERS[3].rgb)}},
  vertexShader:`varying vec2 fieldUv;varying vec3 surfaceNormal;varying vec3 viewPosition;uniform sampler2D field;uniform vec4 amount;
  void main(){fieldUv=uv;vec4 weights=texture2D(field,vec2(uv.x+.5/72.,(uv.y*36.+.5)/37.))*amount;float density=dot(weights,vec4(1.));vec3 p=position*(1.004+min(density,1.6)*.012);vec4 mv=modelViewMatrix*vec4(p,1.);surfaceNormal=normalize(normalMatrix*normal);viewPosition=mv.xyz;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec2 fieldUv;varying vec3 surfaceNormal;varying vec3 viewPosition;uniform sampler2D field;uniform vec4 amount;
  uniform vec3 pigment0;uniform vec3 pigment1;uniform vec3 pigment2;uniform vec3 pigment3;
  void main(){vec4 weights=texture2D(field,vec2(fieldUv.x+.5/72.,(fieldUv.y*36.+.5)/37.))*amount;
   float total=dot(weights,vec4(1.));if(total<.001)discard;
   vec3 absorption=-log(pigment0)*weights.x-log(pigment1)*weights.y-log(pigment2)*weights.z-log(pigment3)*weights.w;
   vec3 paint=exp(-absorption/total);
   float facing=max(0.,dot(normalize(surfaceNormal),normalize(-viewPosition)));
   float opacity=(1.-exp(-total*1.2))*smoothstep(0.,.24,facing);
   gl_FragColor=vec4(paint,opacity);
  }`,
  transparent:true,depthWrite:false,depthTest:true,side:THREE.FrontSide,
 });
 const geometry=new THREE.SphereGeometry(1,192,128),mesh=new THREE.Mesh(geometry,material);
 mesh.visible=false;mesh.renderOrder=2;scene.add(mesh);let current=null,texture=null;
 return {
  update({data,paint}) {
   const strengths=PAINT_LAYERS.map(layer=>{const setting=paint?.[layer.id];return setting?.enabled?setting.strength/100:0;});
   mesh.visible=!!data&&strengths.some(s=>s>0);material.uniforms.amount.value.fromArray(strengths);
   if(!data||current===data)return;
   current=data;texture?.dispose();const bytes=new Uint8Array(data.grid.width*data.grid.height*4);
   PAINT_LAYERS.forEach((layer,channel)=>data.fields[layer.id].forEach((v,i)=>{bytes[i*4+channel]=Math.round(Math.min(v/layer.range,1)*255);}));
   texture=new THREE.DataTexture(bytes,data.grid.width,data.grid.height,THREE.RGBAFormat);
   texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.needsUpdate=true;material.uniforms.field.value=texture;
  },
  dispose(){scene.remove(mesh);geometry.dispose();material.dispose();texture?.dispose();},
 };
}
