import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {feature} from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json';
import {cities,systems} from './data';
import {createGlobalAirLayer} from './GlobalAirLayer';
const vec=(lat,lon,r=1)=>new THREE.Vector3(r*Math.cos(lat*Math.PI/180)*Math.cos(lon*Math.PI/180),r*Math.sin(lat*Math.PI/180),-r*Math.cos(lat*Math.PI/180)*Math.sin(lon*Math.PI/180));
const vertex=`varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vPosition=p.xyz;gl_Position=projectionMatrix*p;}`;
const atmosphere=`varying vec3 vNormal;varying vec3 vPosition;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(-vPosition))),3.6);gl_FragColor=vec4(vec3(.22,.48,.94),rim*.18);}`;
export default function Globe({city,active,selected,mode,zoom,focus,year,month,scenario,onCity,onReady,clean=false,globalAir=null,showGlobalAir=true}){
 const host=useRef(null),runtime=useRef(null),props=useRef({city,active,selected,mode,zoom,focus,year,month,scenario,onCity,globalAir,showGlobalAir}),[error,setError]=useState(false);
 props.current={city,active,selected,mode,zoom,focus,year,month,scenario,onCity,globalAir,showGlobalAir};
 useEffect(()=>{
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){setError(true);return;}
  const container=host.current; renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(39,1,.01,100);camera.position.copy(vec(22,68,3.8));
  const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.075;controls.rotateSpeed=.55;controls.minDistance=1.65;controls.maxDistance=6;controls.enableZoom=true;
  const earth=new THREE.Mesh(new THREE.SphereGeometry(1,192,128),new THREE.MeshPhongMaterial({color:0xffffff,shininess:14,specular:0x465564}));scene.add(earth);
  let disposed=false,textureTier=0;const textures=new Set();
  const loader=new THREE.TextureLoader(),anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  function loadEarth(url,tier){loader.load(url,texture=>{
   if(disposed||tier<textureTier){texture.dispose();return;}
   textureTier=tier;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;
   const previous=earth.material.map;earth.material.map=texture;textures.add(texture);
   if(previous){previous.dispose();textures.delete(previous);}
   earth.material.needsUpdate=true;renderer.domElement.dataset.earthResolution=String(texture.image.width);
  });}
  loadEarth('/earth.jpg',1);
  loadEarth(renderer.capabilities.maxTextureSize>=8192?'/earth-8k.jpg':'/earth-4k.jpg',2);
  loader.load('/earth-specular.jpg',texture=>{if(disposed){texture.dispose();return;}textures.add(texture);texture.anisotropy=anisotropy;earth.material.specularMap=texture;earth.material.needsUpdate=true;});
  scene.add(new THREE.AmbientLight(0xb7c8ee,.36));const sun=new THREE.DirectionalLight(0xffffff,2.25);scene.add(sun);const fill=new THREE.DirectionalLight(0x638ec5,.12);scene.add(fill);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(1.002,96,64),new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:atmosphere,side:THREE.FrontSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(halo);
  const outer=new THREE.Mesh(new THREE.SphereGeometry(1.009,96,64),new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:atmosphere,side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(outer);
  const outlines=[];const countries=feature(atlas,atlas.objects.countries);
  for(const f of countries.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const poly of polys)for(const ring of poly){for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if(Math.abs(a[0]-b[0])<180){outlines.push(...vec(a[1],a[0],1.003).toArray(),...vec(b[1],b[0],1.003).toArray());}}}}
  const outlineGeo=new THREE.BufferGeometry();outlineGeo.setAttribute('position',new THREE.Float32BufferAttribute(outlines,3));if(!clean)scene.add(new THREE.LineSegments(outlineGeo,new THREE.LineBasicMaterial({color:0x98c0b3,transparent:true,opacity:.13})));else outlineGeo.dispose();
  const grid=new THREE.Group();for(let lat=-60;lat<=60;lat+=30){const p=[];for(let lon=-180;lon<=180;lon+=2)p.push(vec(lat,lon,1.005));grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),new THREE.LineBasicMaterial({color:0x749b92,transparent:true,opacity:.10})));}for(let lon=0;lon<360;lon+=30){const p=[];for(let lat=-90;lat<=90;lat+=2)p.push(vec(lat,lon,1.005));grid.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p),new THREE.LineBasicMaterial({color:0x749b92,transparent:true,opacity:.10})));}if(!clean)scene.add(grid);else grid.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  let seed=717;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};const normal=()=>Math.sqrt(-2*Math.log(Math.max(.0001,random())))*Math.cos(6.283*random());
  const particleGroups=[],cloudGroups=[];
  (clean?[]:systems).forEach((system,index)=>{
   const positions=[],sizes=[],phases=[];
   cities.forEach((c)=>{const count=Math.round(65+c.pm*c.profile[index]/14);for(let i=0;i<count;i++){positions.push(...vec(c.lat+normal()*4,c.lon+normal()*7,1.008+Math.pow(random(),2)*.075).toArray());sizes.push(2+random()*8);phases.push(random()*6.283);}});
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));geo.setAttribute('aPhase',new THREE.Float32BufferAttribute(phases,1));
   const mat=new THREE.ShaderMaterial({uniforms:{time:{value:0},tint:{value:new THREE.Color('#d7b58a')},strength:{value:.5}}});
   mat.vertexShader=`attribute float aSize;attribute float aPhase;uniform float time;varying float vAlpha;void main(){vec3 p=position*(1.+sin(time*.22+aPhase)*.003);vec4 mv=modelViewMatrix*vec4(p,1.);vAlpha=.6+.4*sin(aPhase+time*.28);gl_PointSize=aSize*2.4/-mv.z;gl_Position=projectionMatrix*mv;}`;
   mat.fragmentShader=`uniform vec3 tint;uniform float strength;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,2.)*strength*vAlpha;gl_FragColor=vec4(tint,a);}`;mat.transparent=true;mat.depthWrite=false;mat.blending=THREE.AdditiveBlending;
   const points=new THREE.Points(geo,mat);scene.add(points);particleGroups.push(points);
   const cloudPositions=[],cloudSizes=[],cloudPhases=[];
   cities.forEach(c=>{const count=5+Math.round(c.pm*c.profile[index]/110);for(let i=0;i<count;i++){cloudPositions.push(...vec(c.lat+normal()*4.7,c.lon+normal()*7.5,1.015+random()*.065).toArray());cloudSizes.push(80+random()*160);cloudPhases.push(random()*12);}});
   const cloudGeo=new THREE.BufferGeometry();cloudGeo.setAttribute('position',new THREE.Float32BufferAttribute(cloudPositions,3));cloudGeo.setAttribute('aSize',new THREE.Float32BufferAttribute(cloudSizes,1));cloudGeo.setAttribute('aPhase',new THREE.Float32BufferAttribute(cloudPhases,1));
   const cloudMat=new THREE.ShaderMaterial({uniforms:{time:{value:0},tint:{value:new THREE.Color('#8e8874')},strength:{value:.22}},vertexShader:`attribute float aSize;attribute float aPhase;uniform float time;varying float phase;void main(){phase=aPhase;vec3 p=position*(1.+sin(time*.09+aPhase)*.007);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=aSize*2.4/-mv.z;gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float time;uniform vec3 tint;uniform float strength;varying float phase;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.28+noise(p*4.07)*.14;}
void main(){vec2 uv=gl_PointCoord-.5;float d=length(uv);if(d>.49)discard;vec2 p=uv*4.2+vec2(phase,time*.026);float n=fbm(p+vec2(fbm(p*.8),fbm(p*.8+4.)));float envelope=pow(smoothstep(.49,.04,d),1.1);float density=smoothstep(.16,.78,n)*envelope;vec3 smoke=mix(vec3(.13,.18,.17),tint,smoothstep(.25,.72,n));gl_FragColor=vec4(smoke,density*strength);}`,transparent:true,depthWrite:false,blending:THREE.NormalBlending});
   const cloud=new THREE.Points(cloudGeo,cloudMat);cloud.renderOrder=1;scene.add(cloud);cloudGroups.push(cloud);
  });
  const hazeLines=new THREE.Group();for(let j=0;j<(clean?0:35);j++){const pts=[];const c=cities[j%cities.length];for(let i=0;i<80;i++){const t=i/79;pts.push(vec(c.lat+(j%5-2)*1.2+Math.sin(t*3)*2,c.lon-13+t*26,1.025+Math.sin(t*Math.PI)*.035));}hazeLines.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xd5aa72,transparent:true,opacity:.07})));}scene.add(hazeLines);
  const globalLayer=createGlobalAirLayer(scene);
  const markers=new THREE.Group();scene.add(markers);const labels=[];
  cities.forEach(c=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(.0075,10,8),new THREE.MeshBasicMaterial({color:0xd9c4a5}));mesh.position.copy(vec(c.lat,c.lon,1.035));mesh.userData.city=c;markers.add(mesh);const label=document.createElement('button');label.className='globe-label';label.innerHTML=`<span class="pin"></span><span>${c.name}</span>`;label.setAttribute('aria-label',`Explore ${c.name}`);label.onclick=()=>props.current.onCity(c);container.appendChild(label);labels.push({label,position:vec(c.lat,c.lon,1.042),city:c});});
  const paths=new THREE.Group();scene.add(paths);let traces=[],pathLabels=[];
  const disposePaths=()=>{while(paths.children.length){const o=paths.children[0];paths.remove(o);o.geometry?.dispose();o.material?.dispose();}pathLabels.forEach(l=>l.el.remove());pathLabels=[];traces=[];};
  function rebuild(){disposePaths();const p=props.current;if(!p.selected||!p.active.includes(p.selected))return;const s=systems.find(s=>s.id===p.selected);const offsets=s.id==='regional'?[[8,-28],[-9,25],[18,14]]:[[7,-12],[4,10],[-6,-5]];offsets.forEach(([lat,lon],i)=>{const origin=vec(Math.max(-80,Math.min(80,p.city.lat+lat)),p.city.lon+lon,1.02),end=vec(p.city.lat,p.city.lon,1.035);const mid=origin.clone().add(end).normalize().multiplyScalar(1.48+i*.10);const curve=new THREE.QuadraticBezierCurve3(origin,mid,end);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(100)),new THREE.LineDashedMaterial({color:s.color,dashSize:.02,gapSize:.009,transparent:true,opacity:.7}));line.computeLineDistances();line.renderOrder=3;paths.add(line);
   const bead=new THREE.Mesh(new THREE.SphereGeometry(.008,12,8),new THREE.MeshBasicMaterial({color:s.color}));bead.renderOrder=4;paths.add(bead);traces.push({curve,bead,offset:i/3});
   const point=new THREE.Mesh(new THREE.SphereGeometry(.008,10,8),new THREE.MeshBasicMaterial({color:s.color}));point.position.copy(origin);paths.add(point);
   if(i===0){[origin,curve.getPoint(.5)].forEach((position,j)=>{const el=document.createElement('div');el.className='path-label';el.style.setProperty('--trace',s.color);el.innerHTML=`<span>${j===0?s.origin:s.intermediate}</span><small>${j===0?'ILLUSTRATIVE ORIGIN':s.formula}</small>`;container.appendChild(el);pathLabels.push({el,position,labelIndex:j});});}
  });}
  let dimensions={w:1,h:1};const resize=()=>{dimensions={w:container.clientWidth,h:container.clientHeight};renderer.setSize(dimensions.w,dimensions.h);camera.aspect=dimensions.w/dimensions.h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(container);resize();
  let frame,oldFocus=-1,oldSelected='',oldCity='',oldActive='',oldZoom=-1,tween=null;const timer=new THREE.Clock();const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function labelPosition(position,el){const facing=position.clone().normalize().dot(camera.position.clone().normalize());const screen=position.clone().project(camera);const visible=facing>1/camera.position.length()+.02&&Math.abs(screen.x)<.94&&Math.abs(screen.y)<.86;el.style.display=visible?'':'none';el.style.transform=`translate(${(screen.x*.5+.5)*dimensions.w}px,${(-screen.y*.5+.5)*dimensions.h}px)`;}
  const animate=()=>{frame=requestAnimationFrame(animate);const elapsed=timer.getElapsedTime();const p=props.current;
   globalLayer.update({data:p.globalAir,visible:clean&&p.showGlobalAir});
   if(p.selected!==oldSelected||p.city.id!==oldCity||p.active.join()!==oldActive){rebuild();oldSelected=p.selected;oldCity=p.city.id;oldActive=p.active.join();}
   if(p.focus!==oldFocus||p.zoom!==oldZoom){const target=vec(p.city.lat,p.city.lon,p.zoom===1?2.3:3.8);tween={start:camera.position.clone(),end:target,t:elapsed};oldFocus=p.focus;oldZoom=p.zoom;}
   if(tween){let t=Math.min(1,(elapsed-tween.t)/(reduced?.02:1.5));const eased=t*t*(3-2*t);camera.position.lerpVectors(tween.start,tween.end,eased);if(t===1)tween=null;}
   controls.update();sun.position.copy(camera.position).applyAxisAngle(new THREE.Vector3(0,1,0),-.6).add(new THREE.Vector3(0,2,0));fill.position.copy(camera.position).negate();markers.children.forEach(m=>{m.visible=!clean;});particleGroups.forEach((g,i)=>{g.material.uniforms.tint.value.set(p.selected===systems[i].id?systems[i].color:'#d7b58a');g.visible=p.active.includes(systems[i].id)&&p.mode!=='terrain';g.material.uniforms.time.value=reduced?0:elapsed;const season=[1.22,1.16,1.04,.89,.83,.71,.68,.75,.92,1.10,1.31,1.26][p.month];const reduction=['energy','industry','transport'].includes(systems[i].id)?1-p.scenario*.01:1;g.material.uniforms.strength.value=(p.selected&&p.selected!==systems[i].id ? .18 : .74)*season*(1+(2024-p.year)*.027)*reduction;});cloudGroups.forEach((g,i)=>{g.visible=p.active.includes(systems[i].id)&&p.mode!=='terrain';g.material.uniforms.time.value=reduced?0:elapsed;const season=[1.22,1.16,1.04,.89,.83,.71,.68,.75,.92,1.10,1.31,1.26][p.month];const reduction=['energy','industry','transport'].includes(systems[i].id)?1-p.scenario*.01:1;g.material.uniforms.strength.value=(p.selected ? (p.selected===systems[i].id ? .78 : .12) : .40)*season*reduction;g.material.uniforms.tint.value.set(p.selected===systems[i].id?new THREE.Color(systems[i].color).lerp(new THREE.Color('#ada590'),.52):'#ada590');});hazeLines.visible=p.mode!=='terrain';paths.visible=p.mode!=='terrain';pathLabels.forEach(l=>{labelPosition(l.position,l.el);l.el.style.transform+=l.labelIndex===0?' translate(-70px,-76px)':' translate(38px,-20px)';if(p.mode==='terrain')l.el.style.display='none';});labels.forEach(l=>{labelPosition(l.position,l.label);if(clean&&l.city.id!==p.city.id)l.label.style.display='none';
    l.label.classList.toggle('selected',l.city.id===p.city.id);});traces.forEach(t=>t.bead.position.copy(t.curve.getPoint(((reduced?0:elapsed)*.08+t.offset)%1)));renderer.render(scene,camera);
  };animate();runtime.current={camera,controls};onReady?.();
  const cancelTween=()=>{tween=null;};renderer.domElement.addEventListener('pointerdown',cancelTween);const keyboard=e=>{if(e.target!==container)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();tween=null;const spherical=new THREE.Spherical().setFromVector3(camera.position);if(e.key==='ArrowLeft')spherical.theta-=.09;if(e.key==='ArrowRight')spherical.theta+=.09;if(e.key==='ArrowUp')spherical.phi=Math.max(.12,spherical.phi-.07);if(e.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.12,spherical.phi+.07);if(e.key==='+')spherical.radius=Math.max(1.65,spherical.radius*.9);if(e.key==='-')spherical.radius=Math.min(6,spherical.radius*1.1);camera.position.setFromSpherical(spherical);}};container.addEventListener('keydown',keyboard);
  return()=>{disposed=true;textures.forEach(t=>t.dispose());cancelAnimationFrame(frame);container.removeEventListener('keydown',keyboard);observer.disconnect();renderer.domElement.removeEventListener('pointerdown',cancelTween);controls.dispose();globalLayer.dispose();disposePaths();labels.forEach(l=>l.label.remove());scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div ref={host} className="globe-host" tabIndex={0} role="region" aria-label="Interactive Earth. Drag or use arrow keys to rotate. Scroll or use plus and minus to zoom.">{error&&<div className="webgl-error">The 3D globe needs WebGL. Try opening this preview in a browser with graphics acceleration enabled. You can still explore the city and system controls.</div>}</div>;
}
