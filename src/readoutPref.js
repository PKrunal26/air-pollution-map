export const READOUT_KEY='air-atlas.readout';
export function loadReadout(){try{return localStorage.getItem(READOUT_KEY)!=='off';}catch{return true;}}
export function saveReadout(on){try{localStorage.setItem(READOUT_KEY,on?'on':'off');}catch{}}
