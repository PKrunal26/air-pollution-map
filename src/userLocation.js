// The viewer's position from the browser. Asked only when they press "My location"; if they granted it on an earlier
// visit the marker returns quietly on load (no prompt, no camera move).
const OPTIONS={enableHighAccuracy:false,timeout:12000,maximumAge:10*60*1000};

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
  },error=>reject({code:error?.code??2}),OPTIONS);
 });
}

// True only when permission was already granted, so checking never triggers a prompt.
export async function locationGranted(permissions=globalThis.navigator?.permissions){
 try{return (await permissions?.query({name:'geolocation'}))?.state==='granted';}catch{return false;}
}
