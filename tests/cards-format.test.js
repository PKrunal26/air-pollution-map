import test from 'node:test';
import assert from 'node:assert/strict';
import {monthLabel,formatStats,foundLabel} from '../src/cards/format.js';

test('one month',()=>{
 assert.equal(monthLabel(['2023-06']),'June 2023');
});
test('same month every year',()=>{
 assert.equal(monthLabel(['2022-11','2023-11','2024-11','2025-11']),'Every November');
});
test('consecutive months in one year',()=>{
 assert.equal(monthLabel(['2026-09','2026-10']),'September – October 2026');
});
test('months across a year end',()=>{
 assert.equal(monthLabel(['2023-12','2024-01']),'December 2023 – January 2024');
});
test('stats formatted for the card front',()=>{
 const stats={peak:{value:659},whoX:{value:2.9},areaKm2:{value:1625000},reachKm:{value:1965}};
 assert.deepEqual(formatStats(stats),[
  {label:'Peak',value:'659',unit:'µg/m³'},{label:'× WHO',value:'2.9×',unit:''},
  {label:'Area',value:'1.6M',unit:'km²'},{label:'Reach',value:'1,965',unit:'km'}]);
});
test('small areas in thousands, missing WHO as a dash',()=>{
 const f=formatStats({peak:{value:136.8},whoX:{value:null},areaKm2:{value:589000},reachKm:{value:1581}});
 assert.equal(f[0].value,'137');assert.equal(f[1].value,'–');assert.equal(f[2].value,'589k');
});
test('found date',()=>{
 assert.equal(foundLabel(Date.UTC(2026,9,16,12)),'Found 16 Oct 2026');
 assert.equal(foundLabel(null),null);
});
