import * as THREE from 'three';
import {sampleWeather} from './weather';
import {sphereSamples} from './sphereSampling';
const DEG=Math.PI/180;
const xyz=(lat,lon,r=1.007)=>new THREE.Vector3(r*Math.cos(lat*DEG)*Math.cos(lon*DEG),r*Math.sin(lat*DEG),-r*Math.cos(lat*DEG)*Math.sin(lon*DEG));
export function createWeatherLayer(scene){
 const fieldMaterial=new THREE.ShaderMaterial({
  uniforms:{field:{value:null},strength:{value:new THREE.Vector2()}},transparent:true,depthWrite:false,
  vertexShader:`varying vec2 fieldUv;void main(){fieldUv=vec2((uv.x*1440.+.5)/1440.,(uv.y*720.+.5)/721.);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D field;uniform vec2 strength;varying vec2 fieldUv;
   void main(){vec2 v=texture2D(field,fieldUv).rg;float t=v.r;vec3 cold=vec3(.24,.39,.85),mild=vec3(.69,.66,.83),hot=vec3(.96,.36,.23);
    vec3 thermal=t<.5?mix(cold,mild,t*2.):mix(mild,hot,(t-.5)*2.);
    vec3 humid=mix(vec3(.11,.29,.31),vec3(.35,.90,.78),v.g);
    float total=strength.x+strength.y;vec3 colour=(thermal*strength.x+humid*strength.y)/max(total,.001);
    gl_FragColor=vec4(colour,min(total*.7,.85));}`,
 });
 const fieldMesh=new THREE.Mesh(new THREE.SphereGeometry(1.001,192,128),fieldMaterial);fieldMesh.renderOrder=1;fieldMesh.visible=false;scene.add(fieldMesh);
 const windMaterial=new THREE.ShaderMaterial({
  uniforms:{time:{value:0},strength:{value:0},ink:{value:new THREE.Color('#d9e6ef')},still:{value:0}},transparent:true,depthWrite:false,depthTest:false,
  vertexShader:`attribute float phase;varying float along;varying float facing;void main(){along=phase;vec4 mv=modelViewMatrix*vec4(position,1.);facing=dot(normalize(normalMatrix*position),normalize(-mv.xyz));gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`uniform float time;uniform float strength;uniform float still;uniform vec3 ink;varying float along;varying float facing;void main(){float pulse=mix(.08+.92*pow(1.-fract(along-time*.13),2.),.65,still);float a=pulse*strength*smoothstep(.02,.15,facing);if(a<.005)discard;gl_FragColor=vec4(ink,a);}`,
 });
 const wind=new THREE.LineSegments(new THREE.BufferGeometry(),windMaterial);wind.renderOrder=4;wind.visible=false;scene.add(wind);
 let current=null,texture=null;
 function prepare(data){
  const {width,height}=data.grid,pixels=new Uint8Array(width*height*4);
  for(let i=0;i<width*height;i++){pixels[i*4]=Math.round(THREE.MathUtils.clamp((data.fields.temperature_2m[i]+40)/80,0,1)*255);pixels[i*4+1]=Math.round(data.fields.relative_humidity_2m[i]*2.55);pixels[i*4+3]=255;}
  texture?.dispose();texture=new THREE.DataTexture(pixels,width,height);texture.wrapS=THREE.RepeatWrapping;texture.magFilter=texture.minFilter=THREE.LinearFilter;texture.needsUpdate=true;fieldMaterial.uniforms.field.value=texture;
  const seeds=sphereSamples(3200),positions=[],phases=[];
  // Streamlines integrate a frozen 10 m vector field. Animation is an illustrative pulse.
  for(let i=0;i<seeds.length;i+=5){
   let lat=seeds[i+3],lon=seeds[i+4],position=xyz(lat,lon);const offset=(i/5*.61803398875)%1;
   for(let j=0;j<24;j++){
    const u=sampleWeather(data,'wind_u_component_10m',lat,lon),v=sampleWeather(data,'wind_v_component_10m',lat,lon);
    if(Math.hypot(u,v)<.15)break;
    const lambda=lon*DEG,phi=lat*DEG;
    const east=new THREE.Vector3(-Math.sin(lambda),0,-Math.cos(lambda));
    const north=new THREE.Vector3(-Math.sin(phi)*Math.cos(lambda),Math.cos(phi),Math.sin(phi)*Math.sin(lambda));
    const next=position.clone().normalize().addScaledVector(east,u*1800/6371000).addScaledVector(north,v*1800/6371000).normalize().multiplyScalar(1.007);
    positions.push(...position.toArray(),...next.toArray());phases.push(offset+j/24,offset+(j+1)/24);
    position=next;lat=Math.asin(next.y/1.007)/DEG;lon=Math.atan2(-next.z,next.x)/DEG;
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('phase',new THREE.Float32BufferAttribute(phases,1));geo.computeBoundingSphere();wind.geometry.dispose();wind.geometry=geo;
 }
 return {
  update({data,settings,surface,elapsed,reduced}){
   if(data!==current){current=data;if(data)prepare(data);}
   const amount=id=>settings?.[id]?.enabled?settings[id].strength/100:0;
   const temp=amount('temperature'),humidity=amount('humidity');
   fieldMesh.visible=!!data&&(temp>0||humidity>0);fieldMaterial.uniforms.strength.value.set(temp,humidity);
   wind.visible=!!data&&amount('wind')>0;windMaterial.uniforms.strength.value=amount('wind');windMaterial.uniforms.time.value=elapsed;windMaterial.uniforms.still.value=reduced?1:0;windMaterial.uniforms.ink.value.set(surface==='white'?'#253e52':'#e0f1f6');
  },
  dispose(){scene.remove(fieldMesh,wind);fieldMesh.geometry.dispose();wind.geometry.dispose();fieldMaterial.dispose();windMaterial.dispose();texture?.dispose();},
 };
}
