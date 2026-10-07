import {validDate} from './research-state.mjs';
import {indicators,macroNearestDate} from './macro.mjs?v=20261007-macro4';
export function restoreMacroState(value){
 const groups=[...new Set(indicators.map(r=>r.group))],ids=indicators.map(r=>r.id);
 if(!value||value.version!==1)value={};
 return {version:1,group:groups.includes(value.group)?value.group:groups[0],days:[90,180,365].includes(value.days)?value.days:90,mode:value.mode==='independent'?'independent':'common',date:validDate(value.date)?value.date:null,dates:Object.fromEntries(Object.entries(value.dates||{}).filter(([id,date])=>ids.includes(id)&&validDate(date)))};
}
export function resolveMacroDate(dates,wanted){
 if(!dates?.length)return {date:null,adjusted:false};
 const date=wanted&&validDate(wanted)?dates[macroNearestDate(dates,wanted)]:dates.at(-1);
 return {date,adjusted:!!wanted&&date!==wanted};
}
