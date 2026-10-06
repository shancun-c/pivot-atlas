import test from 'node:test';import assert from 'node:assert/strict';import {compareAssets,correlation} from '../public/comparison.mjs';
const assets=[{id:'a',name:'Price',unit:'USD'},{id:'b',name:'Yield',unit:'%'}];
const rec=bars=>({status:'ok',asOf:'2026-10-01',history:bars});
const bar=(date,close)=>({date,close});
test('common dates only, separate normalization and bp, no forward fill',()=>{
 const records=new Map([['a',rec([bar('2026-09-01',100),bar('2026-09-02',105),bar('2026-09-03',110)])],['b',rec([bar('2026-09-01',4),bar('2026-09-03',4.2),bar('2026-10-01',9)])]]);
 const r=compareAssets(assets,records);assert.deepEqual(r.dates,['2026-09-01','2026-09-03']);assert.ok(Math.abs(r.lines[0].values[1]-110)<1e-9);assert.ok(Math.abs(r.lines[1].values[1]-20)<1e-9);assert.equal(r.lines[0].excluded,1);assert.equal(r.pairs[0].value,null);
});
test('correlation needs twenty aligned intervals and variation',()=>{const x=Array.from({length:20},(_,i)=>i);assert.equal(correlation(x,x),1);assert.equal(correlation(x,x.map(v=>-v)),-1);assert.equal(correlation(x.slice(1),x.slice(1)),null);assert.equal(correlation(x,x.map(()=>1)),null)});
test('unavailable source blocks entire comparison; duplicate selections rejected',()=>{assert.match(compareAssets(assets,new Map()).error,/等待/);assert.match(compareAssets([assets[0],assets[0]],new Map()).error,/不同/)});
test('calendar window and common end do not include unmatched last observations',()=>{const records=new Map([['a',rec([bar('2026-08-01',100),bar('2026-09-01',105),bar('2026-09-02',110),bar('2026-09-03',115)])],['b',rec([bar('2026-08-01',4),bar('2026-09-01',4.1),bar('2026-09-02',4.2)])]]);const r=compareAssets(assets,records,30);assert.deepEqual(r.dates,['2026-09-01','2026-09-02']);assert.equal(r.lines[0].latest,'2026-09-03')});
