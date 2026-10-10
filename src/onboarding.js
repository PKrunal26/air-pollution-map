// First visit only: a short layer picker. Remembered per browser; storage failures fall back to "already seen" so the
// picker never nags in private windows that block storage.
export const ONBOARDED_KEY='air-atlas.onboarded';
export function loadOnboarded(){try{return localStorage.getItem(ONBOARDED_KEY)==='1';}catch{return true;}}
export function saveOnboarded(){try{localStorage.setItem(ONBOARDED_KEY,'1');}catch{}}
// The common pollutants offered on first visit, with a plain one-line hint each.
export const PICKER_LAYERS=[
 ['pm2_5','Smoke, traffic and industry'],
 ['dust','Desert dust carried on the wind'],
 ['nitrogen_dioxide','Traffic and power plants'],
 ['ozone','Forms in sunlight; higher in summer'],
 ['pm10','Coarser particles, including dust'],
 ['carbon_monoxide','Fires and incomplete burning'],
 ['sulphur_dioxide','Coal, volcanoes and shipping'],
];
