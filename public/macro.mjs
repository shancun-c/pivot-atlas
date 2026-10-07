import {validDate} from './research-state.mjs';
export const indicators=[
 {id:'short',group:'政策预期与曲线',name:'美国 2 年期收益率',inputs:['nominal'],fields:['BC_2YEAR'],unit:'%',note:'观察短端利率定价；它还包含期限溢价，不等于未来政策利率路径。'},
 {id:'slope',group:'政策预期与曲线',name:'美国 10Y − 2Y 利差',inputs:['nominal','nominal'],fields:['BC_10YEAR','BC_2YEAR'],unit:'bp',note:'同日名义收益率之差。曲线变陡或变平需要结合两端变化解释，不直接判定增长方向。'},
 {id:'real',group:'实际利率与通胀定价',name:'美国 10 年期实际收益率',inputs:['real'],fields:['TC_10YEAR'],unit:'%',note:'财政部TIPS实际收益率曲线；允许负值，不是名义收益率减去当期CPI。'},
 {id:'breakeven',group:'实际利率与通胀定价',name:'10 年期盈亏平衡通胀代理',inputs:['nominal','real'],fields:['BC_10YEAR','TC_10YEAR'],unit:'%',note:'同日名义10Y减实际10Y。含通胀风险与流动性溢价，不是纯通胀预测；本站计算，非直接下载FRED T10YIE。'},
 {id:'growth',group:'跨资产相对强弱',name:'纳斯达克100 / 标普500',inputs:['ndx','spx'],ratio:true,unit:'起点100',note:'指数价格比值标准化。上升仅表示纳指相对标普更强；指数成分重叠，非纯成长因子或组合回报。'},
 {id:'copperGold',group:'跨资产相对强弱',name:'COMEX 铜 / 黄金',inputs:['hg','gc'],ratio:true,unit:'起点100',note:'美元/磅铜价除以美元/盎司金价，再标准化。连续近月换月可能造成跳变，非可交易价差，也不是独立增长预测。'}
];
export function macroIndicator(def,treasury,records,days=90){
 const dependencies=def.inputs.map((id,i)=>{
  const r=def.ratio?records.get(id):treasury?.[id];
  const raw=(r?.history||[]).filter(b=>!def.ratio||b.date<r.asOf).filter(b=>def.ratio||b[def.fields[i]]!==undefined);
  return {id,r,bars:raw.map(b=>({date:b.date,value:def.ratio?b.close:b[def.fields[i]]}))};
 });
 const sources=dependencies.map(({id,r,bars})=>({id,name:r?.source||id,url:r?.sourceUrl,date:bars.at(-1)?.date,fetchedAt:r?.fetchedAt,status:r?.status||'loading'}));
 const fail=error=>({...def,error,sources});
 for(const {id,r,bars} of dependencies){
  if(!r)return fail('等待 '+id+' 数据');
  if(r.status!=='ok'||r.error)return fail((r.source||id)+'：'+(r.error||r.statusLabel||'来源不可用'));
  if(def.ratio&&!r.asOf)return fail(id+'：缺少日线日期边界');
  if(!bars.length||bars.some((b,i)=>!validDate(b.date)||!Number.isFinite(b.value)||(def.ratio&&b.value<=0)||(i>0&&b.date<=bars[i-1].date)))return fail(id+'：观测缺失、顺序异常或数值无效');
 }
 const end=dependencies.map(s=>s.bars.at(-1).date).sort()[0];
 const requestedStart=new Date(Date.parse(end+'T00:00:00Z')-days*86400000).toISOString().slice(0,10);
 const maps=dependencies.map(s=>new Map(s.bars.map(b=>[b.date,b.value])));
 const dates=dependencies[0].bars.map(b=>b.date).filter(d=>d>=requestedStart&&d<=end&&maps.every(m=>m.has(d)));
 if(dates.length<2)return fail('窗口内不足两个共同日期；请扩大窗口或核查来源。');
 const components=dates.map(d=>maps.map(m=>m.get(d)));
 const raw=dates.map(d=>{const v=maps.map(m=>m.get(d));return def.ratio?v[0]/v[1]:v.length===1?v[0]:(v[0]-v[1])*(def.unit==='bp'?100:1)});
 if(!raw.every(Number.isFinite))return fail('计算结果非有限值');
 const values=def.ratio?raw.map(v=>v/raw[0]*100):raw;
 const delta=def.ratio?(raw.at(-1)/raw[0]-1)*100:(raw.at(-1)-raw[0])*(def.unit==='%'?100:1);
 return {...def,sources,dates,raw,values,components,delta,deltaUnit:def.ratio?'%':'bp',latest:values.at(-1),requestedStart,
  omitted:dependencies.map(s=>s.bars.filter(b=>b.date>=dates[0]&&b.date<=dates.at(-1)&&!dates.includes(b.date)).length)};
}
