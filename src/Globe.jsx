import React,{useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {feature} from 'topojson-client';
import atlas from 'world-atlas/countries-110m.json' with {type:'json'};
import {places} from './places';
import {createGlobalAirLayer} from './GlobalAirLayer';
import {createWeatherLayer} from './WeatherLayer';
import {cameraArc,sampleCameraArc} from './cameraTransition';
import './styles/globe.css';
import {createGlobeProbe} from './GlobeProbe';
import {homeDistanceForZoom} from './embedParams';
const vec=(lat,lon,r=1)=>new THREE.Vector3(r*Math.cos(lat*Math.PI/180)*Math.cos(lon*Math.PI/180),r*Math.sin(lat*Math.PI/180),-r*Math.cos(lat*Math.PI/180)*Math.sin(lon*Math.PI/180));
const vertex=`varying vec3 vNormal; varying vec3 vPosition; void main(){vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vPosition=p.xyz;gl_Position=projectionMatrix*p;}`;
const atmosphere=`varying vec3 vNormal;varying vec3 vPosition;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(-vPosition))),3.6);gl_FragColor=vec4(vec3(.22,.48,.94),rim*.18);}`;
const EARTH_MIN=1.18,EARTH_MAX=6,EPS=.012;
export default function Globe({city,zoom,focus,onCity,onReady,globalAir=null,paint=null,surface='satellite',regionalAir=null,onDetail,weatherData=null,weatherSettings=null,reset=0,onInteraction,onProbe,readout=true,probeEnabled=true,probeReset=0,viewShift=0,flyTarget=null,onCameraRange,onAirVisible,homeScale=null,wheelModifier=false,timeline=null,userLocation=null,chromeInset=0}){
 const host=useRef(null),readyDone=useRef(false),airDone=useRef(false),props=useRef({}),[error,setError]=useState(false);
 props.current={city,zoom,focus,onCity,onReady,globalAir,paint,surface,regionalAir,onDetail,weatherData,weatherSettings,reset,onProbe,probeEnabled,probeReset,viewShift,flyTarget,onCameraRange,onAirVisible,homeScale,wheelModifier,timeline,userLocation,chromeInset};
 useEffect(()=>{
  const ready=()=>{if(readyDone.current)return;readyDone.current=true;props.current.onReady?.();};
  let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch(e){setError(true);ready();return;}
  const container=host.current; renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;container.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(39,1,.01,100);camera.position.copy(vec(18,15,3.8));
  const controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.075;controls.rotateSpeed=.55;controls.minDistance=1.18;controls.maxDistance=6;controls.enableZoom=true;
  const satelliteMaterial=new THREE.MeshPhongMaterial({color:0xffffff,shininess:14,specular:0x465564});
  function neutralMaterial(land,ocean){return new THREE.ShaderMaterial({
   uniforms:{base:{value:new THREE.Vector3(...land)},ocean:{value:new THREE.Vector3(...ocean)},waterMask:{value:null},hasMask:{value:0}},
   vertexShader:`varying vec2 surfaceUv;varying vec3 vNormal;varying vec3 vPosition;void main(){surfaceUv=uv;vNormal=normalize(normalMatrix*normal);vec4 p=modelViewMatrix*vec4(position,1.);vPosition=p.xyz;gl_Position=projectionMatrix*p;}`,
   fragmentShader:`uniform vec3 base;uniform vec3 ocean;uniform sampler2D waterMask;uniform float hasMask;varying vec2 surfaceUv;varying vec3 vNormal;varying vec3 vPosition;void main(){vec3 n=normalize(vNormal);float face=max(0.,dot(n,normalize(-vPosition)));float light=.90+.10*max(0.,dot(n,normalize(vec3(-.4,.5,1.))));float edge=1.-pow(1.-face,3.)*.08;float water=smoothstep(.25,.75,texture2D(waterMask,surfaceUv).r)*hasMask;gl_FragColor=vec4(mix(base,ocean,water)*light*edge,1.);}`,
  });}
  const surfaceMaterials={satellite:satelliteMaterial,white:neutralMaterial([.97,.97,.95],[.66,.73,.79]),charcoal:neutralMaterial([.12,.12,.125],[.055,.055,.065])};
  const earth=new THREE.Mesh(new THREE.SphereGeometry(1,192,128),satelliteMaterial);scene.add(earth);

  let disposed=false,textureTier=0;const textures=new Set();
  const loader=new THREE.TextureLoader(),anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
  const readySoon=()=>requestAnimationFrame(()=>{if(!disposed)ready();});
  function loadEarth(url,tier){loader.load(url,texture=>{
   if(disposed||tier<textureTier){texture.dispose();if(!disposed)readySoon();return;}
   textureTier=tier;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=anisotropy;
   const previous=satelliteMaterial.map;satelliteMaterial.map=texture;textures.add(texture);
   if(previous){previous.dispose();textures.delete(previous);}
   satelliteMaterial.needsUpdate=true;renderer.domElement.dataset.earthResolution=String(texture.image.width);readySoon();
  },undefined,()=>{if(tier===1&&!disposed)readySoon();});}
  loadEarth('earth.jpg',1);
  loadEarth(renderer.capabilities.maxTextureSize>=8192?'earth-8k.jpg':'earth-4k.jpg',2);
  loader.load('earth-specular.jpg',texture=>{if(disposed){texture.dispose();return;}textures.add(texture);texture.anisotropy=anisotropy;satelliteMaterial.specularMap=texture;satelliteMaterial.needsUpdate=true;for(const id of ['white','charcoal']){surfaceMaterials[id].uniforms.waterMask.value=texture;surfaceMaterials[id].uniforms.hasMask.value=1;}});
  scene.add(new THREE.AmbientLight(0xb7c8ee,.36));const sun=new THREE.DirectionalLight(0xffffff,2.25);scene.add(sun);const fill=new THREE.DirectionalLight(0x638ec5,.12);scene.add(fill);
  const halo=new THREE.Mesh(new THREE.SphereGeometry(1.002,96,64),new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:atmosphere,side:THREE.FrontSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(halo);
  const outer=new THREE.Mesh(new THREE.SphereGeometry(1.009,96,64),new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:atmosphere,side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(outer);
  const outlines=[];const countries=feature(atlas,atlas.objects.countries);
  for(const f of countries.features){const polys=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const poly of polys)for(const ring of poly){for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i];if(Math.abs(a[0]-b[0])<180){outlines.push(...vec(a[1],a[0],1.003).toArray(),...vec(b[1],b[0],1.003).toArray());}}}}
  const outlineGeo=new THREE.BufferGeometry();outlineGeo.setAttribute('position',new THREE.Float32BufferAttribute(outlines,3));
  const countryLines=new THREE.LineSegments(outlineGeo,new THREE.LineBasicMaterial({color:0x98c0b3,transparent:true,opacity:.13}));countryLines.renderOrder=3;scene.add(countryLines);  const globalLayer=createGlobalAirLayer(scene);
  const weatherLayer=createWeatherLayer(scene);
  const unit=new THREE.Vector3(),eye=new THREE.Vector3(),screen=new THREE.Vector3(),homeDistance=()=>{
   const {homeScale,chromeInset}=props.current;if(homeScale)return homeDistanceForZoom(homeScale,camera.fov);
   // Short frames (zoomed-in desktop browsers, landscape phones) get a smaller globe so the header and bottom controls stay clear of it.
   const base=camera.aspect<.8?3.3:3.8;return chromeInset&&dimensions.w>700?Math.max(base,homeDistanceForZoom(Math.max(.5,1-chromeInset/dimensions.h),camera.fov)):base;
  };
  // Re-frame on resize (window zoom, rotation, ?zoom= framing) unless the user has zoomed away from home.
  let lastHome=0,reframe=false;
  let label=null,labelKey='',labelPosition3=null;
  function syncLabel(city){
   const place=city&&(places.find(c=>c.id===city.id)??city),key=place&&Number.isFinite(place.lat)&&Number.isFinite(place.lon)?`${place.id}|${place.lat}|${place.lon}`:'';
   if(key===labelKey)return;labelKey=key;label?.remove();label=null;labelPosition3=null;if(!key)return;
   const pin=document.createElement('span'),name=document.createElement('span');pin.className='pin';name.textContent=place.name;
   label=document.createElement('button');label.type='button';label.className='globe-label selected';label.append(pin,name);label.setAttribute('aria-label',`Explore ${place.name}`);label.onclick=()=>props.current.onCity?.(place);container.appendChild(label);labelPosition3=vec(place.lat,place.lon,1.042);
  }
  // The viewer's own position: a soft pulsing ring under the probe marker.
  const you=document.createElement('span');you.className='globe-you';you.setAttribute('aria-hidden','true');you.hidden=true;container.appendChild(you);
  let youKey='',youPosition3=null;
  function placeYou(){
   const loc=props.current.userLocation,key=loc?`${loc.lat}|${loc.lon}`:'';
   if(key!==youKey){youKey=key;youPosition3=loc?vec(loc.lat,loc.lon,1.003):null;}
   if(!youPosition3){you.hidden=true;return;}
   eye.copy(camera.position).normalize();screen.copy(youPosition3).project(camera);
   you.hidden=unit.copy(youPosition3).normalize().dot(eye)<=1/camera.position.length()+.005||Math.abs(screen.x)>1||Math.abs(screen.y)>1;
   you.style.transform=`translate(${(screen.x*.5+.5)*dimensions.w}px,${(-screen.y*.5+.5)*dimensions.h}px) translate(-50%,-50%)`;
  }
  let dimensions={w:1,h:1},shiftNow=Math.max(0,Math.min(.5,props.current.viewShift||0));
  const applyView=()=>{if(shiftNow<1e-4)camera.clearViewOffset();else camera.setViewOffset(dimensions.w,dimensions.h,shiftNow*dimensions.w,0,dimensions.w,dimensions.h);camera.updateProjectionMatrix();};
  const resize=()=>{reframe=true;dimensions={w:Math.max(1,container.clientWidth),h:Math.max(1,container.clientHeight)};renderer.setSize(dimensions.w,dimensions.h);camera.aspect=dimensions.w/dimensions.h;camera.fov=2*Math.atan(Math.tan(39*Math.PI/360)/Math.min(camera.aspect,1))*180/Math.PI;applyView();};const observer=new ResizeObserver(resize);observer.observe(container);resize();camera.position.setLength(homeDistance());
  const probe=createGlobeProbe({canvas:renderer.domElement,container,camera,onProbe:point=>props.current.onProbe?.(point),isEnabled:()=>props.current.probeEnabled});
  let lastFrames=null,frame,oldFocus=-1,oldZoom=-1,oldSurface='',oldReset=0,oldFly=props.current.flyTarget?.key,tween=null,lastElapsed=0,range={atMin:false,atMax:false};const timer=new THREE.Clock();const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function placeLabel(){
   if(!label)return;eye.copy(camera.position).normalize();const facing=unit.copy(labelPosition3).normalize().dot(eye);screen.copy(labelPosition3).project(camera);
   label.style.display=facing>1/camera.position.length()+.02&&Math.abs(screen.x)<.94&&Math.abs(screen.y)<.86?'':'none';
   label.style.transform=`translate(${(screen.x*.5+.5)*dimensions.w}px,${(-screen.y*.5+.5)*dimensions.h}px) translate(-13px,-50%)`;
  }
  const animate=()=>{frame=requestAnimationFrame(animate);const elapsed=timer.getElapsedTime(),dt=Math.min(.1,elapsed-lastElapsed);lastElapsed=elapsed;const p=props.current;
   if(oldSurface!==p.surface){
    oldSurface=p.surface;earth.material=surfaceMaterials[p.surface]??satelliteMaterial;
    countryLines.visible=p.surface!=='satellite';countryLines.material.color.set(p.surface==='white'?0x717b83:0x90908c);countryLines.material.opacity=p.surface==='white'?.24:.26;
    halo.visible=outer.visible=p.surface==='satellite';renderer.domElement.dataset.globeSurface=p.surface;
   }
   if(reframe&&!tween){reframe=false;const home=homeDistance();if(lastHome&&Math.abs(camera.position.length()-lastHome)<1e-3)camera.position.setLength(home);lastHome=home;}
   const shiftGoal=Math.max(0,Math.min(.5,p.viewShift||0));
   if(shiftNow!==shiftGoal){shiftNow=reduced||Math.abs(shiftGoal-shiftNow)<1e-4?shiftGoal:shiftNow+(shiftGoal-shiftNow)*(1-Math.exp(-dt/.15));applyView();}
   // Time bar: away from the snapshot hour the dots blend two forecast frames; while a frame loads the last pair stays up.
   const tl=p.timeline;tl?.tick(dt);
   if(!tl||tl.atSnapshot)lastFrames=null;else lastFrames=tl.frames()??lastFrames;
   globalLayer.update({data:p.globalAir,regional:p.regionalAir,frames:lastFrames,paint:p.paint,surface:p.surface,camera,width:dimensions.w,height:dimensions.h,pixelRatio:renderer.getPixelRatio(),onVisible:()=>{if(airDone.current)return;airDone.current=true;props.current.onAirVisible?.();},onDetail:detail=>{renderer.domElement.dataset.airDetail=detail;p.onDetail?.(detail);}});
   weatherLayer.update({data:p.weatherData,settings:p.weatherSettings,surface:p.surface,elapsed,reduced});
   syncLabel(p.city);
   const fly=p.flyTarget,flying=!!fly&&fly.key!==oldFly&&Number.isFinite(fly.lat)&&Number.isFinite(fly.lon);
   if(p.reset!==oldReset||p.focus!==oldFocus||p.zoom!==oldZoom||flying){probe.clear();const resetting=p.reset!==oldReset,first=oldFocus===-1,focusCity=p.city&&p.focus!==oldFocus;const flyDistance=THREE.MathUtils.clamp(fly?.distance??2.3,EARTH_MIN,EARTH_MAX);const distance=resetting?homeDistance():flying?flyDistance:focusCity?2.3:first?homeDistance():THREE.MathUtils.clamp((tween?.end.length()??camera.position.length())*Math.pow(.75,p.zoom-oldZoom),EARTH_MIN,EARTH_MAX);const target=resetting?vec(18,15,distance):flying?vec(THREE.MathUtils.clamp(fly.lat,-88,88),fly.lon,distance):focusCity?vec(p.city.lat,p.city.lon,distance):camera.position.clone().normalize().multiplyScalar(distance);tween={...cameraArc(camera.position,target),t:elapsed};if(flying&&fly.pin&&p.probeEnabled)probe.pinAt(vec(fly.lat,fly.lon),fly.pin);oldFocus=p.focus;oldZoom=p.zoom;oldReset=p.reset;}
   if(fly)oldFly=fly.key;
   if(tween){let t=Math.min(1,(elapsed-tween.t)/(reduced?.02:1.5));sampleCameraArc(tween,t,camera.position);if(t===1)tween=null;}
   controls.update();camera.updateMatrixWorld();probe.update({enabled:p.probeEnabled,reset:p.probeReset,time:elapsed});sun.position.copy(camera.position).applyAxisAngle(new THREE.Vector3(0,1,0),-.6).add(new THREE.Vector3(0,2,0));fill.position.copy(camera.position).negate();
   placeLabel();placeYou();
   const dist=camera.position.length(),atMin=dist<=EARTH_MIN+EPS,atMax=dist>=EARTH_MAX-EPS;if(atMin!==range.atMin||atMax!==range.atMax){range={atMin,atMax};p.onCameraRange?.({...range});}
   renderer.render(scene,camera);
  };animate();
  const cancelTween=()=>{tween=null;},wheelCancel=()=>{if(controls.enableZoom)tween=null;};renderer.domElement.addEventListener('pointerdown',cancelTween);renderer.domElement.addEventListener('wheel',wheelCancel,{passive:true});
  // Embedded: plain wheel scrolls the host page; Ctrl/Cmd + wheel (and trackpad pinch, sent as ctrl+wheel) zooms. Touch pinch is unaffected.
  const wheelGate=e=>{controls.enableZoom=!props.current.wheelModifier||e.ctrlKey||e.metaKey;},wheelRestore=()=>{controls.enableZoom=true;};container.addEventListener('wheel',wheelGate,{passive:true,capture:true});container.addEventListener('wheel',wheelRestore,{passive:true});const keyboard=e=>{if(e.target!==container)return;if(e.key==='Enter'&&props.current.probeEnabled){e.preventDefault();probe.inspectCentre();}if(e.key==='Escape'){e.preventDefault();probe.clear();}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key)){e.preventDefault();tween=null;probe.clear();const spherical=new THREE.Spherical().setFromVector3(camera.position);if(e.key==='ArrowLeft')spherical.theta-=.09;if(e.key==='ArrowRight')spherical.theta+=.09;if(e.key==='ArrowUp')spherical.phi=Math.max(.12,spherical.phi-.07);if(e.key==='ArrowDown')spherical.phi=Math.min(Math.PI-.12,spherical.phi+.07);if(e.key==='+')spherical.radius=Math.max(EARTH_MIN,spherical.radius*.9);if(e.key==='-')spherical.radius=Math.min(EARTH_MAX,spherical.radius*1.1);camera.position.setFromSpherical(spherical);}};container.addEventListener('keydown',keyboard);
  return()=>{disposed=true;Object.values(surfaceMaterials).forEach(m=>{if(m!==earth.material)m.dispose();});textures.forEach(t=>t.dispose());cancelAnimationFrame(frame);container.removeEventListener('keydown',keyboard);observer.disconnect();renderer.domElement.removeEventListener('pointerdown',cancelTween);renderer.domElement.removeEventListener('wheel',wheelCancel);container.removeEventListener('wheel',wheelGate,{capture:true});container.removeEventListener('wheel',wheelRestore);probe.dispose();controls.dispose();globalLayer.dispose();weatherLayer.dispose();label?.remove();you.remove();scene.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});renderer.dispose();renderer.domElement.remove();};
 },[]);
 return <div ref={host} className="globe-host" onPointerDown={e=>{if(e.button===0||e.pointerType==='touch')onInteraction?.();}} onWheel={onInteraction} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Enter'].includes(e.key))onInteraction?.();}} tabIndex={0} role="region" aria-label={`Interactive Earth. Drag or use arrow keys to rotate. ${wheelModifier?'Hold Control or Command and scroll, pinch, or use plus and minus to zoom.':'Scroll or use plus and minus to zoom.'}${readout?' Hover to inspect air composition, click or tap to keep it. Press Enter to inspect the centre, Escape to dismiss.':''}`}>{error&&<div className="webgl-error" role="alert">The 3D globe needs WebGL, which is unavailable or disabled in this browser. Try a browser with graphics acceleration enabled, or open the page on another device.</div>}</div>;
}
