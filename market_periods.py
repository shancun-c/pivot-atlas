"""Calendar-aware point selection. Never advance on weekday heuristics alone."""
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from zoneinfo import ZoneInfo
import pandas_market_calendars as mcal
from pivots import aggregate, window

# OTC fixings and China futures need source-specific session/publication calendars.
# Do not substitute an equity calendar for these products.
SPECIFIC={'nikkei':'JPX','kospi':'XKRX','ewz':'NYSE',
          'gc':'CMEGlobex_GC','si':'CMEGlobex_SI','hg':'CMEGlobex_HG',
          'ali':'CMEGlobex_ALI','cl':'CMEGlobex_CL','ng':'CMEGlobex_NG',
          'zs':'CMEGlobex_Oilseeds','zw':'CMEGlobex_Grains','zc':'CMEGlobex_Grains'}


def calendar_name(asset):
    if asset.get('group')=='加密货币':return 'CRYPTO_24_7'
    return SPECIFIC.get(asset['id']) or {'港股':'HKEX','美股':'NYSE','A股':'SSE'}.get(asset.get('group'))


@lru_cache(maxsize=40)
def calendar(name):
    return mcal.get_calendar(name)


@lru_cache(maxsize=100)
def year_sessions(name,year):
    frame=calendar(name).schedule(start_date=f'{year}-01-01',end_date=f'{year}-12-31')
    return {str(day.date()):row.market_close.to_pydatetime() for day,row in frame.iterrows()}


def sessions(name,start,end):
    result={}
    if name=='CRYPTO_24_7':
        day=start
        while day<=end:
            result[str(day)]=datetime.combine(day+timedelta(days=1),datetime.min.time(),tzinfo=timezone.utc)
            day+=timedelta(days=1)
        return result
    for year in range(start.year,end.year+1):
        result.update({d:c for d,c in year_sessions(name,year).items() if str(start)<=d<=str(end)})
    return result


def checked_aggregate(bars, anchor, period, name):
    prev,start,end=window(anchor,period)
    result=aggregate(bars,anchor,period)
    if not name:
        return {**result,'calendarVerified':False}
    expected=sessions(name,prev,start-timedelta(days=1))
    available={b['date'] for b in bars}
    missing=sorted(set(expected)-available)
    if not expected or missing:
        result.pop('levels',None)
        result['error']='源周期无交易日' if not expected else '源周期缺少日线：'+', '.join(missing)
        return {**result,'calendarVerified':False}
    result=aggregate([b for b in bars if b['date'] in expected],anchor,period)
    return {**result,'calendarVerified':True}


def build_views(asset, data, now=None):
    now=now or datetime.now(timezone.utc)
    name=calendar_name(asset)
    try:
        tz='UTC' if name=='CRYPTO_24_7' else str(calendar(name).tz) if name else data['timezone']
        today=now.astimezone(ZoneInfo(tz)).date()
        if name and name!='CRYPTO_24_7':year_sessions(name,today.year)
    except Exception:
        name=None;tz=data['timezone'];today=now.astimezone(ZoneInfo(tz)).date()
    fetched=datetime.fromisoformat(data['fetchedAt'])
    views={'reference':{},'review':{}}
    history={}
    for period in ('week','month'):
        base=checked_aggregate(data['bars'],today,period,name)
        base.update(selection='current',calendar=name,periodTimezone=tz)
        views['review'][period]={**base,'selectionReason':'本期回看：当前自然周期适用点位'}
        reference={**base,'selectionReason':'周期尚未结束，使用本期点位'}
        _,start,end=window(today,period)
        if not name:
            reference['selectionReason']='该品种尚无已核验的交易／发布日历，不提前切换；按自然周期显示'
        else:
            expected=sessions(name,start,end-timedelta(days=1))
            if expected:
                last=max(expected)
                # Allow 15 minutes for a final daily bar to be published.
                ready=expected[last]+timedelta(minutes=15)
                reference['finalSession']=last
                reference['confirmedAfter']=ready.isoformat()
                if now>=ready:
                    candidate=checked_aggregate(data['bars'],end,period,name)
                    if fetched<ready:
                        reference['selectionReason']='已收盘，等待收盘后重新获取日线'
                    elif not candidate.get('levels'):
                        reference['selectionReason']='已收盘，等待完整日线：'+candidate.get('error','数据不足')
                    else:
                        reference={**candidate,'selection':'next','selectionReason':'最后交易日已收盘且日线齐全，展示下期参考',
                                   'calendar':name,'periodTimezone':tz,'finalSession':last,'confirmedAfter':ready.isoformat()}
            else:
                reference['selectionReason']='本周期无交易日，保留本期点位'
        views['reference'][period]=reference
        # Each historical window uses only its immediately preceding period.
        anchors=sorted({window(date.fromisoformat(b['date']),period)[1] for b in data['bars'][-65:]})
        history[period]=[]
        for anchor in anchors:
            if anchor>today:continue
            item=checked_aggregate(data['bars'],anchor,period,name)
            if item.get('levels'):
                history[period].append(item)
    return views,history
