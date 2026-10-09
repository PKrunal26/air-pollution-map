export function parseGlobalAir(payload) {
 const g=payload?.grid;
 if(payload?.schema!==1||payload.pollutant!=='pm2_5'||payload.unit!=='μg/m³'||payload.domain!=='cams_global'||payload.kind!=='modeled'||!Number.isFinite(payload.validAt)||payload.validAt<=0||g?.width!==72||g.height!==37||g.step!==5||g.latStart!==-90||g.lonStart!==-180||g.order!=='south-to-north, west-to-east'||!Array.isArray(payload.values)||payload.values.length!==g.width*g.height||payload.values.some(v=>!Number.isFinite(v)||v<0||v>6553.5))throw new Error('Invalid global PM₂.₅ grid');
 return payload;
}

// Used to compare against exact city API readings; interpolation is only visual.
export function sampleGlobalAir(data,lat,lon) {
 const {width,height,step}=data.grid;
 const x=(((lon+180)/step)%width+width)%width,y=Math.max(0,Math.min(height-1,(lat+90)/step));
 const x0=Math.floor(x),y0=Math.floor(y),x1=(x0+1)%width,y1=Math.min(y0+1,height-1),fx=x-x0,fy=y-y0;
 const v=(x,y)=>data.values[y*width+x];
 return (v(x0,y0)*(1-fx)+v(x1,y0)*fx)*(1-fy)+(v(x0,y1)*(1-fx)+v(x1,y1)*fx)*fy;
}
