import test from 'node:test';
import assert from 'node:assert/strict';
import {pointToLocation,sampleAirAt,formatAirValue,WHO_GUIDELINES,whoComparison,whoTone,formatWhoRatio} from '../src/airProbe.js';

const grid={width:2,height:2,step:1,latStart:0,lonStart:0};
const global={domain:'cams_global',validAt:1000,grid,fields:{pm2_5:[10,20,30,40],ozone:[0,0,0,0],uv_index:[1,2,3,4]}};
const regional={domain:'cams_europe',validAt:1000,grid,fields:{pm2_5:[2,4,6,8],grass_pollen:[0,0,0,0]}};
const row=(sample,id)=>sample.fields.find(field=>field.id===id);

test('globe hit coordinates follow the renderer orientation, including poles and the date line',()=>{
 assert.deepEqual(pointToLocation({x:1,y:0,z:0}),{lat:0,lon:-0});
 assert.equal(pointToLocation({x:0,y:1,z:0}).lat,90);
 assert.equal(pointToLocation({x:0,y:0,z:-1}).lon,90);
 assert.equal(Math.abs(pointToLocation({x:-1,y:0,z:0}).lon),180);
 assert.equal(pointToLocation({x:0,y:0,z:0}),null);
});
test('hover interpolates native values, keeps zeroes and reports each field with its own units',()=>{
 const sample=sampleAirAt(global,regional,.5,.5);
 assert.equal(row(sample,'pm2_5').value,5);
 assert.equal(row(sample,'pm2_5').source,'cams_europe');
 assert.equal(row(sample,'pm2_5').unit,'μg/m³');
 assert.equal(row(sample,'uv_index').value,2.5);
 assert.equal(row(sample,'uv_index').source,'cams_global');
 assert.equal(row(sample,'grass_pollen').value,0);
 assert.equal(row(sample,'grass_pollen').unit,'grains/m³');
 assert.equal(row(sample,'ozone').value,0);
});
test('Europe-only values never leak beyond their coverage or across mismatched snapshots',()=>{
 const outside=sampleAirAt(global,regional,-.01,.5);
 assert.equal(outside.regional,false);
 assert.equal(row(outside,'grass_pollen'),undefined);
 assert.equal(row(outside,'pm2_5').value,15);
 const otherTime=sampleAirAt(global,{...regional,validAt:2000},.5,.5);
 assert.equal(otherTime.regional,false);
 assert.equal(row(otherTime,'pm2_5').value,25);
 assert.equal(row(otherTime,'grass_pollen'),undefined);
});
test('missing data and invalid coordinates are unavailable, and tiny positive values are not zero',()=>{
 assert.equal(sampleAirAt(null,null,0,0),null);
 assert.equal(sampleAirAt(global,regional,91,0),null);
 assert.equal(sampleAirAt(global,regional,0,NaN),null);
 assert.equal(sampleAirAt(null,regional,-1,0),null);
 assert.equal(formatAirValue(.001),'<0.01');
 assert.equal(formatAirValue(0),'0');
});
test('WHO 2021 guideline table and comparison tones',()=>{
 assert.deepEqual(Object.fromEntries(Object.entries(WHO_GUIDELINES).map(([id,g])=>[id,g.level])),{pm2_5:15,pm10:45,nitrogen_dioxide:25,ozone:100,sulphur_dioxide:40,carbon_monoxide:4000});
 assert.equal(WHO_GUIDELINES.ozone.basis,'8-h');
 const high=whoComparison('pm2_5',24);
 assert.equal(high.text,'×1.6');assert.equal(high.tone,'warn');assert.equal(high.label,'WHO 24-h');
 assert.equal(whoComparison('pm2_5',15).tone,'ok');
 assert.equal(whoComparison('pm2_5',30).tone,'warn');
 assert.equal(whoComparison('pm2_5',30.1).tone,'high');
 assert.equal(whoComparison('carbon_monoxide',8000).text,'×2.0');
 assert.equal(whoComparison('pm2_5',0).text,'×0.0');
 assert.equal(whoComparison('pm2_5',.1).text,'×<0.1');
 assert.equal(whoComparison('pm2_5',300).text,'×20');
 assert.equal(whoTone(2),'warn');assert.equal(whoTone(2.01),'high');assert.equal(formatWhoRatio(.04),'<0.1');
});
test('no WHO comparison for fields without a guideline, other units or invalid values',()=>{
 assert.equal(whoComparison('dust',50),null);
 assert.equal(whoComparison('uv_index',5,''),null);
 assert.equal(whoComparison('pm2_5',NaN),null);
 assert.equal(whoComparison('pm2_5',-1),null);
 assert.equal(whoComparison('pm2_5',10,'mg/m³'),null);
});
