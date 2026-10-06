// Native SVG chart; all price geometry uses unrounded source values.
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Tonghuashun display: show a developing run at 6; discard it on failure before 9.
export function nineTurn(history, asOf) {
 const signals=history.map(()=>null);
 let direction=0,start=-1,length=0;
 const comparison=i=>i>=4&&Number.isFinite(history[i]?.close)&&Number.isFinite(history[i-4]?.close)?Math.sign(history[i].close-history[i-4].close):null;
 history.forEach((bar,i)=>{
  const current=comparison(i),previous=comparison(i-1);
  if(current===null||current===0){direction=0;length=0;return;}
  if(current!==direction){
   direction=0;length=0;
   // Require an observed start, not an arbitrary boundary in truncated history.
   if(previous!==null&&previous!==current){direction=current;start=i;length=1;}
  }else length++;
  if(length===9){
   for(let j=0;j<9;j++)signals[start+j]={direction:direction>0?'up':'down',count:j+1,confirmedAt:bar.date,provisional:!!asOf&&bar.date>=asOf};
  }
 });
 if(length>=6&&length<9){
  for(let j=0;j<length;j++)signals[start+j]={direction:direction>0?'up':'down',count:j+1,confirmedAt:null,provisional:true};
 }
 return signals;
}
export function makeChartModel(history, levels={}, {count=40,depth=3,effectiveStart,effectiveEnd,lineOnly=false,historical=[],asOf}={}) {
 const signals=nineTurn(history,asOf);
 const visible=history.map((bar,i)=>({bar,signal:signals[i]})).filter(({bar:b})=>Number.isFinite(b.high)&&Number.isFinite(b.low)&&Number.isFinite(b.close)).slice(-count);
 const bars=visible.map(v=>v.bar),nine=visible.map(v=>v.signal);
 if(!bars.length)return null;
 const keys=[...Array.from({length:depth},(_,i)=>`R${depth-i}`),'P',...Array.from({length:depth},(_,i)=>`S${i+1}`)];
 const lines=keys.filter(k=>Number.isFinite(levels[k])).map(key=>({key,value:levels[key]}));
 const historySegments=historical.filter(h=>h.levels&&h.effectiveStart<=bars.at(-1).date&&h.effectiveEnd>=bars[0].date&&h.effectiveStart!==effectiveStart);
 const prices=[...historySegments.flatMap(h=>keys.map(k=>h.levels[k]).filter(Number.isFinite)),...bars.flatMap(b=>[b.high,b.low]),...lines.map(l=>l.value)];
 const low=Math.min(...prices),high=Math.max(...prices),padding=Math.max((high-low)*.08,Math.abs(high)*.001,.0001);
 const min=low-padding,max=high+padding;
 const left=82,right=846,top=36,bottom=402;
 const preview=Boolean(effectiveStart&&effectiveStart>bars.at(-1).date);
 const pastRight=preview?right-150:right;
 const step=(pastRight-left)/(bars.length+2);
 const x=i=>left+step*(i+.75),y=v=>bottom-(v-min)/(max-min)*(bottom-top);
 const ordered=lines.map(l=>({...l,y:y(l.value)})).sort((a,b)=>a.y-b.y);
 ordered.forEach((l,i)=>l.labelY=Math.max(l.y,i?ordered[i-1].labelY+25:top));
 if(ordered.length&&ordered.at(-1).labelY>bottom){ordered.at(-1).labelY=bottom;for(let i=ordered.length-2;i>=0;i--)ordered[i].labelY=Math.min(ordered[i].labelY,ordered[i+1].labelY-25)}
 const active=bars.findIndex(b=>b.date>=effectiveStart&&b.date<=effectiveEnd);
 const lineStart=preview?pastRight+12:active>=0?x(active)-step*.5:right;
 return {nine,preview,pastRight,lineStart,historySegments,keys,bars,lines:ordered,min,max,left,right,top,bottom,step,x,y,active,lineOnly,
         missingOpen:lineOnly?0:bars.filter(b=>!Number.isFinite(b.open)||b.open<b.low||b.open>b.high).length};
}
export function chartMarkup(model,format=v=>String(v)) {
 if(!model)return '<div class="chart-empty">暂无可绘图的历史行情，请等待行情加载或刷新。</div>';
 const {bars,lines,left,right,top,bottom,step,x,y,active,lineOnly}=model;
 const f=v=>escapeText(format(v));
 let svg=`<svg viewBox="0 0 1000 450" class="candle-svg" role="group" aria-label="${lineOnly?'日收益率折线':'日K线'}与枢轴点位图"><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="#fff"/>`;
 if(model.preview)svg+=`<rect x="${model.pastRight}" y="${top}" width="${right-model.pastRight}" height="${bottom-top}" fill="#edf3e8"/><text x="${right-5}" y="22" text-anchor="end" class="period-band-label">下期参考 · 尚未交易</text>`;
 if(active>=0)svg+=`<rect x="${x(active)-step*.5}" y="${top}" width="${right-x(active)+step*.5}" height="${bottom-top}" fill="#edf3e8"/><text x="${right-5}" y="22" text-anchor="end" class="period-band-label">当前价位适用区间</text>`;
 for(let i=0;i<=4;i++){const v=model.min+(model.max-model.min)*i/4,py=y(v);svg+=`<line x1="${left}" x2="${right}" y1="${py}" y2="${py}" stroke="#eef1eb"/><text x="${left-10}" y="${py+4}" text-anchor="end" class="axis-label">${f(v)}</text>`}
 for(const h of model.historySegments){const indices=bars.map((b,i)=>b.date>=h.effectiveStart&&b.date<=h.effectiveEnd?i:-1).filter(i=>i>=0);if(!indices.length)continue;for(const key of model.keys){const v=h.levels[key];if(!Number.isFinite(v))continue;const color=key==='P'?'var(--red, #a14432)' :key[0]==='R'?'var(--blue, #235f96)' :'var(--green, #236a51)' ;svg+=`<line class="historical-pivot" data-period-start="${h.effectiveStart}" data-level="${key}" data-value="${v}" x1="${x(indices[0])-step*.5}" x2="${x(indices.at(-1))+step*.5}" y1="${y(v)}" y2="${y(v)}" stroke="${color}" opacity=".7" stroke-width="${key==='P'?1.5:1}" stroke-dasharray="${key==='P'?'0':'4 4'}"/>`}}
 for(const l of lines){const color=l.key==='P'?'var(--red, #a14432)' :l.key[0]==='R'?'var(--blue, #235f96)' :'var(--green, #236a51)' ;svg+=`<g class="pivot-line" data-level="${l.key}" data-value="${l.value}"><line x1="${model.lineStart}" x2="${right}" y1="${l.y}" y2="${l.y}" stroke="${color}" stroke-width="${l.key==='P'?1.6:1}" stroke-dasharray="${l.key==='P'?'0':'5 5'}" opacity=".55"/><path d="M ${right} ${l.y} L ${right+13} ${l.labelY} L ${right+20} ${l.labelY}" fill="none" stroke="${color}" opacity=".65"/><rect x="${right+20}" y="${l.labelY-11}" width="126" height="22" rx="3" fill="${color}" fill-opacity=".08"/><text x="${right+26}" y="${l.labelY+4}" fill="${color}" class="pivot-price">${l.key}  ${f(l.value)}</text></g>`}
 if(lineOnly)svg+=`<polyline fill="none" stroke="#456d60" stroke-width="2" points="${bars.map((b,i)=>`${x(i)},${y(b.close)}`).join(' ')}"/>`;
 bars.forEach((b,i)=>{
  const valid=Number.isFinite(b.open)&&b.open>=b.low&&b.open<=b.high;
  const color=valid?(b.close>=b.open?'#a14432':'#236a51'):'#9ba59b';const width=Math.min(10,step*.58);
  if(!lineOnly){svg+=`<g class="${valid?'candle':'missing-candle'}" data-date="${escapeText(b.date)}"><line x1="${x(i)}" x2="${x(i)}" y1="${y(b.high)}" y2="${y(b.low)}" stroke="${color}" stroke-width="1.2"/>`;
   svg+=valid?`<rect x="${x(i)-width/2}" y="${Math.min(y(b.open),y(b.close))}" width="${width}" height="${Math.max(1.2,Math.abs(y(b.open)-y(b.close)))}" fill="${color}"/>`:`<line x1="${x(i)-width/2}" x2="${x(i)+width/2}" y1="${y(b.close)}" y2="${y(b.close)}" stroke="${color}" stroke-width="2"/>`;svg+='</g>'}
 });
 model.nine.forEach((signal,i)=>{
  if(!signal)return;
  const above=signal.direction==='up',py=above?y(bars[i].high)-12:y(bars[i].low)+16;
  const label=`神奇九转 ${above?'上涨':'下跌'}结构 ${signal.count}，${signal.confirmedAt?`${signal.confirmedAt} 达到九转${signal.provisional?'，当日日线待确认':''}`:'发展中，尚未形成九转'}${signal.count<6?'，回溯标注':''}`;
  svg+=`<text class="nine-turn" data-date="${escapeText(bars[i].date)}" data-direction="${signal.direction}" data-count="${signal.count}" x="${x(i)}" y="${py}" text-anchor="middle" fill="${above?'#a14432':'#236a51'}" font-size="${signal.count===9?14:11}" font-weight="${signal.count===9?800:600}" stroke="white" stroke-width="3" paint-order="stroke" aria-label="${label}"><title>${label}</title>${signal.count}</text>`;
 });
 const dates=[...new Set([0,Math.floor(bars.length/3),Math.floor(2*bars.length/3),bars.length-1])];
 dates.forEach(i=>svg+=`<text x="${x(i)}" y="430" text-anchor="middle" class="axis-label">${escapeText(bars[i].date.slice(5))}</text>`);
 svg+='<line class="chart-crosshair" y1="36" y2="402" stroke="#7d8c79" stroke-dasharray="3 4" visibility="hidden"/>';
 bars.forEach((b,i)=>svg+=`<rect class="candle-hit" data-index="${i}" x="${x(i)-step/2}" y="${top}" width="${step}" height="${bottom-top}" fill="transparent" tabindex="${i===bars.length-1?0:-1}" role="button" aria-label="${escapeText(b.date)} ${lineOnly?'收益率':'收盘'} ${f(b.close)}，查看详情"><title>${escapeText(b.date)} · ${lineOnly?'收益率':'收盘'} ${f(b.close)}</title></rect>`);
 return svg+'</svg>';
}
export function mountChart(container,history,levels,options,format){
 const model=makeChartModel(history,levels,options);
 container.innerHTML=`<div class="chart-readout" aria-live="polite"></div><div class="candle-scroll" role="region" aria-label="日线图，可左右滚动；聚焦日线后用左右箭头切换日期">${chartMarkup(model,format)}</div>`;
 if(!model)return;
 const readout=container.querySelector('.chart-readout'),crosshair=container.querySelector('.chart-crosshair');
 const show=i=>{const b=model.bars[i];readout.innerHTML=`<b>${escapeText(b.date)}</b>`+(options.lineOnly?`<span>收益率 <strong>${escapeText(format(b.close))}%</strong></span>`:[['开',b.open],['高',b.high],['低',b.low],['收',b.close]].map(([name,v])=>`<span>${name} <strong>${Number.isFinite(v)?escapeText(format(v)):'缺失'}</strong></span>`).join(''));if(model.nine[i])readout.innerHTML+=`<span>九转 <strong>${model.nine[i].direction==='up'?'上涨':'下跌'} ${model.nine[i].count}</strong></span>`;crosshair.setAttribute('x1',model.x(i));crosshair.setAttribute('x2',model.x(i));crosshair.setAttribute('visibility','visible')};
 container.addEventListener('keydown',e=>{const hit=e.target.closest('[data-index]');if(!hit)return;const i=Number(hit.dataset.index);const next=e.key==='ArrowRight'?Math.min(model.bars.length-1,i+1):e.key==='ArrowLeft'?Math.max(0,i-1):e.key==='Home'?0:e.key==='End'?model.bars.length-1:null;if(next===null)return;e.preventDefault();hit.setAttribute('tabindex','-1');const target=container.querySelector(`[data-index="${next}"]`);target.setAttribute('tabindex','0');target.focus();show(next)});
 for(const name of ['pointerover','focusin','click'])container.addEventListener(name,e=>{const hit=e.target.closest('[data-index]');if(hit)show(Number(hit.dataset.index))});
 show(model.bars.length-1);
 requestAnimationFrame(()=>{if(container.isConnected){const scroller=container.querySelector('.candle-scroll');scroller.scrollLeft=scroller.scrollWidth-scroller.clientWidth}});
 if(model.missingOpen)container.insertAdjacentHTML('beforeend',`<p class="chart-warning">${model.missingOpen} 根日线缺少有效开盘价，以灰色高低线和收盘刻度显示，不绘制蜡烛实体。</p>`);
}
