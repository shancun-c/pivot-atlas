import {validDate} from './research-state.mjs';
export const indicators=[
 {id:'short',group:'政策预期与曲线',name:'美国 2 年期收益率',inputs:['nominal'],fields:['BC_2YEAR'],unit:'%',note:'观察短端利率定价；它还包含期限溢价，不等于未来政策利率路径。'},
 {id:'slope',group:'政策预期与曲线',name:'美国 10Y − 2Y 利差',inputs:['nominal','nominal'],fields:['BC_10YEAR','BC_2YEAR'],unit:'bp',note:'同日名义收益率之差。曲线变陡或变平需要结合两端变化解释，不直接判定增长方向。'},
 {id:'real',group:'实际利率与通胀定价',name:'美国 10 年期实际收益率',inputs:['real'],fields:['TC_10YEAR'],unit:'%',note:'财政部TIPS实际收益率曲线；允许负值，不是名义收益率减去当期CPI。'},
 {id:'breakeven',group:'实际利率与通胀定价',name:'10 年期盈亏平衡通胀代理',inputs:['nominal','real'],fields:['BC_10YEAR','TC_10YEAR'],unit:'%',note:'同日名义10Y减实际10Y。含通胀风险与流动性溢价，不是纯通胀预测；本站计算，非直接下载FRED T10YIE。'},
 {id:'growth',group:'跨资产相对强弱',name:'纳斯达克100 / 标普500',inputs:['ndx','spx'],ratio:true,unit:'起点100',note:'指数价格比值标准化。上升仅表示纳指相对标普更强；指数成分重叠，非纯成长因子或组合回报。'},
 {id:'copperGold',group:'跨资产相对强弱',name:'COMEX 铜 / 黄金',inputs:['hg','gc'],ratio:true,unit:'起点100',note:'美元/磅铜价除以美元/盎司金价，再标准化。连续近月换月可能造成跳变，非可交易价差，也不是独立增长预测。'}
];
export function macroIndicator(def,treasury,records,days=90,alignedDates=null){
 const dependencies=def.inputs.map((id,i)=>{
  const r=def.ratio?records.get(id):treasury?.[id];
  const raw=(r?.history||[]).filter(b=>!def.ratio||b.date<r.asOf).filter(b=>def.ratio||b[def.fields[i]]!==undefined);
  return {id,r,bars:raw.map(b=>({date:b.date,value:def.ratio?b.close:b[def.fields[i]]}))};
 });
 const sources=dependencies.map(({id,r,bars})=>({id,name:r?.source||id,url:r?.sourceUrl,date:bars.at(-1)?.date,fetchedAt:r?.fetchedAt,status:r?.status||'loading'}));
 const fail=(error,errorKind='invalid')=>({...def,error,errorKind,sources});
 for(const {id,r,bars} of dependencies){
  if(!r)return fail('等待 '+id+' 数据','loading');
  if(r.status!=='ok'||r.error)return fail((r.source||id)+'：'+(r.error||r.statusLabel||'来源不可用'),'source');
  if(def.ratio&&!r.asOf)return fail(id+'：缺少日线日期边界');
  if(!bars.length||bars.some((b,i)=>!validDate(b.date)||!Number.isFinite(b.value)||(def.ratio&&b.value<=0)||(i>0&&b.date<=bars[i-1].date)))return fail(id+'：观测缺失、顺序异常或数值无效');
 }
 const end=dependencies.map(s=>s.bars.at(-1).date).sort()[0];
 const requestedStart=new Date(Date.parse(end+'T00:00:00Z')-days*86400000).toISOString().slice(0,10);
 const maps=dependencies.map(s=>new Map(s.bars.map(b=>[b.date,b.value])));
 const dates=dependencies[0].bars.map(b=>b.date).filter(d=>(alignedDates?alignedDates.includes(d):d>=requestedStart&&d<=end)&&maps.every(m=>m.has(d)));
 if(dates.length<2)return fail('窗口内不足两个共同日期；请扩大窗口或核查来源。','history');
 const components=dates.map(d=>maps.map(m=>m.get(d)));
 const raw=dates.map(d=>{const v=maps.map(m=>m.get(d));return def.ratio?v[0]/v[1]:v.length===1?v[0]:(v[0]-v[1])*(def.unit==='bp'?100:1)});
 if(!raw.every(Number.isFinite))return fail('计算结果非有限值');
 const values=def.ratio?raw.map(v=>v/raw[0]*100):raw;
 const delta=def.ratio?(raw.at(-1)/raw[0]-1)*100:(raw.at(-1)-raw[0])*(def.unit==='%'?100:1);
 return {...def,sources,dates,raw,values,components,delta,deltaUnit:def.ratio?'%':'bp',latest:values.at(-1),requestedStart,
  omitted:dependencies.map(s=>s.bars.filter(b=>b.date>=dates[0]&&b.date<=dates.at(-1)&&!dates.includes(b.date)).length)};
}

