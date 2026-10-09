import * as THREE from 'three';

export function createGlobalAirLayer(scene) {
 const material=new THREE.ShaderMaterial({
  uniforms:{field:{value:null}},
  vertexShader:`varying vec2 fieldUv;varying vec3 surfaceNormal;varying vec3 viewPosition;
  uniform sampler2D field;
  float valueAt(vec2 uv){vec4 s=texture2D(field,vec2(uv.x+.5/72.,(uv.y*36.+.5)/37.));return (s.r*65280.+s.g*255.)*.1;}
  void main(){fieldUv=uv;float v=valueAt(uv);float height=.004+.023*clamp(v/100.,0.,1.);vec3 p=position*(1.+height);vec4 mv=modelViewMatrix*vec4(p,1.);surfaceNormal=normalize(normalMatrix*normal);viewPosition=mv.xyz;gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying vec2 fieldUv;varying vec3 surfaceNormal;varying vec3 viewPosition;uniform sampler2D field;
  vec3 colour(float v){
   vec3 low=vec3(.53,.68,.72),medium=vec3(.91,.72,.39),high=vec3(.88,.36,.20),veryHigh=vec3(.62,.16,.27);
   if(v<10.)return mix(low,medium,clamp(v/10.,0.,1.));
   if(v<35.)return mix(medium,high,(v-10.)/25.);
   return mix(high,veryHigh,clamp((v-35.)/65.,0.,1.));
  }
  void main(){vec4 s=texture2D(field,vec2(fieldUv.x+.5/72.,(fieldUv.y*36.+.5)/37.));float v=(s.r*65280.+s.g*255.)*.1;
   float facing=max(0.,dot(normalize(surfaceNormal),normalize(-viewPosition)));
   float opacity=(.04+.68*(1.-exp(-v/23.)))*smoothstep(0.,.24,facing);
   gl_FragColor=vec4(colour(v),opacity);
  }`,
  transparent:true,depthWrite:false,depthTest:true,side:THREE.FrontSide,
 });
 const geometry=new THREE.SphereGeometry(1,192,128),mesh=new THREE.Mesh(geometry,material);
 mesh.visible=false;mesh.renderOrder=2;scene.add(mesh);let current=null,texture=null;
 return {
  update({data,visible}) {
   mesh.visible=!!data&&visible;
   if(!data||current===data)return;
   current=data;texture?.dispose();
   const bytes=new Uint8Array(data.values.length*4);
   data.values.forEach((v,i)=>{const encoded=Math.round(v*10);bytes[i*4]=encoded>>8;bytes[i*4+1]=encoded&255;bytes[i*4+2]=255;bytes[i*4+3]=255;});
   texture=new THREE.DataTexture(bytes,data.grid.width,data.grid.height,THREE.RGBAFormat);
   texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;texture.generateMipmaps=false;texture.needsUpdate=true;
   material.uniforms.field.value=texture;
  },
  dispose(){scene.remove(mesh);geometry.dispose();material.dispose();texture?.dispose();},
 };
}
