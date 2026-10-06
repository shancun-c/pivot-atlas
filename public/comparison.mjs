import {researchSeries} from './research-series.mjs';
import {validDate} from './research-state.mjs';
import {change} from './performance.mjs';
const day=86400000;
export function correlation(x,y){
 if(x.length!==y.length||x.length<20||!x.every(Number.isFinite)||!y.every(Number.isFinite))return null;
 const mx=x.reduce((a,b)=>a+b,0)/x.length,my=y.reduce((a,b)=>a+b,0)/y.length;
 let cov=0,vx=0,vy=0;for(let i=0;i<x.length;i++){cov+=(x[i]-mx)*(y[i]-my);vx+=(x[i]-mx)**2;vy+=(y[i]-my)**2}
 return vx<1e-18||vy<1e-18?null:Math.max(-1,Math.min(1,cov/Math.sqrt(vx*vy)));
}
export function compareAssets(assets,records,days=90,range={}){
 if(assets.length<2||assets.length>4||new Set(assets.map(a=>a.id)).size!==assets.length)return {error:'请选择2–4个不同的标的。'};
 const series=[];
 for(const asset of assets){
  const r=records.get(asset.id);
  if(!r||r.status!=='ok'||r.error||!r.asOf)return {error:`${asset.name}：${r?.statusLabel||r?.error||'等待有效行情'}。本组对照暂不计算。`};
  const research=researchSeries(asset,r);if(research.error)return {error:`${asset.name}：${research.error}`} ;
  const bars=research.history.filter(b=>b.date<r.asOf);
  if(!bars.length||bars.some((b,i)=>!Number.isFinite(b.close)||(asset.unit!=='%'&&b.close<=0)||(i&&b.date<=bars[i-1].date)))return {error:`${asset.name}：日线不足、顺序异常或价格非正。`};
  series.push({asset,bars,map:new Map(bars.map(b=>[b.date,b.close])),source:research.source,basis:research.label,latest:bars.at(-1).date});
 }
 const end=range.end||series.map(s=>s.latest).sort()[0];
 const start=range.start||new Date(Date.parse(end+'T00:00:00Z')-days*day).toISOString().slice(0,10);
 if(range.start||range.end){if(!validDate(range.start)||!validDate(range.end)||start>=end)return {error:'请选择有效的起止日期。'};const missing=series.filter(s=>!s.map.has(start)||!s.map.has(end));if(missing.length)return {error:`锁定区间 ${start} — ${end}：${missing.map(s=>s.asset.name).join('、')} 缺少起点或终点观测，请明确调整日期。`};}
 const dates=series[0].bars.map(b=>b.date).filter(d=>d>=start&&d<=end&&series.every(s=>s.map.has(d)));
 if(dates.length<2)return {error:'选定窗口内共同日期少于2个，请扩大窗口或更换标的。'};
 const lines=series.map(s=>{
  const raw=dates.map(d=>s.map.get(d)),yieldMode=s.asset.unit==='%',base=raw[0];
  const values=raw.map(v=>yieldMode?(v-base)*100:v/base*100);
  const changes=raw.slice(1).map((v,i)=>change(v,raw[i],yieldMode));
  return {...s,raw,values,changes,unit:yieldMode?'bp':'%',result:change(raw.at(-1),base,yieldMode),excluded:s.bars.filter(b=>b.date>=dates[0]&&b.date<=dates.at(-1)&&!dates.includes(b.date)).length};
 });
 const pairs=[];for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++)pairs.push({a:lines[i].asset.name,b:lines[j].asset.name,value:correlation(lines[i].changes,lines[j].changes),n:dates.length-1});
 return {dates,lines,pairs,start,end,shortened:dates[0]>start,intervals:dates.length-1};
}
