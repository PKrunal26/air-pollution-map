import {MathUtils,Quaternion} from 'three';

// Follow an arc while interpolating distance, keeping the camera outside Earth.
export function cameraArc(start,end){
 return {start:start.clone(),end:end.clone(),rotation:new Quaternion().setFromUnitVectors(start.clone().normalize(),end.clone().normalize())};
}

export function sampleCameraArc(arc,progress,target){
 const eased=1-Math.pow(1-MathUtils.clamp(progress,0,1),4);
 const rotation=new Quaternion().slerp(arc.rotation,eased);
 return target.copy(arc.start).normalize().applyQuaternion(rotation).multiplyScalar(MathUtils.lerp(arc.start.length(),arc.end.length(),eased));
}
