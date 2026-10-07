"""Official Treasury daily curves, isolated from asset quote/pivot caches."""
import json
import math
import subprocess
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

BASE='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml'
KINDS={'nominal':('daily_treasury_yield_curve',('BC_2YEAR','BC_10YEAR')),
       'real':('daily_treasury_real_yield_curve',('TC_10YEAR',))}
LOCKS={key:threading.Lock() for key in KINDS}
FAILURES={}


def parse_curve(xml, fields, allow_empty=False):
    root=ET.fromstring(xml)
    rows={}
    for properties in root.iter():
        if properties.tag.rsplit('}',1)[-1]!='properties':continue
        values={el.tag.rsplit('}',1)[-1]:el.text for el in properties}
        day=(values.get('NEW_DATE') or '')[:10]
        if not day:continue
        if datetime.strptime(day,'%Y-%m-%d').date().isoformat()!=day:raise ValueError('日期格式异常')
        row={'date':day}
        for field in fields:
            raw=values.get(field)
            if raw in (None,'','.'):continue
            value=float(raw)
            if not math.isfinite(value):raise ValueError('利率包含无效数值')
            row[field]=value
        if len(row)>1:
            if day in rows:raise ValueError('利率日期重复')
            rows[day]=row
    if not rows and not (allow_empty and root.tag.rsplit('}',1)[-1]=='feed' and not any(el.tag.rsplit('}',1)[-1]=='entry' for el in root.iter())):raise ValueError('财政部未返回有效曲线')
    return sorted(rows.values(),key=lambda row:row['date'])


def fetch_year(kind,year):
    key,fields=KINDS[kind]
    url=f'{BASE}?data={key}&field_tdr_date_value={year}'
    result=subprocess.run(['curl','-fsSL','--connect-timeout','5','--max-time','25','--user-agent','Mozilla/5.0',url],capture_output=True,text=True,timeout=28)
    if result.returncode:raise ValueError('财政部接口暂不可用')
    rows=parse_curve(result.stdout,fields,allow_empty=True)
    if any(not r['date'].startswith(str(year)+'-') for r in rows):raise ValueError('财政部返回年份不符')
    return rows


def get_curve(kind,cache_dir,force=False,now=None):
    now=now or datetime.now(timezone.utc)
    today=now.astimezone(ZoneInfo('America/New_York')).date()
    path=Path(cache_dir)/f'macro-{kind}.json'
    with LOCKS[kind]:
        cached=None
        if path.exists():
            try:cached=json.loads(path.read_text())
            except (ValueError,OSError):pass
        failure=FAILURES.get(kind)
        cooldown=failure and time.time()<failure['retryAt']
        error=failure['error'] if cooldown else None
        if not cooldown and (force or failure or not cached or time.time()-cached.get('epoch',0)>3600):
            try:
                with ThreadPoolExecutor(max_workers=2) as pool:
                    annual=list(pool.map(lambda year:fetch_year(kind,year),(today.year-1,today.year)))
                rows=sorted(annual[0]+annual[1],key=lambda row:row['date'])
                rows=[r for r in rows if r['date']<=str(today)]
                if not rows:raise ValueError('暂无已发布观测')
                if cached and rows[-1]['date']<cached['history'][-1]['date']:raise ValueError('来源日期倒退，保留缓存')
                cached={'history':rows,'epoch':time.time(),'fetchedAt':now.isoformat()}
                temp=path.with_suffix('.tmp');temp.write_text(json.dumps(cached));temp.replace(path)
                FAILURES.pop(kind,None)
            except Exception as exc:
                error=str(exc) if isinstance(exc,ValueError) else '财政部请求或缓存写入失败'
                FAILURES[kind]={'error':error,'retryAt':time.time()+60}
        rows=cached['history'] if cached else []
        lag=bool(rows and (today-datetime.fromisoformat(rows[-1]['date']).date()).days>7)
        status='error' if not rows else 'stale' if error or lag else 'ok'
        return {'status':status,'error':error or ('观测超过7个自然日，需核查发布状态' if lag else None),
                'history':rows,'latestDate':rows[-1]['date'] if rows else None,
                'fetchedAt':cached.get('fetchedAt') if cached else None,
                'cacheAgeSeconds':round(time.time()-cached['epoch']) if cached else None,
                'source':'美国财政部 · '+('名义收益率曲线' if kind=='nominal' else '实际收益率曲线'),
                'sourceUrl':'https://home.treasury.gov/treasury-daily-interest-rate-xml-feed',
                'timezone':'America/New_York','asOf':str(today)}


def get_macro(cache_dir,force=False):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda kind:(kind,get_curve(kind,cache_dir,force)),KINDS))
    return dict(results)
