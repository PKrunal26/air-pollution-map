// Counts a named action through public/count.js (GoatCounter). A no-op when counting is off or the script is missing.
export function track(name){try{globalThis.window?.atlasCount?.(name);}catch{}}
