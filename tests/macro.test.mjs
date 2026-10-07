import test from 'node:test';import assert from 'node:assert/strict';
import {indicators,macroIndicator} from '../public/macro.mjs';
const nominal={status:'ok',history:[{date:'2026-09-01',BC_2YEAR:4,BC_10YEAR:3.5},{date:'2026-09-02',BC_2YEAR:4.1,BC_10YEAR:3.8},{date:'2026-09-03',BC_2YEAR:4.2,BC_10YEAR:4}]};
const real={status:'ok',history:[{date:'2026-09-01',TC_10YEAR:-.5},{date:'2026-09-03',TC_10YEAR:-.2}]};
const calc=(id,t={nominal,real},r=new Map())=>macroIndicator(indicators.find(i=>i.id===id),t,r,90);
test('curve spread uses bp including inversion; rates change in bp',()=>{const r=calc('slope');assert.ok(Math.abs(r.latest+20)<1e-8);assert.ok(Math.abs(r.delta-30)<1e-8);assert.equal(calc('short').latest,4.2);assert.ok(Math.abs(calc('short').delta-20)<1e-8)});
test('breakeven uses same-day intersection and permits negative real rates',()=>{const r=calc('breakeven');assert.deepEqual(r.dates,['2026-09-01','2026-09-03']);assert.equal(r.latest,4.2);assert.ok(Math.abs(r.delta-20)<1e-8);assert.deepEqual(r.omitted,[1,0]);assert.equal(calc('real').latest,-.2)});
test('failed real source does not block nominal-only indicators',()=>{const t={nominal,real:{...real,status:'stale'}};assert.ok(calc('breakeven',t).error);assert.equal(calc('slope',t).error,undefined)});
test('ratio only intersects closed bars, normalizes and rejects zero denominators',()=>{
 const quote=values=>({status:'ok',asOf:'2026-09-03',history:values.map((close,i)=>({date:`2026-09-0${i+1}`,close}))});
 const r=new Map([['ndx',quote([100,120,999])],['spx',quote([50,50,1])]]);
 const result=calc('growth',{},r);assert.deepEqual(result.values,[100,120]);assert.ok(Math.abs(result.delta-20)<1e-8);assert.equal(result.dates.at(-1),'2026-09-02');
 r.set('spx',quote([50,0,1]));assert.ok(calc('growth',{},r).error);
});
test('one observation and malformed input do not produce charts',()=>{assert.ok(calc('short',{nominal:{...nominal,history:nominal.history.slice(0,1)}}).error);assert.ok(calc('short',{nominal:{...nominal,history:[...nominal.history,nominal.history[0]]}}).error);assert.ok(calc('short',{nominal:{...nominal,history:[{date:'2026-09-01',BC_2YEAR:NaN}]}}).error)});
