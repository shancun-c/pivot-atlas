import test from 'node:test';
import assert from 'node:assert/strict';
import {makeChartModel,chartMarkup} from '../public/chart.mjs';
const bars=Array.from({length:65},(_,i)=>({date:`2026-09-${String(i+1).padStart(2,'0')}`,open:10,high:12,low:8,close:11}));
test('range selection preserves OHLC without inventing opens',()=>{const m=makeChartModel(bars,{}, {count:20});assert.equal(m.bars.length,20);assert.equal(m.bars[0].open,10);assert.equal(m.bars.at(-1),bars.at(-1))});
test('all selected levels and candle extrema fit inside the shared price scale',()=>{const m=makeChartModel(bars,{P:10,R1:30,R2:40,R3:50,R4:60,R5:70,S1:0,S2:-10,S3:-20,S4:-30,S5:-40},{depth:5});assert.equal(m.lines.length,11);for(const v of [-40,70,8,12])assert.ok(m.y(v)>m.top&&m.y(v)<m.bottom);const svg=chartMarkup(m);assert.ok(svg.includes('data-level="R5" data-value="70"'))});
test('three-level setting excludes extended levels',()=>{const m=makeChartModel(bars,{P:10,R1:12,R4:100,S5:-100});assert.deepEqual(m.lines.map(l=>l.key),['R1','P']);assert.ok(m.max<100)});
test('missing opens are visibly marked instead of fabricated candles',()=>{const m=makeChartModel([{date:'2026-09-01',high:12,low:8,close:10}],{P:10});assert.equal(m.missingOpen,1);assert.ok(chartMarkup(m).includes('class="missing-candle"'));assert.ok(!chartMarkup(m).includes('class="candle"'))});
test('daily yield observations use a line, never candlesticks',()=>{const m=makeChartModel([{date:'2026-09-01',high:3,low:3,close:3}],{P:3},{lineOnly:true});assert.equal(m.missingOpen,0);assert.ok(chartMarkup(m).includes('<polyline'));assert.ok(!chartMarkup(m).includes('class="candle"'))});
test('flat prices still produce finite coordinates',()=>{const m=makeChartModel([{date:'2026-09-01',open:0,high:0,low:0,close:0}],{P:0});assert.ok(Number.isFinite(m.y(0)));assert.ok(!chartMarkup(m).includes('NaN'))});
test('active band matches the effective dates, not the input period',()=>{const m=makeChartModel([{date:'2026-09-25',high:12,low:8,close:10},{date:'2026-09-28',high:13,low:8,close:12}],{P:10},{effectiveStart:'2026-09-28',effectiveEnd:'2026-10-04'});assert.equal(m.active,1)});
test('dense labels do not overlap',()=>{const levels={P:10};for(let i=1;i<=5;i++){levels['R'+i]=10+i*.001;levels['S'+i]=10-i*.001}const m=makeChartModel(bars,levels,{depth:5});for(let i=1;i<m.lines.length;i++)assert.ok(m.lines[i].labelY-m.lines[i-1].labelY>=24.9)});
test('next-period levels only occupy the empty future area',()=>{const b=[{date:'2026-10-02',open:10,high:12,low:8,close:11}];const m=makeChartModel(b,{P:10},{effectiveStart:'2026-10-05',effectiveEnd:'2026-10-11'});assert.equal(m.preview,true);assert.ok(m.lineStart>m.x(0));assert.ok(chartMarkup(m).includes(`x1="${m.lineStart}" x2="${m.right}"`));});
test('historical segments use their own levels and date range',()=>{const b=[{date:'2026-09-25',open:10,high:12,low:8,close:11},{date:'2026-10-02',open:10,high:12,low:8,close:11}];const m=makeChartModel(b,{P:15},{effectiveStart:'2026-10-05',effectiveEnd:'2026-10-11',historical:[{effectiveStart:'2026-09-21',effectiveEnd:'2026-09-27',levels:{P:9}},{effectiveStart:'2026-09-28',effectiveEnd:'2026-10-04',levels:{P:10}}]});assert.equal(m.historySegments.length,2);const svg=chartMarkup(m);assert.ok(svg.includes('data-period-start="2026-09-21" data-level="P" data-value="9"'));});

test('chart offers one keyboard entry and uses design-system colors',()=>{
 const model=makeChartModel([{date:'2026-09-30',open:10,high:12,low:9,close:11},{date:'2026-10-01',open:11,high:13,low:10,close:12}],{P:11,R1:13,S1:9});
 const svg=chartMarkup(model);
 assert.equal((svg.match(/tabindex="0"/g)||[]).length,1);
 assert.equal((svg.match(/tabindex="-1"/g)||[]).length,1);
 assert.match(svg,/var\(--red, #a14432\)/);
});
