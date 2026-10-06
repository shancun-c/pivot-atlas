import {mountComparison} from './comparison-view.mjs?v=20261006-compare';
import {mountPerformance} from './performance-view.mjs?v=20261006-matrix';
import {structureWatch} from './structure-watch.mjs?v=20261006-watch9';
import {icon,marketIcon} from './icons.mjs';
import {mountChart} from './chart.mjs?v=20261006-td9-ths';
const $=s=>document.querySelector(s);
for(const [id,name] of Object.entries({overview:'chart','structure-nav':'layers','performance-nav':'chart','comparison-nav':'layers',watchlist:'star','source-nav':'database',export:'download',refresh:'refresh',help:'help',method:'compass','clear-filters':'close','reset-empty':'globe'})){
 const el=$('#'+id);if(el){if(id==='help')el.innerHTML=icon(name);else el.insertAdjacentHTML('afterbegin',icon(name));}}
$('.brand-icon').innerHTML=icon('globe');
$('.search span').innerHTML=icon('search');
document.querySelectorAll('.metrics article>span').forEach((el,i)=>el.insertAdjacentHTML('afterbegin',icon(['layers','database','calendar','compass'][i])));
document.querySelectorAll('#tabs [data-group]').forEach(el=>el.insertAdjacentHTML('afterbegin',icon(marketIcon(el.dataset.group))));
document.querySelectorAll('.dialog-close').forEach(el=>el.innerHTML=icon('close'));

