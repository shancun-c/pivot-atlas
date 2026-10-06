"""Research series are separate from executable OHLC quotes."""
import math
from datetime import datetime
from zoneinfo import ZoneInfo


def yahoo_research(asset, response, bars):
    if asset.get('researchClass') != 'fund':
        return None
    try:
        adjusted=response['indicators']['adjclose'][0]['adjclose']
        timestamps=response['timestamp']
        if len(adjusted)!=len(timestamps):
            raise ValueError('复权价格与日期数量不一致')
        zone=ZoneInfo(response['meta']['exchangeTimezoneName'])
        by_date={datetime.fromtimestamp(t,zone).date().isoformat():v for t,v in zip(timestamps,adjusted)}
        history=[]
        for bar in bars:
            value=by_date.get(bar['date'])
            if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or value<=0:
                raise ValueError('复权价格缺失或无效：'+bar['date'])
            history.append({'date':bar['date'],'close':value})
        # Known issuer events: reject a provider series that still retains a mechanical split gap.
        # These are validation anchors, never hand-written return adjustments.
        validate_split_boundaries(asset,history)
        return {'status':'ok','basis':'fund-adjusted','label':'基金复权表现（拆分及分红调整）','source':'Yahoo Finance · Adj Close','history':history}
    except (KeyError,IndexError,TypeError,ValueError) as exc:
        return {'status':'unavailable','basis':'fund-adjusted','label':'基金复权表现','error':'复权数据不可用：'+str(exc),'history':[]}


def validate_split_boundaries(asset, history):
    if asset.get('id')=='telecom':
        for ex_date in ('2026-02-03','2026-07-06'):
            for i,bar in enumerate(history):
                if bar['date']==ex_date and i and abs(bar['close']/history[i-1]['close']-1)>.4:
                    raise ValueError('已知拆分日复权校验失败：'+ex_date)
