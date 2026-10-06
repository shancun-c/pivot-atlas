export const horizons=[['day','单日'],['week','本周'],['month','本月'],['oneMonth','近1月'],['threeMonths','近3月'],['year','年初至今']];
const iso=d=>d.toISOString().slice(0,10);
const date=s=>new Date(s+'T00:00:00Z');
function monthsBefore(s,n){const d=date(s),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-n);const end=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,end));return iso(d)}
const missing=reason=>({value:null,reason});
export function change(latest,base,yieldMode=false){
 if(!Number.isFinite(latest)||!Number.isFinite(base))return null;
 if(yieldMode)return (latest-base)*100;
 return latest>0&&base>0?(latest/base-1)*100:null;
}
export function performance(asset,record){
 const yieldMode=asset.unit==='%',unit=yieldMode?'bp':'%',values={};
 const fail=reason=>({asset,unit,date:null,values:Object.fromEntries(horizons.map(([key])=>[key,missing(reason)])),volatility:null,reason});
 if(!record)return fail('等待行情');
 if(record.status!=='ok'||record.error)return fail(record.statusLabel||record.error||'行情不可用');
 if(!record.asOf)return fail('缺少行情日期边界');
 // Never silently bridge malformed or duplicate source observations.
 const bars=(record.history||[]).filter(b=>b.date<record.asOf);
 if(bars.some((b,i)=>!/^\d{4}-\d{2}-\d{2}$/.test(b.date)||!Number.isFinite(b.close)||(i>0&&b.date<=bars[i-1].date)))return fail('日线顺序或数值异常');
 const last=bars.at(-1);if(!last)return fail('暂无已结束日线');
 const d=date(record.asOf),monday=date(record.asOf);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);
 const targets={week:iso(new Date(monday.getTime()-86400000)),month:iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),0))),year:`${d.getUTCFullYear()-1}-12-31`,oneMonth:monthsBefore(last.date,1),threeMonths:monthsBefore(last.date,3)};
 for(const [key] of horizons){
  const target=targets[key],base=key==='day'?bars.at(-2):bars.findLast(b=>b.date<=target);
  if(!base){values[key]=missing('历史不足');continue;}
  const anchor=target||last.date;
  if((date(anchor)-date(base.date))/86400000>10){values[key]=missing('比较基准距目标日期超过10天');continue;}
  const value=change(last.close,base.close,yieldMode);
  values[key]=value===null?missing('价格基数非正或数据无效'):{value,baseDate:base.date,endDate:last.date,base:base.close,latest:last.close};
 }
 let volatility=null;
 if(bars.length>=21){const sample=bars.slice(-21),r=sample.slice(1).map((b,i)=>change(b.close,sample[i].close,yieldMode));if(r.every(Number.isFinite)){const mean=r.reduce((a,b)=>a+b,0)/20;volatility=Math.sqrt(r.reduce((sum,x)=>sum+(x-mean)**2,0)/19)}}
 return {asset,unit,date:last.date,values,volatility,reason:null};
}
export function sortPerformance(rows,key,direction='desc'){
 return [...rows].sort((a,b)=>{const x=a.values[key]?.value,y=b.values[key]?.value;if(x==null&&y==null)return a.asset.name.localeCompare(b.asset.name,'zh-CN');if(x==null)return 1;if(y==null)return -1;return (direction==='asc'?x-y:y-x)||a.asset.name.localeCompare(b.asset.name,'zh-CN')});
}
