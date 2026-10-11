import * as THREE from 'three';
import {subsolarPoint,sublunarPoint} from './sunPosition.js';

// Sun layer, lit like Google Earth's sun mode for the hour on the time bar: daylight fading into night over the dots,
// the atmosphere glowing on the sunlit edge, the sun as a glare and the moon where they really are. Strength (0–100)
// sets how dark night gets. Built on first use, so the moon map only loads for people who turn the layer on.
const DEG=Math.PI/180;
const toVector=(lat,lon)=>new THREE.Vector3(Math.cos(lat*DEG)*Math.cos(lon*DEG),Math.sin(lat*DEG),-Math.cos(lat*DEG)*Math.sin(lon*DEG));

export function createSunLayer(scene){
 const sun={value:new THREE.Vector3(1,0,0)};
 let parts=null,on=false;
 const build=()=>{
  // Night over the dots. No depth test, so it also covers the country lines that sit just above the surface.
  const nightMaterial=new THREE.ShaderMaterial({uniforms:{sun,darkness:{value:.6}},transparent:true,depthWrite:false,depthTest:false,
   vertexShader:`varying vec3 local;void main(){local=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`uniform vec3 sun;uniform float darkness;varying vec3 local;void main(){float c=dot(normalize(local),sun);gl_FragColor=vec4(.02,.027,.04,(1.-smoothstep(-.14,.32,c))*darkness);}`});
  const night=new THREE.Mesh(new THREE.SphereGeometry(1.0012,160,96),nightMaterial);night.renderOrder=5;
  // Atmosphere lit only on the sun side, warm at dusk.
  const glowMaterial=new THREE.ShaderMaterial({uniforms:{sun},transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,
   vertexShader:`varying vec3 vNormal;varying vec3 local;void main(){vNormal=normalize(normalMatrix*normal);local=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
   fragmentShader:`uniform vec3 sun;varying vec3 vNormal;varying vec3 local;void main(){float c=dot(local,sun);float lit=smoothstep(-.3,.25,c);float rim=pow(smoothstep(0.,.31,-vNormal.z),2.2);vec3 col=mix(vec3(1.,.58,.32),vec3(.42,.66,1.),smoothstep(0.,.35,c));gl_FragColor=vec4(col,rim*lit*.55);}`});
  const glow=new THREE.Mesh(new THREE.SphereGeometry(1.05,96,64),glowMaterial);glow.renderOrder=6;
  // The sun as a glare far out along its direction; in frame only when it is behind the globe.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const g=canvas.getContext('2d'),r=g.createRadialGradient(128,128,0,128,128,128);
  r.addColorStop(0,'rgba(255,255,250,1)');r.addColorStop(.06,'rgba(255,248,225,1)');r.addColorStop(.16,'rgba(255,214,150,.45)');r.addColorStop(.45,'rgba(255,180,110,.1)');r.addColorStop(1,'rgba(255,170,100,0)');
  g.fillStyle=r;g.fillRect(0,0,256,256);
  const glare=new THREE.CanvasTexture(canvas);glare.colorSpace=THREE.SRGBColorSpace;
  const disc=new THREE.Sprite(new THREE.SpriteMaterial({map:glare,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
  disc.scale.setScalar(7);disc.renderOrder=7;
  // Moon: NASA LRO colour map (public domain, SVS CGI Moon Kit), enlarged about four times so it reads at globe scale.
  // The map's centre (0° lunar longitude) faces the Earth, which in three's sphere UVs is local +x. The same sun lights
  // it, so the phase is real; with no air the terminator is sharp; earthshine keeps the dark limb faintly visible.
  const moonMap=new THREE.TextureLoader().load('moon.jpg');moonMap.colorSpace=THREE.SRGBColorSpace;moonMap.anisotropy=4;
  const moonMaterial=new THREE.ShaderMaterial({uniforms:{sun,map:{value:moonMap}},
   vertexShader:`varying vec3 wn;varying vec3 wp;varying vec2 vUv;void main(){wn=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);wp=w.xyz;vUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}`,
   fragmentShader:`uniform vec3 sun;uniform sampler2D map;varying vec3 wn;varying vec3 wp;varying vec2 vUv;
// Lommel-Seeliger: airless dusty soil. Dims smoothly towards the terminator, yet a full moon stays an evenly bright disc.
void main(){vec3 n=normalize(wn),albedo=texture2D(map,vUv).rgb;float i=max(dot(n,sun),0.),e=max(dot(n,normalize(cameraPosition-wp)),.02);
 gl_FragColor=vec4(albedo*(.035+1.9*i/(i+e)),1.);
#include <colorspace_fragment>
}`});
  const moon=new THREE.Mesh(new THREE.SphereGeometry(.6,64,32),moonMaterial);
  scene.add(night,glow,disc,moon);
  return {night,nightMaterial,glow,glowMaterial,disc,glare,moon,moonMaterial,moonMap};
 };
 const show=visible=>{on=visible;if(parts)for(const k of ['night','glow','disc','moon'])parts[k].visible=visible;};
 return {
  // time: ms UTC of the hour shown, or null (History has no time of day). strength: 0–100.
  update({enabled,time,strength}){
   if(!enabled||!Number.isFinite(time)){if(on)show(false);return;}
   parts??=build();
   const s=subsolarPoint(time),m=sublunarPoint(time),moonDir=toVector(m.lat,m.lon);
   sun.value.copy(toVector(s.lat,s.lon));
   parts.nightMaterial.uniforms.darkness.value=Math.max(0,Math.min(1,strength/100))*1.1;
   parts.disc.position.copy(sun.value).multiplyScalar(40);
   parts.moon.position.copy(moonDir).multiplyScalar(30);
   const face=moonDir.clone().negate(),up=new THREE.Vector3(0,1,0).addScaledVector(face,-face.y).normalize();
   parts.moon.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(face,up,new THREE.Vector3().crossVectors(face,up)));
   if(!on)show(true);
  },
  // While on, the globe's main light comes from the sun, so the satellite surface is lit (and oceans glint) for real.
  get lit(){return on;},
  get direction(){return sun.value;},
  dispose(){
   if(!parts)return;
   scene.remove(parts.night,parts.glow,parts.disc,parts.moon);
   for(const k of ['night','glow','moon'])parts[k].geometry.dispose();
   for(const k of ['nightMaterial','glowMaterial','moonMaterial','glare','moonMap'])parts[k].dispose();
   parts.disc.material.dispose();
  },
 };
}
