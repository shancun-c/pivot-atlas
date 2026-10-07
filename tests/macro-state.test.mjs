import test from 'node:test';import assert from 'node:assert/strict';
import {restoreMacroState,resolveMacroDate} from '../public/macro-state.mjs';
import {macroStudy,macroIndicator,indicators} from '../public/macro.mjs';
test('restores valid research context and filters invalid or unknown dates',()=>{
 const r=restoreMacroState({version:1,group:'跨资产相对强弱',days:365,mode:'independent',date:'2026-07-08',dates:{growth:'2026-07-08',real:'2026-02-30',unknown:'2026-07-08'}});
 assert.equal(r.group,'跨资产相对强弱');assert.equal(r.days,365);assert.equal(r.mode,'independent');assert.equal(r.date,'2026-07-08');assert.deepEqual(r.dates,{growth:'2026-07-08'});
});
test('corrupted version and invalid controls return safe defaults',()=>{
 for(const value of [null,3,{version:9},{version:1,days:999,group:'bad',mode:'bad',date:'bad'}]){const r=restoreMacroState(value);assert.equal(r.days,90);assert.equal(r.mode,'common');assert.equal(r.date,null)}
});
test('shared research date resolves consistently on mode switch, missing date and shorter window',()=>{
 const dates=['2026-07-08','2026-07-10','2026-07-13'];
 assert.deepEqual(resolveMacroDate(dates,'2026-07-10'),{date:'2026-07-10',adjusted:false});
 assert.deepEqual(resolveMacroDate(dates,'2026-06-01'),{date:'2026-07-08',adjusted:true});
 assert.deepEqual(resolveMacroDate(dates,'2026-07-12'),{date:'2026-07-13',adjusted:true});
 assert.equal(resolveMacroDate(dates,null).date,'2026-07-13');assert.equal(resolveMacroDate([],null).date,null);
});
test('availability distinguishes loading, source failures and insufficient history',()=>{
 assert.ok(macroStudy(null,new Map()).every(r=>r.errorKind==='loading'));
 const source={nominal:{status:'error',error:'offline'}};assert.ok(macroStudy(source,new Map()).every(r=>r.errorKind==='source'));
 const one={nominal:{status:'ok',history:[{date:'2026-07-08',BC_2YEAR:4}]}};
 assert.equal(macroIndicator(indicators[0],one,new Map()).errorKind,'history');
});
