import test from 'node:test';import assert from 'node:assert/strict';
import {performance,matrixComparison} from '../public/performance.mjs';
import {compareAssets} from '../public/comparison.mjs';
import {validConfig} from '../public/research-state.mjs';
const fund={id:'fund',name:'Fund',unit:'CNY',researchClass:'fund'},price={id:'price',name:'Price',unit:'点',researchClass:'price'};
const history=[{date:'2025-12-31',close:3.08},{date:'2026-09-04',close:.6},{date:'2026-10-05',close:.626}];
const record={status:'ok',asOf:'2026-10-06',history,research:{status:'ok',basis:'fund-adjusted',label:'Adjusted',history:history.map((b,i)=>({...b,close:i===0?.513:b.close}))}};
test('fund performance uses adjusted history and cannot fall back to raw quotes',()=>{const r=performance(fund,record);assert.ok(Math.abs(r.values.year.value-22.02729044834)<1e-6);assert.equal(history[0].close,3.08);assert.equal(performance(fund,{...record,research:null}).values.year.value,null);assert.equal(performance(fund,{...record,research:{status:'unavailable'}}).volatility,null)});
test('comparison uses same adjusted series and refuses missing research',()=>{const records=new Map([['fund',record],['price',record]]);const r=compareAssets([fund,price],records,90,{start:'2025-12-31',end:'2026-10-05'});assert.ok(Math.abs(r.lines[0].result-22.02729044834)<1e-6);records.set('fund',{...record,research:null});assert.match(compareAssets([fund,price],records).error,/复权/)});
test('matrix handoff locks exact calendar-month baselines and clears rolling ambiguity',()=>{const c=matrixComparison([fund,price],new Map([['fund',record],['price',record]]),'oneMonth','2026-10-05');assert.deepEqual(c.range,{start:'2026-09-04',end:'2026-10-05'});assert.equal(c.origin,'来自矩阵：近1月');assert.deepEqual(validConfig(c,['fund','price']),c)});
test('matrix handoff blocks mismatched baselines or failed observations',()=>{const different={...record,history:history.map(b=>b.date==='2026-09-04'?{...b,date:'2026-09-03'}:b)};assert.match(matrixComparison([fund,price],new Map([['fund',record],['price',different]]),'oneMonth','2026-10-05').error,/基准日/);assert.match(matrixComparison([fund,price],new Map([['fund',{...record,research:null}],['price',record]]),'year').error,/复权/)});

test('conflicting calendars offer only explicit overlap with real endpoints',()=>{
 const a={id:'a',name:'Weekdays',unit:'USD'},b={id:'b',name:'Daily',unit:'USD'};
 const make=dates=>({status:'ok',asOf:'2026-10-06',history:dates.map((date,i)=>({date,close:100+i}))});
 const records=new Map([['a',make(['2026-09-04','2026-09-07','2026-10-05'])],['b',make(['2026-09-04','2026-09-05','2026-09-07','2026-10-05'])]]);
 const c=matrixComparison([a,b],records,'oneMonth');
 assert.match(c.error,/基准日/);assert.deepEqual(c.periods.map(p=>p.baseDate),['2026-09-04','2026-09-05']);
 assert.deepEqual(c.proposal.range,{start:'2026-09-07',end:'2026-10-05'});
 const result=compareAssets([a,b],records,c.proposal.days,c.proposal.range);
 assert.equal(result.error,undefined);assert.deepEqual(result.dates,['2026-09-07','2026-10-05']);
 assert.notEqual(result.lines[0].result,performance(a,records.get('a')).values.oneMonth.value);
 records.set('a',make(['2026-09-04','2026-10-05']));assert.equal(matrixComparison([a,b],records,'oneMonth').proposal,null);
 records.set('a',{...records.get('a'),status:'stale'});assert.equal(matrixComparison([a,b],records,'oneMonth').proposal,undefined);
});

import {researchHealth} from '../public/performance.mjs';
test('research health separates existing quotes, unavailable research and unloaded assets',()=>{
 const other={...price,id:'stale'},waiting={...price,id:'waiting'};
 const records=new Map([['fund',{...record,latest:history.at(-1),research:null}],['price',{...record,latest:history.at(-1)}],['stale',{...record,latest:history.at(-1),status:'stale'}]]);
 assert.deepEqual(researchHealth([fund,price,other,waiting],records),{quotes:3,ready:1,unavailable:2,pending:1});
 records.set('fund',{...record,latest:history.at(-1)});
 assert.equal(researchHealth([fund,price,other,waiting],records).ready,2);
});
