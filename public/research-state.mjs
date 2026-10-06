export function validConfig(value,ids){
 if(!value||!Array.isArray(value.selection)||value.selection.length<2||value.selection.length>4||new Set(value.selection).size!==value.selection.length||value.selection.some(id=>!ids.includes(id))||![30,90,180].includes(value.days))return null;
 const range=value.range||{};
 if((range.start||range.end)&&(!validDate(range.start)||!validDate(range.end)||range.start>=range.end))return null;
 return {selection:[...value.selection],days:value.days,range:range.start?{start:range.start,end:range.end}:{}};
}
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
