import * as THREE from 'three';

// One continuous volume. Only density uses the concentration; the enlarged
// shape and its drift are artistic, not a dispersion or wind simulation.
export function createConcentrationPlume(scene) {
 const size=64, bytes=new Uint8Array(size**3);
 let seed=3981;
 for(let i=0;i<bytes.length;i++){seed=(seed*16807)%2147483647;bytes[i]=255*(seed-1)/2147483646;}
 const noise=new THREE.Data3DTexture(bytes,size,size,size);
 noise.format=THREE.RedFormat;noise.minFilter=noise.magFilter=THREE.LinearFilter;
 noise.wrapS=noise.wrapT=noise.wrapR=THREE.RepeatWrapping;noise.unpackAlignment=1;noise.needsUpdate=true;
 const geometry=new THREE.BoxGeometry(1,1,1);
 const material=new THREE.ShaderMaterial({
  glslVersion:THREE.GLSL3,
  uniforms:{noiseMap:{value:noise},time:{value:0},strength:{value:0},cameraLocal:{value:new THREE.Vector3()},volumeMatrix:{value:new THREE.Matrix4()}},
  vertexShader:`out vec3 localPoint;out vec3 worldPoint;
  void main(){localPoint=position;worldPoint=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(worldPoint,1.);}`,
  fragmentShader:`precision highp sampler3D;
  uniform sampler3D noiseMap;uniform float time;uniform float strength;uniform vec3 cameraLocal;uniform mat4 volumeMatrix;
  in vec3 localPoint;in vec3 worldPoint;out vec4 result;
  float field(vec3 p){
   float t=p.z+.5;
   float cx=sin(t*5.8+time*.07)*(.035+.085*t);
   float cy=-.30+sin(t*2.4)*.27;
   vec2 q=(p.xy-vec2(cx,cy))/vec2(.065+.24*t,.075+.18*t);
   float envelope=exp(-dot(q,q)*2.2)*smoothstep(0.,.08,t)*(1.-smoothstep(.66,1.,t));
   vec3 n=p*1.5+vec3(time*.003,0.,-time*.006);
   float billow=texture(noiseMap,n*.13).r*.56+texture(noiseMap,n*.27+2.).r*.29+texture(noiseMap,n*.55+4.).r*.15;
   return envelope*smoothstep(.20,.66,billow);
  }
  void main(){
   vec3 ray=normalize(localPoint-cameraLocal);
   vec3 a=(-.5-cameraLocal)/ray,b=(.5-cameraLocal)/ray;
   vec3 lo=min(a,b),hi=max(a,b);
   float start=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(hi.x,min(hi.y,hi.z));
   if(end<=start)discard;
   vec3 worldRay=normalize(worldPoint-cameraPosition);
   float projection=dot(cameraPosition,worldRay);
   float disc=projection*projection-dot(cameraPosition,cameraPosition)+1.006;
   float earthHit=1e6;
   if(disc>0.){float hit=-projection-sqrt(disc);if(hit>0.)earthHit=hit;}
   float stepSize=(end-start)/48.;vec4 cloud=vec4(0.);
   for(int i=0;i<48;i++){
    vec3 p=cameraLocal+ray*(start+(float(i)+.5)*stepSize);
    vec3 world=(volumeMatrix*vec4(p,1.)).xyz;
    if(distance(world,cameraPosition)>earthHit)break;
    if(length(world)<1.004)continue;
    float d=field(p);
    float alpha=1.-exp(-d*strength*stepSize*24.);
    float lighting=clamp(.64+(d-field(p+vec3(-.035,.055,.015)))*2.8,0.,1.);
    vec3 shade=mix(vec3(.18,.21,.23),vec3(.78,.76,.69),lighting);
    cloud.rgb+=(1.-cloud.a)*shade*alpha;cloud.a+=(1.-cloud.a)*alpha;
    if(cloud.a>.96)break;
   }
   if(cloud.a<.003)discard;
   result=vec4(cloud.rgb/cloud.a,cloud.a);
  }`,
  side:THREE.BackSide,transparent:true,depthWrite:false,depthTest:false,
 });
 const plume=new THREE.Mesh(geometry,material);plume.renderOrder=3;plume.visible=false;scene.add(plume);
 const cameraLocal=new THREE.Vector3();let location='';
 return {
  update({city,data,elapsed,reduced,camera}) {
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
    const direction=east.multiplyScalar(.72).addScaledVector(north,.69).normalize();
    const side=new THREE.Vector3().crossVectors(up,direction).normalize();
    plume.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,up,direction));
    plume.scale.set(.24,.24,.44);
    plume.position.copy(up).multiplyScalar(1.081).addScaledVector(direction,.205);
   }
   plume.updateMatrixWorld(true);
   material.uniforms.cameraLocal.value.copy(plume.worldToLocal(cameraLocal.copy(camera.position)));
   material.uniforms.volumeMatrix.value.copy(plume.matrixWorld);
   material.uniforms.time.value=reduced?0:elapsed;
   material.uniforms.strength.value=(1-Math.exp(-value/35))*1.45;
  },
  dispose(){scene.remove(plume);geometry.dispose();material.dispose();noise.dispose();},
 };
}