let viewMode='reference', statusFilter='all';
const selected=(r,p)=>r?.periodViews?.[viewMode]?.[p]??r?.periods?.[p];
let assets=[], records=new Map(), period='week', group='全部', favoritesOnly=false, busy=false;
let stars;try{stars=new Set(JSON.parse(localStorage.getItem('pivot-stars')||'[]'))}catch{stars=new Set()}
const groups=['港股','美股','A股','亚太及新兴','国债收益率','境内商品','境外商品','外汇','加密货币'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const precision=a=>a.unit==='%'?3:a.group==='外汇'&&a.unit!=='点'?4:2;
const fmt=(v,a)=>Number.isFinite(v)?v.toLocaleString('en-US',{minimumFractionDigits:precision(a),maximumFractionDigits:precision(a)}):'—';
const columns=()=>$('#extended').checked?['R5','R4','R3','R2','R1','P','S1','S2','S3','S4','S5']:['R3','R2','R1','P','S1','S2','S3'];
function visible(){const q=$('#search').value.toLowerCase().trim();return assets.filter(a=>(group==='全部'||a.group===group)&&(!favoritesOnly||stars.has(a.id))&&(statusFilter==='all'||records.get(a.id)?.status===statusFilter)&&`${a.name} ${a.code} ${a.symbol||''}`.toLowerCase().includes(q))}
function toast(s){$('#toast').textContent=s;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,2800)}
function captureFocus(root){
 const el=document.activeElement;if(!root.contains(el))return null;
 if(el.id)return '#'+CSS.escape(el.id);
 for(const key of ['data-chart-period','data-view','data-star','data-detail','data-index'])if(el.hasAttribute(key))return `[${key}="${CSS.escape(el.getAttribute(key))}"]`+(el.hasAttribute('data-p')?`[data-p="${el.dataset.p}"]`:'');
 return null;
}
function restoreFocus(root,selector){if(selector)root.querySelector(selector)?.focus({preventScroll:true})}
const renderComparison=mountComparison($('#comparison-page'));
let performanceReturn=null;
const renderPerformance=mountPerformance($('#performance-page'),id=>{performanceReturn=id;showDetail(id,'week')});
const isStructurePage=()=>location.hash==='#structures';
function renderPage(){
 const watching=isStructurePage(),matrix=location.hash==='#performance',comparison=location.hash==='#comparison';
 $('#comparison-page').hidden=!comparison;
 $('#comparison-nav').classList.toggle('active',comparison);$('#comparison-nav').setAttribute('aria-pressed',String(comparison));
 $('#performance-page').hidden=!matrix;
 $('#performance-nav').classList.toggle('active',matrix);$('#performance-nav').setAttribute('aria-pressed',String(matrix));
 $('#structures-page').hidden=!watching;
 for(const selector of ['.board','.view-selector','.notice','#export'])$(selector).hidden=watching||matrix||comparison;
 $('.heading-copy h1').textContent=comparison?'跨资产对照':matrix?'跨市场表现':watching?'九转观察':'全球枢轴观测站';
 $('.heading-copy p').textContent=comparison?'对齐美元、利率、股票与商品，检验宏观研究线索。':matrix?'比较多周期表现，识别跨市场强弱变化。':watching?'跟踪最新九转与发展中序列，进入 K 线核验。':'以周与月为尺度，看清每一个关键价位。';
 $('#page-crumb').textContent=comparison?'跨资产对照':matrix?'跨市场表现':watching?'九转观察':'全球市场';
 $('#structure-nav').classList.toggle('active',watching);$('#structure-nav').setAttribute('aria-pressed',String(watching));
 for(const id of ['overview','watchlist']){const active=!watching&&!matrix&&!comparison&&(id==='watchlist'?favoritesOnly:!favoritesOnly);$('#'+id).classList.toggle('active',active);$('#'+id).setAttribute('aria-pressed',String(active))}
 document.querySelectorAll('.market-link').forEach(b=>{const active=matrix?b.dataset.group===$('#performance-market').value:!watching&&!comparison&&b.dataset.group===group;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});
 document.querySelectorAll('.mobile-pages a').forEach(a=>{if(a.hash===(comparison?'#comparison':matrix?'#performance':watching?'#structures':'#board'))a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
 document.title=(comparison?'跨资产对照':matrix?'跨市场表现':watching?'九转观察':'全球枢轴看板')+' · Pivot Atlas';
}
function navigatePage(page){if(location.hash!=='#'+page)location.hash=page;renderPage()}
window.addEventListener('hashchange',()=>{renderPage();window.scrollTo(0,0)});
$('#performance-page').addEventListener('change',renderPage);
$('#comparison-nav').onclick=()=>navigatePage('comparison');
$('#performance-nav').onclick=()=>navigatePage('performance');
$('#structure-nav').onclick=()=>navigatePage('structures');
let structureExpanded=false,structureReturn=null;
$('#structure-list').addEventListener('click',e=>{const b=e.target.closest('[data-detail]');if(b){structureReturn=b.dataset.detail;showDetail(b.dataset.detail,'week')}});
function renderStructureWatch(){
 const summary=structureWatch(assets,records),root=$('#structure-list'),focus=captureFocus(root);
 $('#structure-count').textContent=`达到 9：${summary.completed.length} 个 · 形成中：${summary.items.length} 个${busy?' · 扫描中':''}`;
 const shown=structureExpanded?summary.items:summary.items.slice(0,6);
 const rows=entries=>'<ul>'+entries.map(({asset,signal,date,today})=>`<li><button class="structure-item" data-detail="${esc(asset.id)}" data-p="week"><span class="structure-identity">${icon(marketIcon(asset.group))}<span><strong>${esc(asset.name)}</strong><small>${esc(asset.group)} · ${esc(asset.code)}</small></span></span><span class="structure-step ${signal.direction}">${signal.direction==='up'?'上涨':'下跌'} <b>${signal.count}</b><span> / 9</span></span><span class="structure-date">${esc(date)}<small>${today?'当日日线 · 未确认':signal.count===9?'已结束日线 · 九转完成':'日线序列 · 发展中'}</small></span><span class="structure-open">查看 K 线 →</span></button></li>`).join('')+'</ul>';
 const markup=`<h3 class="structure-section-title">最新达到 9 <span>${summary.completed.length} 个</span></h3>${summary.completed.length?rows(summary.completed):'<p class="structure-empty">'+(busy?'扫描中，尚未发现最新达到 9 的标的。':'当前可用行情中，暂无最新一根达到 9 的标的。')+'</p>'}<h3 class="structure-section-title">正在形成 6–8 <span>${summary.items.length} 个</span></h3>${shown.length?rows(shown):'<p class="structure-empty">'+(busy?'正在扫描日线…':'当前可用行情中，暂无发展中的 6–8 序列。')+'</p>'}`;
 if(root.innerHTML!==markup){root.innerHTML=markup;restoreFocus(root,focus);}
 const toggle=$('#structure-toggle');toggle.hidden=summary.items.length<=6;toggle.textContent=structureExpanded?'收起':`展开全部 ${summary.items.length} 个`;toggle.setAttribute('aria-expanded',String(structureExpanded));
 $('#structure-status').textContent=`${busy?'扫描进度':'已检查'} ${summary.checked} / ${summary.total} 个标的${summary.unavailable?` · ${summary.unavailable} 个行情失效或缺失，未纳入候选`:''} · 仅检查最新日线；形成中按 8 → 7 → 6 排序`;
}
$('#structure-toggle').addEventListener('click',()=>{structureExpanded=!structureExpanded;renderStructureWatch()});
function render(){
 renderComparison(assets,records);
 renderPerformance(assets,records,busy);
 renderStructureWatch();
 const rowFocus=captureFocus($('#table-body'));
 const cols=columns();const list=visible();const ps=period==='both'?['week','month']:[period];
 $('#table-head').innerHTML='<tr><th>资产 / 代码</th><th>周期</th><th>最新日线<small>价格 / 收益率</small></th>'+cols.map(c=>`<th scope="col" class="level-heading ${c[0].toLowerCase()}"><span class="level-heading-content"><strong>${c}</strong><small>${c==='P'?'多空轴心':(c[0]==='R'?'阻力':'支撑')+' · '+c.slice(1)}</small></span></th>`).join('')+'<th>行情状态 / 日期</th><th>原图 ETF 参考</th></tr>';
 $('#table-body').innerHTML=groups.map(g=>{const subset=list.filter(a=>a.group===g);if(!subset.length)return '';return `<tr class="group-row"><td colspan="${cols.length+5}">${icon(marketIcon(g))}${g} <span> / ${subset.length} ASSETS</span></td></tr>`+subset.map(a=>{
 const r=records.get(a.id);return ps.map(p=>{const calc=selected(r,p);let status=r?(r.status==='error'?'获取失败':r.status==='stale'?(r.statusLabel||'刷新失败 / 缓存'):'已获取'):'连接中';if(r&&r.status!=='error'&&!calc?.levels)status='周期数据不足';
 return `<tr><td class="asset"><div class="asset-wrap"><button class="star ${stars.has(a.id)?'on':''}" data-star="${a.id}" aria-label="${stars.has(a.id)?'取消关注':'关注'} ${esc(a.name)}" aria-pressed="${stars.has(a.id)}">${icon('star')}</button><button class="asset-button" data-detail="${a.id}" data-p="${p}"><span class="asset-name" title="${esc(a.name)}">${esc(a.name)}</span><span class="asset-code">${esc(a.code)} · ${esc(a.unit)}</span><span class="asset-status ${r?.status==='stale'||r?.status==='error'||(r&&!calc?.levels)?'warn':''}">${status}</span></button></div></td><td class="period-label">${p==='week'?'周度':'月度'} · ${calc?.selection==='next'?'下期':'本期'}<small>适用 ${calc?.effectiveStart||'—'}<br>至 ${calc?.effectiveEnd||'—'}</small></td><td class="quote">${fmt(r?.latest?.close,a)}<small>${r?.latest?.date||'—'}</small></td>`+
 cols.map(c=>`<td class="${c[0].toLowerCase()} ${r?'':'loading'}">${fmt(calc?.levels?.[c],a)}</td>`).join('')+
 `<td class="status-cell ${r?.status==='error'||r?.status==='stale'||(r&&!calc?.levels)?'warn':''}"><strong title="${esc(calc?.selectionReason||'')}">${status}</strong><small>${esc(r?.source||r?.error||'正在请求真实行情')}</small></td><td class="etfs">${esc(a.etfs||'—')}</td></tr>`}).join('')}).join('')}).join('');
 $('#empty').hidden=list.length>0;$('#empty-message').textContent=favoritesOnly&&!stars.size?'还没有关注资产。点击资产旁的星标，即可加入关注。':'没有匹配的资产。清除搜索和市场筛选后重新查看。';$('#clear-filters').hidden=!($('#search').value||group!=='全部'||favoritesOnly||statusFilter!=='all');$('#result-count').textContent=list.length;
 $('#board-title').firstChild.textContent=favoritesOnly?'我的关注 ':group==='全部'?'市场全景 ':group+' ';
 const successful=[...records.values()].filter(r=>r.status!=='error');
 $('#loaded-count').innerHTML=`${successful.length}<small>/ ${assets.length}</small>`;
 $('#valid-count').innerHTML=`<span><small>周</small> ${successful.filter(r=>selected(r,'week')?.levels).length}</span><span><small>月</small> ${successful.filter(r=>selected(r,'month')?.levels).length}</span>`;
 $('#progress-note').textContent=busy?`已完成 ${records.size} / ${assets.length} 项请求`:`${records.size-successful.length} 项失败 · ${successful.filter(r=>r.status==='stale').length} 项待更新`;
 for(const state of ['error','stale']){const button=document.querySelector(`[data-status="${state}"]`);button.querySelector('span').textContent=[...records.values()].filter(r=>r.status===state).length;button.setAttribute('aria-pressed',String(statusFilter===state))}
 $('#filter-note').textContent=statusFilter==='all'?'':statusFilter==='error'?'仅显示获取失败的资产':'仅显示旧数据 / 缓存资产';
 $('#star-count').textContent=stars.size;
 $('#mobile-stars').innerHTML=icon(favoritesOnly?'layers':'star')+(favoritesOnly?'全部资产':'我的关注');
 $('#overview').classList.toggle('active',!favoritesOnly);$('#watchlist').classList.toggle('active',favoritesOnly);
 document.querySelectorAll('[data-group]').forEach(b=>{b.classList.toggle('selected',b.dataset.group===group);b.setAttribute('aria-pressed',String(b.dataset.group===group&&!favoritesOnly))});
 document.querySelectorAll('.market-link').forEach(b=>b.classList.toggle('active',b.dataset.group===group));
 $('#overview').setAttribute('aria-pressed',String(!favoritesOnly));$('#watchlist').setAttribute('aria-pressed',String(favoritesOnly));$('#mobile-stars').setAttribute('aria-pressed',String(favoritesOnly));restoreFocus($('#table-body'),rowFocus);renderPage();
}
async function refresh(force=false){if(busy)return;busy=true;$('#refresh').disabled=true;$('#refresh').innerHTML=icon('refresh')+'更新中…';render();let index=0;
 async function worker(){while(index<assets.length){const a=assets[index++];try{const response=await fetch('/api/asset/'+a.id+(force?'?refresh=1':''),{signal:AbortSignal.timeout(65000)});if(!response.ok)throw new Error();records.set(a.id,await response.json());if($('#detail').open&&chartState.id===a.id)showDetail(a.id,chartState.p,chartState)}catch{const old=records.get(a.id);records.set(a.id,old?.latest?{...old,status:'stale',error:'请求失败，保留上次结果'}:{...a,status:'error',error:'服务连接失败或请求超时'})}render()}}
 await Promise.all(Array.from({length:4},worker));busy=false;$('#refresh').disabled=false;$('#refresh').innerHTML=icon('refresh')+'刷新行情';render();$('#announcements').textContent='行情加载完成。'+$('#progress-note').textContent+'。九转观察有 '+structureWatch(assets,records).items.length+' 个发展中序列，'+structureWatch(assets,records).completed.length+' 个最新达到9的标的。';
}
let chartState={id:null,p:'week',count:40,depth:3};
function showDetail(id,p,options={}){
 const detailFocus=captureFocus($('#detail-content'));const dialogScroll=$('#detail').scrollTop;
 chartState={id,p,count:40,depth:3,...options};
 const a=assets.find(x=>x.id===id),r=records.get(id),d=selected(r,p);
 $('#detail-content').innerHTML=`<div class="eyebrow">${esc(a.group)} / ${esc(a.code)}</div><h2 id="detail-title">${esc(a.name)} <small>${p==='week'?'周度':'月度'} · ${viewMode==='reference'?'交易参考':'本期回看'}${d?.selection==='next'?' · 下期':''}</small></h2><div class="segmented detail-view" role="group" aria-label="图表点位用途"><button data-view="reference" aria-pressed="${viewMode==='reference'}" class="${viewMode==='reference'?'selected':''}">交易参考</button><button data-view="review" aria-pressed="${viewMode==='review'}" class="${viewMode==='review'?'selected':''}">本期回看</button></div>${a.note?`<div class="error-box">${esc(a.note)}</div>`:''}${r?.error?`<p>${esc(r.error)}；失败后 60 秒内暂不重复请求。</p>`:''}${r?.freshnessReason?`<p>${esc(r.freshnessReason)}</p>`:''}<div class="chart-toolbar"><div class="chart-type">${a.provider==='bond'?'收益率曲线':'日 K 线'} <small> / ${esc(a.unit)}</small></div><div class="chart-controls"><div class="segmented" role="group" aria-label="图表枢轴周期"><button data-chart-period="week" aria-pressed="${p==='week'}" class="${p==='week'?'selected':''}">周度点位</button><button data-chart-period="month" aria-pressed="${p==='month'}" class="${p==='month'?'selected':''}">月度点位</button></div><select id="chart-count" aria-label="图表日线数量">${[20,40,65].map(n=>`<option value="${n}" ${chartState.count===n?'selected':''}>最近 ${n} 根</option>`).join('')}</select><label class="chart-depth"><input id="chart-depth" type="checkbox" ${chartState.depth===5?'checked':''}> 五级点位</label></div></div><div id="price-chart"></div><div class="chart-caption"><span>${a.provider==='bond'?'每日收益率观测值，无开盘价。':'红涨绿跌 · Tab 进入图表，左右方向键切换日期；也可悬停或点击，窄屏可左右滑动。'}</span><span>蓝：阻力 R · 橙红：轴心 P · 绿：支撑 S · 九转数字：上方上涨序列，下方下跌序列</span></div><p class="chart-context">神奇九转：收盘价连续高于或低于前第 4 根，达到第 6 根时显示 1–6，第 7、8 根满足则追加；第 9 根前中断，整组数字撤销。完成 9 后保留。发展中及当日日线数字可能变化；1–5 为回溯标注，不含 13 倒计时。</p><p class="chart-context">${d?.levels?`${d.selection==='next'?'下期参考':'本期'}点位适用 ${d.effectiveStart} — ${d.effectiveEnd}。${esc(d.selectionReason||'')}。历史线按各自周期绘制，下期线仅显示在右侧预览区。`:'该周期暂无有效点位，仅显示已有行情。'}</p>`+
 (d?.levels?`<h3>原始计算输入 <small> / ${esc(a.unit)}</small></h3><div class="detail-meta"><div>最高价 H<strong>${fmt(d.high,a)}</strong></div><div>最低价 L<strong>${fmt(d.low,a)}</strong></div><div>收盘价 C<strong>${fmt(d.close,a)}</strong></div></div><div class="detail-levels">${['S2','S1','P','R1','R2'].map(k=>`<div class="${k[0].toLowerCase()}">${k}<strong>${fmt(d.levels[k],a)}</strong></div>`).join('')}</div><p>原始周期：${d.sourceStart} — ${d.sourceEnd}<br>可用日线：${d.firstBar} — ${d.lastBar}，共 ${d.barCount} 条<br>价位适用：${d.effectiveStart} — ${d.effectiveEnd}</p>`:`<div class="error-box">${esc(d?.error||'暂未获得可用于该周期计算的真实行情。')}</div>`)+
 `<div class="source-line">来源：${esc(r?.source||'待获取')} · ${esc(r?.upstreamSymbol||a.symbol||a.code)}<br>日期处理时区：${esc(r?.timezone||'—')}${r?.sessionNote?`<br>${esc(r.sessionNote)}`:''}<br>服务端获取时间：${r?.fetchedAt?new Date(r.fetchedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'（北京时间）':'—'}<br>日线日期：${esc(r?.latest?.date||'—')} · 状态：${r?.status==='stale'?esc(r.statusLabel||'待更新'):r?.status==='ok'?'已获取':'未就绪'}</div>${r?.sourceUrl?`<p><a href="${esc(r.sourceUrl)}" target="_blank" rel="noreferrer">查看行情来源 ↗</a></p>`:''}`;
 mountChart($('#price-chart'),r?.history||[],d?.levels||{},{...chartState,asOf:r?.asOf,effectiveStart:d?.effectiveStart,effectiveEnd:d?.effectiveEnd,lineOnly:a.provider==='bond',historical:r?.historicalPivots?.[p]||[]},v=>fmt(v,a));
 if(!$('#detail').open)$('#detail').showModal();
 else {restoreFocus($('#detail-content'),detailFocus);$('#detail').scrollTop=dialogScroll;}
}
$('#table-body').addEventListener('click',e=>{const star=e.target.closest('[data-star]');if(star){const id=star.dataset.star;stars.has(id)?stars.delete(id):stars.add(id);try{localStorage.setItem('pivot-stars',JSON.stringify([...stars]))}catch{toast('浏览器未允许保存关注列表')}render();return}const b=e.target.closest('[data-detail]');if(b)showDetail(b.dataset.detail,b.dataset.p)});
$('#detail-content').addEventListener('click',e=>{const b=e.target.closest('[data-chart-period]');if(b)showDetail(chartState.id,b.dataset.chartPeriod,{...chartState,p:b.dataset.chartPeriod})});
$('#detail-content').addEventListener('change',e=>{if(e.target.id==='chart-count')showDetail(chartState.id,chartState.p,{...chartState,count:Number(e.target.value)});if(e.target.id==='chart-depth')showDetail(chartState.id,chartState.p,{...chartState,depth:e.target.checked?5:3})});
function clearFilters(){statusFilter='all';favoritesOnly=false;group='全部';$('#search').value='';render();$('#search').focus();$('#announcements').textContent='已清除筛选，显示全部资产。'}
$('#clear-filters').onclick=clearFilters;$('#reset-empty').onclick=clearFilters;
$('#detail').addEventListener('close',()=>{if(performanceReturn){const target=$('#performance-page').querySelector(`[data-asset="${performanceReturn}"]`);performanceReturn=null;(target||$('#performance-nav')).focus({preventScroll:true});return}if(structureReturn){const target=$('#structure-list').querySelector(`[data-detail="${structureReturn}"]`);structureReturn=null;(target||$('#structure-toggle:not([hidden])')||$('#structure-nav')).focus({preventScroll:true});return}const target=$('#table-body').querySelector(`[data-detail="${chartState.id}"][data-p="${chartState.p}"]`)||$('#table-body').querySelector(`[data-detail="${chartState.id}"]`);(target||$('#search')).focus({preventScroll:true})});
$('#search').addEventListener('input',render);$('#extended').addEventListener('change',render);$('#refresh').addEventListener('click',()=>refresh(true));
$('#mobile-stars').onclick=()=>{favoritesOnly=!favoritesOnly;group='全部';render()};
$('#overview').onclick=()=>{navigatePage('board');statusFilter='all';favoritesOnly=false;group='全部';render()};$('#watchlist').onclick=()=>{navigatePage('board');favoritesOnly=true;group='全部';render()};
for(const id of ['help','method','source-nav'])$('#'+id).onclick=()=>$('#info').showModal();
for(const dialog of document.querySelectorAll('dialog')){dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('click',e=>{if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close()}})}
document.querySelectorAll('[data-period]').forEach(b=>b.onclick=()=>{period=b.dataset.period;document.querySelectorAll('[data-period]').forEach(el=>{el.classList.toggle('selected',el===b);el.setAttribute('aria-pressed',String(el===b))});render()});
document.addEventListener('click',e=>{const mode=e.target.closest('[data-view]');if(mode){viewMode=mode.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===viewMode);b.setAttribute('aria-pressed',String(b.dataset.view===viewMode))});render();if($('#detail').open)showDetail(chartState.id,chartState.p,chartState);return}const b=e.target.closest('[data-group]');if(b){if(location.hash==='#performance'){const market=$('#performance-market');market.value=b.dataset.group==='全部'?'all':b.dataset.group;market.dispatchEvent(new Event('change',{bubbles:true}));$('#performance-page').scrollIntoView({block:'start'});return}navigatePage('board');group=b.dataset.group;favoritesOnly=false;statusFilter='all';$('#search').value='';render();$('.board').scrollIntoView({block:'start'})}});
$('#export').onclick=()=>{const cols=['R5','R4','R3','R2','R1','P','S1','S2','S3','S4','S5'];const rows=[['资产','代码','分组','单位','周期','用途','状态','来源','日线日期','获取时间','原始周期开始','原始周期结束','适用开始','适用结束','H','L','C',...cols]];for(const a of visible()){const r=records.get(a.id);for(const p of (period==='both'?['week','month']:[period])){const d=selected(r,p);rows.push([a.name,a.code,a.group,a.unit,p,viewMode,r?.status||'pending',r?.source||'',r?.latest?.date||'',r?.fetchedAt||'',d?.sourceStart||'',d?.sourceEnd||'',d?.effectiveStart||'',d?.effectiveEnd||'',d?.high??'',d?.low??'',d?.close??'',...cols.map(c=>d?.levels?.[c]??'')])}}if(rows.length===1)return toast('当前没有可导出的资产');const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');const u=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=u;link.download=`pivot-atlas-${period}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('已导出当前筛选结果（含缺失状态）')};
renderPage();
try{assets=await(await fetch('/api/assets')).json();$('#asset-count').innerHTML=`${assets.length}<small>个</small>`;$('#market-nav').innerHTML=groups.map(g=>`<button class="market-link" data-group="${g}"><span>${icon(marketIcon(g))}${g}</span><small>${assets.filter(a=>a.group===g).length.toString().padStart(2,'0')}</small></button>`).join('');render();refresh()}catch{$('#progress-note').textContent='无法连接本地服务，请启动 server.py';toast('行情服务未启动')}

document.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>{statusFilter=statusFilter===b.dataset.status?'all':b.dataset.status;group='全部';favoritesOnly=false;$('#search').value='';render();$('.board').scrollIntoView({block:'start'});$('#announcements').textContent=$('#filter-note').textContent||'显示全部状态';});
