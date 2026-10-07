import {restoreMacroState,resolveMacroDate} from './macro-state.mjs?v=20261007-macro4';
import {indicators,macroStudy,macroBreakdown,macroComparison,macroRecent,macroRefreshInputs,macroNearestDate} from './macro.mjs?v=20261007-macro4';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>Number.isFinite(v)?v.toFixed(2):'—';
const sourceName=id=>({nominal:'名义收益率',real:'实际收益率',ndx:'纳斯达克100',spx:'标普500',hg:'COMEX铜',gc:'COMEX黄金'}[id]||id);
function curve(r){
 const lo=Math.min(...r.values),hi=Math.max(...r.values),pad=Math.max((hi-lo)*.12,r.unit==='bp'?1:.05),min=lo-pad,max=hi+pad;
 const first=Date.parse(r.dates[0]),span=Date.parse(r.dates.at(-1))-first;
 const x=i=>58+(Date.parse(r.dates[i])-first)/span*600,y=v=>218-(v-min)/(max-min)*180;
 return `<svg viewBox="0 0 720 260" role="img" aria-label="${esc(r.name)}历史曲线，单位${esc(r.unit)}，完整数值见明细">${[0,1,2,3].map(i=>{const v=min+(max-min)*i/3;return `<line x1="58" x2="658" y1="${y(v)}" y2="${y(v)}"/><text x="49" y="${y(v)+4}" text-anchor="end">${number(v)}</text>`}).join('')}${min<0&&max>0?`<line class="macro-zero" x1="58" x2="658" y1="${y(0)}" y2="${y(0)}"/>`:''}<line class="macro-cursor" data-cursor="${r.id}" x1="658" x2="658" y1="38" y2="218"/><polyline points="${r.values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')}"/><text x="58" y="250">${r.dates[0]}</text><text x="658" y="250" text-anchor="end">${r.dates.at(-1)}</text></svg>`;
}
function recent(r){
 return `<section class="macro-recent" aria-label="${esc(r.name)}近期变化"><h3>近期变化 · 截至最新观测 ${r.dates.at(-1)}</h3><div>${macroRecent(r).map(v=>`<p><span>最近 ${v.n} 个间隔</span><strong>${v.error?'—':(v.value>0?'+':'')+number(v.value)+' '+v.unit}</strong><small>${v.error||v.start+' → '+v.end}</small></p>`).join('')}</div><p>按当前日期口径计数，可能跨休市或缺失日，不等同于自然日。</p></section>`;
}
function breakdown(r){
 const b=macroBreakdown(r);if(!b)return '';
 const signed=v=>(v>0?'+':'')+number(v);
 const max=Math.max(1,...b.values.map(Math.abs));
 return `<section class="macro-breakdown" aria-label="${esc(r.name)}区间分解"><h3>${r.ratio?'两项资产分别发生了什么':r.id==='slope'?'曲线两端变化':'名义利率变化分解'}</h3><p>${r.dates[0]} — ${r.dates.at(-1)} · 当前窗口分解（不随游标变化）</p><div class="macro-contributions">${b.labels.map((label,i)=>`<div><span>${label}</span><strong>${signed(b.values[i])} ${b.unit}</strong><div class="macro-bar-track" aria-hidden="true"><i class="${b.values[i]<0?'negative':'positive'}" style="width:${Math.abs(b.values[i])/max*50}%;${b.values[i]<0?'right':'left'}:50%"></i></div></div>`).join('')}</div><p>${b.formula}。分项独立四舍五入可能产生0.01的显示误差；这是算术分解，不表示因果。</p>${r.ratio?`<button id="macro-compare-${r.id}" class="button" data-macro-compare="${r.id}">在跨资产对照中查看两项资产 →</button><p>保留起止日期；对照页使用这两项资产的全部共同日期，样本数可能增加。</p>`:''}</section>`;
}
export function mountMacro(root,onCompare=()=>{},onRefresh=async()=>{}){
 const groups=[...new Set(indicators.map(i=>i.group))];let active=groups[0],records=new Map(),treasury=null,busy=false,loaded=false,results=[],lastMarkup='',refreshing=false,refreshMessage='';const storageKey='pivot-macro-state-v1';let saved,storageError='',saveTimer;try{saved=JSON.parse(localStorage.getItem(storageKey))}catch{storageError='无法读取已保存状态，使用默认设置。'}const initial=restoreMacroState(saved);active=initial.group;let researchDate=initial.date;const selectedDates=new Map(Object.entries(initial.dates));
 root.innerHTML=`<div class="macro-toolbar"><div class="macro-tabs" role="group" aria-label="宏观研究视角">${groups.map((g,i)=>`<button class="button" data-macro-group="${esc(g)}" aria-pressed="${i===0}">${g}</button>`).join('')}</div><label>日期口径<select id="macro-alignment"><option value="common">全部六项共同日期</option><option value="independent">各图独立日期</option></select></label><label>观察窗口<select id="macro-window"><option value="90">近90自然日</option><option value="180">近180自然日</option><option value="365">近365自然日</option></select></label><button class="button" id="macro-refresh">刷新本视角</button><button class="button" id="macro-export">导出当前视角 CSV</button></div><p id="macro-status" class="macro-status" role="status"></p><p id="macro-refresh-result" role="status"></p><p id="macro-state-note" role="status"></p><p id="macro-load-note" role="status"></p><div id="macro-summary"></div><div id="macro-results"></div><p class="macro-footnote">共同日期模式取全部六项有效日期交集，切换研究视角保留同一区间；独立模式按各图自身日期计算。历史不足会缩短区间，请核对实际起点。只取真实观测，不前填；连线连接相邻观测，可能跨休市或缺失日。官方日度发布不等于实时行情；本页不生成宏观预测或买卖信号。</p>`;
 const find=s=>root.querySelector(s);find('#macro-window').value=initial.days;find('#macro-alignment').value=initial.mode;
 function persist(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{localStorage.setItem(storageKey,JSON.stringify({version:1,group:active,days:Number(find('#macro-window').value),mode:find('#macro-alignment').value,date:researchDate,dates:Object.fromEntries(selectedDates)}))}catch{storageError='浏览器未能保存研究状态；刷新后可能丢失选择。';find('#macro-state-note').textContent=storageError}},150)}
 function draw(){
  const focus=root.contains(document.activeElement)?document.activeElement.id:null;
  const expanded=new Set([...root.querySelectorAll('details[open]')].map(d=>d.dataset.indicator));
  results=macroStudy(treasury,records,Number(find('#macro-window').value),find('#macro-alignment').value==='common').filter(i=>i.group===active);
  find('#macro-refresh').disabled=busy||refreshing;find('#macro-refresh').textContent=refreshing?'本视角更新中…':busy?'官方利率加载中…':'刷新本视角';find('#macro-refresh-result').textContent=refreshMessage;
  find('#macro-export').disabled=!results.some(r=>!r.error);
  find('#macro-status').textContent=`${active} · ${results.filter(r=>!r.error).length} / ${results.length} 项可用${busy?' · 官方数据加载中':''} · ${find('#macro-alignment').value==='common'?'全部六项使用相同观测日期':'各图独立日期，勿直接比较区间变化'} · 日度观察`;
  root.querySelectorAll('[data-macro-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.macroGroup===active)));
  const common=find('#macro-alignment').value==='common';find('#macro-load-note').textContent=common&&results[0]?.error?results[0].error:'';
  find('#macro-summary').innerHTML=results.filter(r=>!r.ratio).map(breakdown).join('');
  const markup=results.map(r=>`<article class="macro-study"><header><h2>${esc(r.name)}</h2><p>${esc(r.note)}</p></header>${r.error?`<div class="${r.errorKind==='loading'?'macro-loading':'macro-error'}"><strong>${r.errorKind==='loading'?'正在加载':r.errorKind==='history'?'历史不足':r.errorKind==='source'?'来源不可用':'数据无法计算'}</strong><p>${common?'共同日期状态见上方说明。':esc(r.error)}</p><p>${r.errorKind==='loading'?'数据就绪后自动展示，无需重复刷新。':'使用“刷新本视角”更新相关来源；共同模式会刷新全部六项依赖。失败后的冷却期内可能仍返回旧状态。'}${r.sources.some(s=>s.status==='stale')?' 已保留旧数据，但不参与本图计算。':''}</p></div>`:`<div class="macro-reading"><div><span>${r.ratio?'最新标准化比值':'最新观测'}</span><strong>${number(r.latest)} <small>${esc(r.unit)}</small></strong></div><div><span>区间变化</span><strong>${r.delta>0?'+':''}${number(r.delta)} <small>${r.deltaUnit}</small></strong></div><div><span>实际区间 · ${r.dates.length} 个观测</span><b>${r.dates[0]} — ${r.dates.at(-1)}</b></div></div>${recent(r)}<div class="macro-chart" data-chart="${r.id}" id="macro-chart-${r.id}" tabindex="0" role="region" aria-label="${esc(r.name)}曲线，可横向滚动">${curve(r)}</div><div class="macro-inspect"><label for="macro-position-${r.id}">定位观测日期 · 仅改变读数，不改变近期变化与区间分解<input id="macro-position-${r.id}" data-position="${r.id}" type="range" min="0" max="${r.dates.length-1}" step="1" value="${r.dates.length-1}"></label><output id="macro-readout-${r.id}" for="macro-position-${r.id}"></output></div>${r.ratio?breakdown(r):''}<p class="macro-date-note">窄屏图表可横向滚动查看完整区间。请求起点 ${r.requestedStart}；实际起点受交易日与历史覆盖影响。${r.ratio?'比值起点归一为100；变化不是组合投资收益。':'单位为%时，区间变化按100 bp / 百分点换算。'}</p><details data-indicator="${r.id}" ${expanded.has(r.id)?'open':''}><summary id="macro-detail-${r.id}">查看数值与计算明细</summary><div class="performance-scroll" id="macro-data-${r.id}" tabindex="0" role="region" aria-label="${esc(r.name)}明细"><table><thead><tr><th>日期</th>${(r.fields||r.inputs).map(f=>`<th>${esc(f)}</th>`).join('')}<th>${r.ratio?'原始比值':'指标值'}</th><th>${r.ratio?'起点100':'单位'}</th></tr></thead><tbody>${r.dates.map((d,i)=>`<tr><td>${d}</td>${r.components[i].map(v=>`<td>${v.toFixed(4)}</td>`).join('')}<td>${r.raw[i].toFixed(r.ratio?6:2)}</td><td>${r.ratio?number(r.values[i]):esc(r.unit)}</td></tr>`).join('')}</tbody></table></div></details>`}<footer><h3>数据来源与日期</h3>${r.sources.filter((s,i,arr)=>arr.findIndex(x=>x.id===s.id)===i).map(s=>`<p><a id="macro-source-${r.id}-${s.id}" href="${esc(s.url||'https://home.treasury.gov/treasury-daily-interest-rate-xml-feed')}" target="_blank" rel="noreferrer">${esc(s.name)}${r.ratio?' · '+esc(s.id.toUpperCase()):''}</a> · 最新 ${esc(s.date||'—')} · ${s.status==='ok'?'可用':s.status==='loading'?'加载中':'不可用'}<br>获取：${s.fetchedAt?esc(new Date(s.fetchedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'}))+' 北京时间':'—'}</p>`).join('')}${!r.error?`<p>各依赖区间内未对齐日期数：${r.omitted.join(' / ')}。同日标签不保证同一收盘时刻。</p>`:''}</footer></article>`).join('');
  if(markup!==lastMarkup){find('#macro-results').innerHTML=markup;lastMarkup=markup;if(focus)root.querySelector('#'+CSS.escape(focus))?.focus({preventScroll:true})}
  const valid=results.filter(r=>!r.error),resolved=resolveMacroDate(valid[0]?.dates,researchDate);
  const adjusted=[];if(common&&resolved.date){if(resolved.adjusted)adjusted.push('研究日期 '+researchDate+' 已定位到最近有效观测 '+resolved.date);researchDate=resolved.date}
  for(const r of valid){const next=resolveMacroDate(r.dates,common?researchDate:selectedDates.get(r.id));if(next.adjusted)adjusted.push(r.name+' 已定位到 '+next.date);inspect(r,next.date,false)}
  find('#macro-state-note').textContent=[storageError,...adjusted,common?(researchDate?'共同研究日期：'+researchDate+'；各视角游标共享此日期。':'共同研究日期将在数据就绪后定位到最新观测。'):'独立模式：各图保留自己的日期；切回共同模式时使用最近操作的日期。'].filter(Boolean).join(' ');persist();
 }
 function inspect(r,date,sync=true){
  const i=macroNearestDate(r.dates,date);if(i<0)return;
  selectedDates.set(r.id,r.dates[i]);if(sync){researchDate=r.dates[i];persist();if(find('#macro-alignment').value==='common')find('#macro-state-note').textContent=storageError+' 共同研究日期：'+researchDate+'；各视角游标共享此日期。'}
  const input=find('#macro-position-'+r.id),out=find('#macro-readout-'+r.id);
  input.value=i;input.setAttribute('aria-valuetext',r.dates[i]+'，'+number(r.values[i])+' '+r.unit);
  out.textContent='当前选中：'+r.dates[i]+' · '+number(r.values[i])+' '+r.unit+(r.ratio?' · 原始比值 '+r.raw[i].toFixed(6):'');
  const x=58+(Date.parse(r.dates[i])-Date.parse(r.dates[0]))/(Date.parse(r.dates.at(-1))-Date.parse(r.dates[0]))*600;
  const line=root.querySelector('[data-cursor="'+r.id+'"]');line.setAttribute('x1',x);line.setAttribute('x2',x);
  if(sync&&find('#macro-alignment').value==='common')for(const other of results.filter(v=>!v.error&&v.id!==r.id))inspect(other,r.dates[i],false);
 }
 root.addEventListener('input',e=>{const id=e.target.dataset.position;if(id){const r=results.find(r=>r.id===id);inspect(r,r.dates[Number(e.target.value)])}});
 const point=e=>{const chart=e.target.closest('[data-chart]');if(!chart)return;const r=results.find(r=>r.id===chart.dataset.chart);if(!r||r.error)return;const rect=chart.querySelector('svg').getBoundingClientRect();const fraction=Math.max(0,Math.min(1,((e.clientX-rect.left)/rect.width*720-58)/600));const time=Date.parse(r.dates[0])+fraction*(Date.parse(r.dates.at(-1))-Date.parse(r.dates[0]));inspect(r,new Date(time).toISOString())};
 root.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')point(e)});root.addEventListener('pointerdown',point);
 async function refreshCurrent(){
  if(busy||refreshing)return;refreshing=true;
  const common=find('#macro-alignment').value==='common',scope=common?'全部六项依赖':active;
  const requested=macroRefreshInputs(active,common);
  refreshMessage='正在更新 '+requested.map(sourceName).join(' / ')+'；来源更新完成后汇总结果。';draw();
  const quoteIds=requested.filter(id=>!['nominal','real'].includes(id));
  const jobs=[];if(requested.some(id=>['nominal','real'].includes(id)))jobs.push(load(true));
  if(quoteIds.length)jobs.push(onRefresh(quoteIds));
  const settled=await Promise.allSettled(jobs);
  const states=requested.map(id=>{const r=['nominal','real'].includes(id)?treasury?.[id]:records.get(id);return sourceName(id)+'：'+(r?.status==='ok'&&!r.error?'可用':r?.status==='stale'?'旧数据':'失败或缺失')});
  const errors=settled.filter(r=>r.status==='rejected').map(r=>r.reason?.message||'请求失败');
  refreshMessage=scope+' · '+(errors.length?'部分刷新未执行：'+errors.join('；')+'。':'本次刷新完成。')+'当前来源状态：'+states.join('；')+'。可用不等于发布了新观测，请核对来源日期。';
  refreshing=false;draw();
 }
 async function load(force=false){if(busy)return;busy=true;loaded=true;draw();try{const response=await fetch('/api/macro'+(force?'?refresh=1':''),{signal:AbortSignal.timeout(65000)});if(!response.ok)throw new Error();treasury=await response.json()}catch{treasury=Object.fromEntries(['nominal','real'].map(k=>[k,{...treasury?.[k],status:treasury?.[k]?.history?.length?'stale':'error',error:'官方利率服务连接失败，请重试'}]))}finally{busy=false;draw()}}
 find('#macro-alignment').addEventListener('change',draw);find('#macro-window').addEventListener('change',draw);find('#macro-refresh').onclick=refreshCurrent;
 root.addEventListener('click',e=>{const compare=e.target.closest('[data-macro-compare]');if(compare){const config=macroComparison(results.find(r=>r.id===compare.dataset.macroCompare));if(config)onCompare(config);return}const b=e.target.closest('[data-macro-group]');if(b){active=b.dataset.macroGroup;draw()}});
 find('#macro-export').onclick=()=>{const rows=[['indicator','date','raw_value','display_value','unit','actual_start','actual_end','source','fetched_at','input_names','input_values']];for(const r of results.filter(r=>!r.error))r.dates.forEach((d,i)=>rows.push([r.name,d,r.raw[i],r.values[i],r.unit,r.dates[0],r.dates.at(-1),r.sources.map(s=>s.name).join(' / '),r.sources.map(s=>s.fetchedAt||'').join(' / '),(r.fields||r.inputs).join(' / '),r.components[i].join(' / ')]));const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='pivot-macro.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 const update=(a,r)=>{records=r;if(!root.hidden)draw()};update.activate=()=>{draw();if(!loaded)load()};update.refresh=refreshCurrent;return update;
}
