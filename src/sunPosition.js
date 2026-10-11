// Subsolar point (where the sun is overhead) for a UTC time in ms. Low-precision solar ephemeris, good to ~0.1°.
const DEG=Math.PI/180;
export function subsolarPoint(ms){
 const d=ms/86400000-10957.5; // days since J2000.0
 const g=(357.529+.98560028*d)*DEG,q=280.459+.98564736*d;
 const L=(q+1.915*Math.sin(g)+.020*Math.sin(2*g))*DEG,e=(23.439-.00000036*d)*DEG;
 const ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L))/DEG,dec=Math.asin(Math.sin(e)*Math.sin(L))/DEG;
 const gmst=(18.697374558+24.06570982441908*d)*15;
 const lon=((ra-gmst)%360+540)%360-180;
 return {lat:dec,lon};
}
// Sublunar point (where the moon is overhead) for a UTC time in ms. Low-precision lunar theory, good to ~1°.
export function sublunarPoint(ms){
 const d=ms/86400000-10957.5;
 const L=218.316+13.176396*d,M=(134.963+13.064993*d)*DEG,F=(93.272+13.22935*d)*DEG;
 const lam=(L+6.289*Math.sin(M))*DEG,beta=5.128*Math.sin(F)*DEG,e=(23.439-.00000036*d)*DEG;
 const ra=Math.atan2(Math.sin(lam)*Math.cos(e)-Math.tan(beta)*Math.sin(e),Math.cos(lam))/DEG;
 const dec=Math.asin(Math.sin(beta)*Math.cos(e)+Math.cos(beta)*Math.sin(e)*Math.sin(lam))/DEG;
 const gmst=(18.697374558+24.06570982441908*d)*15;
 return {lat:dec,lon:((ra-gmst)%360+540)%360-180};
}
// Display time (ms) of a timeline position: interpolated between frame times; null in history (monthly means).
export function timelineTime(timeline,snapshotAt){
 if(!timeline)return snapshotAt??null;
 if(timeline.kind==='history')return null;
 const frames=timeline.manifest.frames,p=timeline.position,i=Math.min(frames.length-2,Math.floor(p)),t=p-i;
 if(timeline.atSnapshot)return snapshotAt??frames[timeline.manifest.snapshotIndex]?.validAt??null;
 if(frames.length<2)return frames[0]?.validAt??null;
 return frames[i].validAt+(frames[i+1].validAt-frames[i].validAt)*t;
}