// Common mode uses the intersection of all six indicators before setting the window.
export function macroStudy(treasury,records,days=90,common=true){
 if(!common)return indicators.map(d=>macroIndicator(d,treasury,records,days));
 const full=indicators.map(d=>macroIndicator(d,treasury,records,10000));
 const failed=full.filter(r=>r.error);
 const fail=(message,errorKind='history')=>full.map(r=>({...r,error:message,errorKind,dates:undefined}));
 if(failed.length){const kind=failed.some(r=>r.errorKind==='source')?'source':failed.some(r=>r.errorKind==='loading')?'loading':failed[0].errorKind;return fail(kind==='loading'?'正在加载共同日期所需数据，请稍候。':'共同日期不可用：'+failed.map(r=>r.name+'（'+r.error+'）').join('；')+'。可切换独立日期查看其余指标。',kind)}
 const sets=full.map(r=>new Set(r.dates));
 let dates=full[0].dates.filter(d=>sets.every(s=>s.has(d)));
 if(dates.length<2)return fail('全部指标不足两个共同日期；请切换各图独立日期。');
 const start=new Date(Date.parse(dates.at(-1)+'T00:00:00Z')-days*86400000).toISOString().slice(0,10);
 dates=dates.filter(d=>d>=start);
 if(dates.length<2)return fail('所选窗口不足两个共同日期；请扩大窗口。');
 return indicators.map(d=>({...macroIndicator(d,treasury,records,days,dates),requestedStart:start}));
}
export function macroBreakdown(r){
 if(r.error)return null;
 const first=r.components[0],last=r.components.at(-1);
 const change=first.map((v,i)=>r.ratio?(last[i]/v-1)*100:(last[i]-v)*100);
 if(r.id==='slope')return {labels:['2Y 变化','10Y 变化','利差变化'],values:[change[1],change[0],r.delta],unit:'bp',formula:'利差变化 = 10Y 变化 − 2Y 变化'};
 if(r.id==='breakeven')return {labels:['实际利率变化','盈亏平衡变化','名义10Y变化'],values:[change[1],r.delta,change[0]],unit:'bp',formula:'名义10Y变化 = 实际利率变化 + 盈亏平衡变化'};
 if(r.ratio)return {labels:r.id==='growth'?['纳斯达克100','标普500','比值变化']:['COMEX 铜','COMEX 黄金','比值变化'],values:[...change,r.delta],unit:'%',formula:'比值变化 = (1 + 分子涨跌幅) ÷ (1 + 分母涨跌幅) − 1；不能直接相减'};
 return null;
}
export function macroComparison(r){
 if(r.error||!r.ratio)return null;
 return {selection:r.inputs,days:90,range:{start:r.dates[0],end:r.dates.at(-1)},origin:'来自宏观传导 · 已锁定比值研究区间。'};
}

export function macroRecent(r,periods=[1,5,20]){
 return periods.map(n=>{
  if(r.error||!r.dates||r.dates.length<=n)return {n,error:'不足 '+(n+1)+' 个有效观测'};
  const i=r.dates.length-1-n,last=r.raw.at(-1),first=r.raw[i];
  return {n,start:r.dates[i],end:r.dates.at(-1),value:r.ratio?(last/first-1)*100:(last-first)*(r.unit==='%'?100:1),unit:r.ratio?'%':'bp'};
 });
}
export function macroRefreshInputs(group,common){
 return [...new Set(indicators.filter(r=>common||r.group===group).flatMap(r=>r.inputs))];
}
export function macroNearestDate(dates,date){
 const target=Date.parse(date);if(!dates.length||!Number.isFinite(target))return -1;
 let best=0;for(let i=1;i<dates.length;i++)if(Math.abs(Date.parse(dates[i])-target)<Math.abs(Date.parse(dates[best])-target))best=i;
 return best;
}
