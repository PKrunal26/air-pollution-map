// The viewer's position from the browser. First visit: asked once when the site opens. Allowed earlier: the marker
// returns quietly (no camera move). Refused: never asked again unless they press "My location".
// maximumAge 0: never reuse a cached fix, or someone who has moved (or a laptop that woke elsewhere) sees the old place.
export const LOCATE_OPTIONS={enableHighAccuracy:false,timeout:12000,maximumAge:0};

export function locationMessage(error){
 if(!error)return '';
 if(error.code===1)return 'Location is blocked. Allow it for this site in your browser settings.';
 if(error.code===3)return 'Finding your location took too long. Try again.';
 if(error.code==='unsupported')return 'This browser cannot share its location.';
 return 'Your location is unavailable right now. Try again.';
}

export function locateUser(geo=globalThis.navigator?.geolocation){
 return new Promise((resolve,reject)=>{
  if(!geo?.getCurrentPosition){reject({code:'unsupported'});return;}
  geo.getCurrentPosition(({coords})=>{
   const lat=coords.latitude,lon=coords.longitude;
   if(!Number.isFinite(lat)||!Number.isFinite(lon)){reject({code:2});return;}
   resolve({lat,lon,accuracy:Number.isFinite(coords.accuracy)?coords.accuracy:null});
  },error=>reject({code:error?.code??2}),LOCATE_OPTIONS);
 });
}

// 'granted' | 'denied' | 'prompt', or 'unknown' where the browser cannot say. Checking never triggers a prompt.
export async function locationPermission(permissions=globalThis.navigator?.permissions){
 try{const state=(await permissions?.query({name:'geolocation'}))?.state;return ['granted','denied','prompt'].includes(state)?state:'unknown';}catch{return 'unknown';}
}

// Ask on open only if the browser has never been asked; 'unknown' (no Permissions API) falls back to our own note.
export const ASKED_KEY='air-atlas.location-asked';
export function shouldAskOnOpen(state,storage=globalThis.localStorage){
 if(state==='prompt')return true;
 if(state!=='unknown')return false;
 try{return storage?.getItem(ASKED_KEY)!=='1';}catch{return false;}
}
export function saveAsked(storage=globalThis.localStorage){try{storage?.setItem(ASKED_KEY,'1');}catch{}}
