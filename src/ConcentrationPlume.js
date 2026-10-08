import * as THREE from 'three';

// The glyph is deliberately magnified. Only opacity responds to PM2.5;
// its envelope, height and motion do not describe transport or plume extent.
export function createConcentrationPlume(scene) {
 const count=110;
 const geometry=new THREE.BufferGeometry();
 const positions=new Float32Array(count*3),sizes=new Float32Array(count),phases=new Float32Array(count),weights=new Float32Array(count);
 let seed=3981;
 const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 const samples=Array.from({length:count},(_,i)=>{
  const t=i/(count-1);
  const spread=(random()+random()+random()-1.5)*(.018+.075*t);
  sizes[i]=(.085+random()*.13)*(1-.30*t);
  phases[i]=random()*30;
  weights[i]=.55+.45*Math.sin(Math.PI*t);
  return {t,spread,lift:random()*.055};
 });
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
 geometry.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
 geometry.setAttribute('aWeight',new THREE.BufferAttribute(weights,1));
 const material=new THREE.ShaderMaterial({
  uniforms:{time:{value:0},strength:{value:0},height:{value:1000}},
  vertexShader:`attribute float aSize;attribute float aPhase;attribute float aWeight;uniform float time;uniform float height;varying float phase;varying float weight;
  void main(){phase=aPhase;weight=aWeight;vec3 p=position*(1.+sin(time*.19+aPhase)*.003);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(350.,aSize*height*1.35/max(.2,-mv.z));}`,
  fragmentShader:`uniform float time;uniform float strength;varying float phase;varying float weight;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
  float fbm(vec2 p){return noise(p)*.54+noise(p*2.03)*.27+noise(p*4.07)*.13+noise(p*8.13)*.06;}
  void main(){vec2 uv=gl_PointCoord-.5;float r=length(uv);if(r>.5)discard;
   vec2 p=uv*4.5+vec2(phase,time*.035);p+=vec2(fbm(p*.7),fbm(p*.7+6.))*1.7;
   float n=fbm(p);float envelope=1.-smoothstep(.12,.5,r);
   float density=smoothstep(.18,.79,n)*envelope*weight;
   vec3 ash=vec3(.10,.13,.15);vec3 light=vec3(.64,.62,.55);
   vec3 color=mix(ash,light,smoothstep(.20,.76,n));
   gl_FragColor=vec4(color,density*strength);
  }`,
  transparent:true,depthWrite:false,depthTest:true,blending:THREE.NormalBlending,
 });
 const plume=new THREE.Points(geometry,material);
 plume.frustumCulled=false;plume.renderOrder=2;plume.visible=false;scene.add(plume);
 let location='';
 return {
  update({city,data,elapsed,reduced,height}) {
   const value=data?.pm25;
   plume.visible=typeof value==='number'&&Number.isFinite(value)&&value>0;
   if(!plume.visible)return;
   const key=`${city.lat},${city.lon}`;
   if(location!==key){
    location=key;
    const lat=city.lat*Math.PI/180,lon=city.lon*Math.PI/180;
    const up=new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),-Math.cos(lat)*Math.sin(lon));
    const east=new THREE.Vector3(-Math.sin(lon),0,-Math.cos(lon));
    const north=new THREE.Vector3().crossVectors(up,east);
    const direction=east.clone().multiplyScalar(.72).addScaledVector(north,.69).normalize();
    const side=new THREE.Vector3().crossVectors(up,direction).normalize();
    samples.forEach(({t,spread,lift},i)=>{
     const curl=Math.sin(t*Math.PI*2.1)*(.02+t*.045);
     const point=up.clone().addScaledVector(direction,t*.42-.025).addScaledVector(side,spread+curl).normalize().multiplyScalar(1.013+Math.sin(t*Math.PI)*.10+lift);
     positions.set(point.toArray(),i*3);
    });
    geometry.attributes.position.needsUpdate=true;
   }
   material.uniforms.time.value=reduced?0:elapsed;
   material.uniforms.height.value=height;
   // Smooth bounded visual mapping. No concentration thresholds or health categories.
   material.uniforms.strength.value=(1-Math.exp(-value/35))*.86;
  },
  dispose(){scene.remove(plume);geometry.dispose();material.dispose();},
 };
}
