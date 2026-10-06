import test from 'node:test';
import assert from 'node:assert/strict';
import {structureWatch} from '../public/structure-watch.mjs';
const history=n=>[10,10,10,10,10,...Array.from({length:n},(_,i)=>11+i)].map((close,i)=>({close,date:`2026-09-${String(i+1).padStart(2,'0')}`}));
const assets=['six','eight','nine','short','stale','error','missing'].map(id=>({id,name:id}));
const record=n=>({status:'ok',history:history(n),asOf:'2026-09-13'});
test('watch includes only latest developing 6–8; sorts by progress and excludes stale',()=>{
 const records=new Map([['six',record(6)],['eight',record(8)],['nine',record(9)],['short',record(5)],['stale',{...record(8),status:'stale'}],['error',{...record(7),error:'refresh failed'}]]);
 const r=structureWatch(assets,records);assert.deepEqual(r.items.map(x=>x.asset.id),['eight','six']);assert.equal(r.unavailable,2);assert.equal(r.checked,6);assert.equal(r.total,7);assert.equal(r.items[0].today,true);assert.equal(r.items[1].today,false);
});
test('interrupted sequence leaves the watch on refresh',()=>{
 const records=new Map([['six',record(6)]]);assert.equal(structureWatch(assets,records).items.length,1);
 records.get('six').history.push({date:'2026-09-12',close:0});assert.equal(structureWatch(assets,records).items.length,0);
});
test('empty history is unavailable rather than a false no-signal result',()=>{
 const r=structureWatch(assets,new Map([['six',{status:'ok',history:[]}]]));assert.equal(r.items.length,0);assert.equal(r.unavailable,1);
});
test('latest nine is separate, and its current-day status remains provisional',()=>{
 const r=structureWatch(assets,new Map([['nine',record(9)]]));assert.equal(r.items.length,0);assert.equal(r.completed.length,1);assert.equal(r.completed[0].today,true);
 const closed=structureWatch(assets,new Map([['nine',{...record(9),asOf:'2026-09-15'}]]));assert.equal(closed.completed[0].today,false);
});
test('past nine and stale nine are not current completed alerts',()=>{
 assert.equal(structureWatch(assets,new Map([['nine',record(10)]])).completed.length,0);
 assert.equal(structureWatch(assets,new Map([['nine',{...record(9),status:'stale'}]])).completed.length,0);
});
