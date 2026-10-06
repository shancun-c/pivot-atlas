export const researchClasses={price:'指数 / 现货价格 · %',fund:'基金复权表现 · %',future:'期货连续报价 · %',yield:'国债收益率 · bp'};
export const researchClass=asset=>asset.researchClass||(asset.unit==='%'?'yield':'price');
export function researchSeries(asset,record){
 const kind=researchClass(asset);
 if(kind==='fund'){
  const r=record?.research;
  if(r?.status!=='ok'||r.basis!=='fund-adjusted'||!r.history?.length)return {error:r?.error||'缺少独立复权序列，请刷新行情',history:[],label:'基金复权表现'};
  return {history:r.history,label:r.label,source:r.source};
 }
 return {history:record?.history||[],label:kind==='future'?'连续报价变化（含换月影响，非持仓回报）':kind==='yield'?'到期收益率变动':'指数 / 现货价格变化',source:record?.source};
}
