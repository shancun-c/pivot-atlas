import test from 'node:test';
import assert from 'node:assert/strict';
import {nineTurn,makeChartModel,chartMarkup} from '../public/chart.mjs';
const make=closes=>closes.map((close,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,open:close,close,high:close+1,low:close-1}));
const rising=make([10,10,10,10,10,...Array.from({length:20},(_,i)=>11+i)]);
test('completed structure backfills exactly 1–9, no repeat in same run',()=>{
 const s=nineTurn(rising);assert.equal(s.filter(Boolean).length,9);
 assert.deepEqual(s.slice(5,14).map(s=>s.count),[1,2,3,4,5,6,7,8,9]);assert.equal(s[14],null);assert.equal(s[5].confirmedAt,'2026-09-14');
});
test('one through five are hidden; six through eight are developing',()=>{
 for(let n=1;n<=8;n++){const s=nineTurn(rising.slice(0,5+n)).filter(Boolean);assert.equal(s.length,n<6?0:n);assert.ok(s.every(v=>v.confirmedAt===null&&v.provisional));}
});
test('interruption, equality and invalid data remove unfinished structures',()=>{
 for(const value of [0,13,NaN]){const h=rising.slice(0,12);h[11]={...h[11],close:value};assert.ok(nineTurn(h).every(s=>s===null));}
});
test('truncated already-running trend is not treated as a known start',()=>{
 assert.ok(nineTurn(make(Array.from({length:25},(_,i)=>i+10))).every(s=>s===null));
});
test('current-day ninth bar is explicitly provisional',()=>{
 const today=nineTurn(rising.slice(0,14),'2026-09-14').filter(Boolean);
 assert.equal(today.length,9);assert.ok(today.every(s=>s.provisional));
 assert.ok(nineTurn(rising.slice(0,14),'2026-09-15').filter(Boolean).every(s=>!s.provisional));
});
test('failure on seventh eighth or ninth clears all developing labels',()=>{
 for(const n of [6,7,8]){
  const h=rising.slice(0,5+n);assert.equal(nineTurn(h).filter(Boolean).length,n);
  for(const value of [0,h.at(-4).close,NaN]){
   const failed=[...h,{date:'2026-09-30',close:value,high:value+1,low:value-1}];
   assert.equal(nineTurn(failed).filter(Boolean).length,0);
  }
 }
});
test('completed structure remains after a reversal',()=>{
 const h=[...rising.slice(0,14),{date:'2026-09-15',close:0}];assert.equal(nineTurn(h).filter(Boolean).length,9);
});
test('window changes preserve completed signals; short sequences render no text',()=>{
 const a=makeChartModel(rising,{}, {count:20}),b=makeChartModel(rising,{}, {count:12});assert.deepEqual(a.nine.slice(-12),b.nine);
 assert.match(chartMarkup(a),/data-count="9"/);assert.doesNotMatch(chartMarkup(makeChartModel(rising.slice(0,10))),/class="nine-turn"/);
});
test('downward completed structure also works for yield lines',()=>{
 const h=rising.map(b=>({...b,close:50-b.close,high:51-b.close,low:49-b.close}));const m=makeChartModel(h,{}, {lineOnly:true});assert.equal(m.nine[13].direction,'down');assert.match(chartMarkup(m),/data-direction="down"/);
});
