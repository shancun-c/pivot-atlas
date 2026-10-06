import {nineTurn} from './chart.mjs?v=20261006-td9-ths';
// Share the chart's calculation; exclude unavailable data from current candidates.
export function structureWatch(assets,records){
 const items=[],completed=[];let unavailable=0,checked=0;
 for(const asset of assets){
  const record=records.get(asset.id);if(!record)continue;
  checked++;
  if(record.status==='stale'||record.status==='error'||record.error||!record.history?.length){unavailable++;continue;}
  const signal=nineTurn(record.history,record.asOf).at(-1);
  if(signal?.count===9)completed.push({asset,signal,date:record.history.at(-1).date,today:!!signal.provisional});
  if(signal&&!signal.confirmedAt&&signal.count>=6&&signal.count<=8)items.push({asset,signal,date:record.history.at(-1).date,today:record.history.at(-1).date>=record.asOf});
 }
 items.sort((a,b)=>b.signal.count-a.signal.count||a.asset.name.localeCompare(b.asset.name,'zh-CN'));
 return {items,completed,unavailable,checked,total:assets.length};
}
