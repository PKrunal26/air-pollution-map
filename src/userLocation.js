// The viewer's position from the browser, asked only when they press "My location". Allowed earlier: the marker
// returns quietly on open. On open the globe also turns to the viewer's rough region from their IP (see guessRegion).
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

// Rough region from the IP address, with no permission prompt. City level on home wifi, often a few hundred km off on
// mobile data or behind a VPN, so it only turns the globe and never places a marker. Sends the viewer's IP to GeoJS.
export const REGION_URL='https://get.geojs.io/v1/ip/geo.json';
export async function guessRegion(fetchImpl=globalThis.fetch,signal){
 try{
  const res=await fetchImpl(REGION_URL,{signal});if(!res.ok)return null;
  const data=await res.json(),lat=Number(data?.latitude),lon=Number(data?.longitude);
  if(data?.latitude==null||data?.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
  return {lat,lon};
 }catch{return null;}
}

// Where the overview button returns to: the viewer's exact spot if they shared it, otherwise their IP region,
// otherwise the default view over Africa and Europe.
export const HOME_FALLBACK={lat:18,lon:15};
export const homePoint=(exact,region)=>{const p=exact??region;return p?{lat:p.lat,lon:p.lon}:HOME_FALLBACK;};
