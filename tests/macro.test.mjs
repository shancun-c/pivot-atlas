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

import {macroStudy,macroBreakdown,macroComparison} from '../public/macro.mjs';
const quotes=()=>new Map(['ndx','spx','hg','gc'].map((id,j)=>[id,{status:'ok',asOf:'2026-09-04',history:[{date:'2026-09-02',close:100+j},{date:'2026-09-03',close:110+j}]}]));
test('common mode intersects all six dates and normalizes each ratio at the shared start',()=>{
 const t={nominal,real:{...real,history:[{date:'2026-09-02',TC_10YEAR:-.3},{date:'2026-09-03',TC_10YEAR:-.2}]}};
 const all=macroStudy(t,quotes(),90,true);
 for(const r of all){assert.equal(r.error,undefined);assert.deepEqual(r.dates,['2026-09-02','2026-09-03']);if(r.ratio)assert.equal(r.values[0],100)}
 assert.equal(macroStudy(t,quotes(),90,false)[0].dates[0],'2026-09-01');
 const q=quotes();q.get('gc').status='stale';assert.ok(macroStudy(t,q,90,true).every(r=>r.error));assert.equal(macroStudy(t,q,90,false)[0].error,undefined);
});
test('one common date blocks shared mode without inventing observations',()=>{assert.ok(macroStudy({nominal,real},quotes(),90,true).every(r=>r.error))});
test('curve and inflation decomposition reconcile with negative rates and signed changes',()=>{
 const s=macroBreakdown(calc('slope')),b=macroBreakdown(calc('breakeven'));
 assert.ok(Math.abs(s.values[1]-s.values[0]-s.values[2])<1e-8);
 assert.ok(Math.abs(b.values[0]+b.values[1]-b.values[2])<1e-8);
});
test('ratio decomposition uses multiplicative returns and comparison preserves exact endpoints',()=>{
 const q=quotes();q.get('spx').history[1].close=90;
 const r=calc('growth',{},q),b=macroBreakdown(r);
 assert.ok(Math.abs(((1+b.values[0]/100)/(1+b.values[1]/100)-1)*100-b.values[2])<1e-8);
 assert.ok(b.values[1]<0);assert.deepEqual(macroComparison(r).range,{start:'2026-09-02',end:'2026-09-03'});
 assert.deepEqual(macroComparison(r).selection,['ndx','spx']);assert.equal(macroComparison({...r,error:'bad'}),null);
});
