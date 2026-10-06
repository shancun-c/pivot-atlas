"""Public upstream adapters. No credentials and no third-party Python dependencies."""
import json
import math
import re
import subprocess
import threading
from datetime import datetime, timezone, timedelta
from urllib.parse import urlencode, quote
from zoneinfo import ZoneInfo

BOND_LOCK = threading.Lock()
BOND_CACHE = None


def fetch(url):
    result = subprocess.run(['curl','--fail','--silent','--show-error','--location',
                             '--connect-timeout','5','--max-time','12','--user-agent','Mozilla/5.0',url],
                            capture_output=True, text=True, timeout=15)
    if result.returncode or not result.stdout:
        raise ValueError(f'上游请求失败（curl {result.returncode}）或空响应')
    return result.stdout


def clean(bars):
    out = {}
    for b in bars:
        try:
            values = [float(b[k]) for k in ('high','low','close')]
            if not all(math.isfinite(x) for x in values) or not values[1] <= values[2] <= values[0]:
                continue
            opening = None
            try:
                candidate = float(b.get('open'))
                if math.isfinite(candidate) and values[1] <= candidate <= values[0]:
                    opening = candidate
            except (TypeError, ValueError):
                pass
            out[b['date']] = dict(date=b['date'], open=opening, high=values[0],low=values[1],close=values[2])
        except (ValueError, TypeError, KeyError):
            continue
    if not out:
        raise ValueError('上游未返回有效日线')
    return sorted(out.values(),key=lambda b:b['date'])


def yahoo(a):
    for host in ('query1','query2'):
        try:
            url=f'https://{host}.finance.yahoo.com/v8/finance/chart/{quote(a["symbol"],safe="")}?range=6mo&interval=1d'
            j=json.loads(fetch(url))['chart']
            if not j.get('result'):
                raise ValueError('Yahoo 无此标的历史行情')
            r=j['result'][0]; q=r['indicators']['quote'][0]; meta=r['meta']
            tz=meta.get('exchangeTimezoneName','UTC')
            bars=clean([dict(date=datetime.fromtimestamp(t,ZoneInfo(tz)).date().isoformat(),
                             open=q.get('open', [None]*len(r['timestamp']))[i], high=q['high'][i],low=q['low'][i],close=q['close'][i])
                        for i,t in enumerate(r.get('timestamp',[]))])
            if len(bars)<10:
                raise ValueError('Yahoo 历史日线不足')
            return {'bars':bars,'source':'Yahoo Finance','sourceUrl':f'https://finance.yahoo.com/quote/{quote(a["symbol"],safe="")}/history/',
                    'timezone':tz,'sourceName':meta.get('shortName',''), 'upstreamSymbol':a['symbol']}
        except (ValueError, KeyError, IndexError) as e:
            error=e
    raise error


def eastmoney(a):
    params=dict(secid=a['em'],klt=101,fqt=0,beg='20250101',end='20500101',lmt=220,
                fields1='f1,f2,f3,f4,f5,f6',fields2='f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61')
    r=json.loads(fetch('https://push2his.eastmoney.com/api/qt/stock/kline/get?'+urlencode(params))).get('data')
    if not r or not r.get('klines'):
        raise ValueError('东方财富无此标的日线')
    rows=[s.split(',') for s in r['klines']]
    return dict(bars=clean([dict(date=b[0],open=b[1],high=b[3],low=b[4],close=b[2]) for b in rows]),
                source='东方财富',sourceUrl='https://quote.eastmoney.com/', timezone='Asia/Shanghai',
                sourceName=r.get('name',''),upstreamSymbol=a['em'])


def sina(a):
    service='GlobalFuturesService.getGlobalFuturesDailyKLine' if a['provider']=='sina-global' else 'InnerFuturesNewService.getDailyKLine'
    url='https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20_data=/'+service+'?'+urlencode({'symbol':a['symbol'],'source':'web'})
    raw=fetch(url); rows=json.loads(raw[raw.index('['):raw.rindex(']')+1])
    bars=clean([dict(date=b.get('d',b.get('date',''))[:10],open=b.get('o',b.get('open')),high=b.get('h',b.get('high')),low=b.get('l',b.get('low')),close=b.get('c',b.get('close'))) for b in rows])
    return dict(bars=bars[-220:],source='新浪财经',sourceUrl='https://finance.sina.com.cn/futures/',
                timezone='Asia/Shanghai' if a['provider']=='sina' else 'America/New_York',upstreamSymbol=a['symbol'])


def bond(a):
    global BOND_CACHE
    with BOND_LOCK:
        if BOND_CACHE is None or datetime.now(timezone.utc).timestamp()-BOND_CACHE[0]>900:
            url='https://datacenter.eastmoney.com/api/data/v1/get?'+urlencode(dict(reportName='RPTA_WEB_TREASURYYIELD',columns='ALL',sortColumns='SOLAR_DATE',sortTypes=-1,pageSize=200,pageNumber=1))
            BOND_CACHE=(datetime.now(timezone.utc).timestamp(),json.loads(fetch(url))['result']['data'])
        rows=BOND_CACHE[1]
    bars=clean([dict(date=r['SOLAR_DATE'][:10],high=r[a['field']],low=r[a['field']],close=r[a['field']]) for r in rows if r.get(a['field']) is not None])
    return dict(bars=bars,source='东方财富 · 国债收益率',sourceUrl='https://data.eastmoney.com/cjsj/zmgzsyl.html',timezone='Asia/Shanghai' if a['id']=='cn10y' else 'America/New_York',upstreamSymbol=a['field'])



def tencent(a):
    symbol=a['qq']
    url='https://proxy.finance.qq.com/ifzqgtimg/appstock/app/newfqkline/get?'+urlencode({'param':f'{symbol},day,,,220,'})
    payload=json.loads(fetch(url))
    data=payload.get('data',{}).get(symbol,{})
    rows=data.get('day',[])
    if len(rows)<10:
        raise ValueError('腾讯未返回足够的同标的未复权日线')
    bars=clean([dict(date=r[0],open=r[1],close=r[2],high=r[3],low=r[4]) for r in rows])
    quote_data=data.get('qt',{}).get(symbol,[])
    return dict(bars=bars,source='腾讯财经',sourceUrl='https://gu.qq.com/'+symbol,
                timezone='Asia/Hong_Kong' if symbol.startswith('hk') else 'Asia/Shanghai',
                upstreamSymbol=symbol,sourceName=quote_data[1] if len(quote_data)>1 else '')


def sina_forex(a):
    # Sina's own datas/k.js: date, open, low, high, close, volume.
    symbol=a['sina_fx']
    url='https://vip.stock.finance.sina.com.cn/forex/api/jsonp.php/var%20_fx=/NewForexService.getDayKLine?'+urlencode({'symbol':symbol})
    raw=fetch(url)
    match=re.search(r'var\s+_fx\s*=\s*\(("(?:[^"\\]|\\.)*")\)\s*;',raw)
    if not match:raise ValueError('新浪外汇日线格式变化')
    rows=[r.split(',') for r in json.loads(match.group(1)).split('|')]
    bars=clean([dict(date=r[0],open=r[1],low=r[2],high=r[3],close=r[4]) for r in rows if len(r)>=5])
    if len(bars)<10:raise ValueError('新浪外汇历史不足')
    return dict(bars=bars[-220:],source='新浪财经 · 外汇',sourceUrl='https://finance.sina.com.cn/money/forex/hq/USDCNH.shtml',
                timezone='UTC',upstreamSymbol=symbol,
                sourceName='美元兑离岸人民币',sessionNote='沿用供应商日线日期，外汇日界尚未按交易所日历核验')


def coinbase(a):
    end=datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)
    start=end-timedelta(days=220)
    url='https://api.exchange.coinbase.com/products/'+quote(a['symbol'],safe='')+'/candles?'+urlencode(dict(granularity=86400,start=start.isoformat(),end=end.isoformat()))
    rows=json.loads(fetch(url))
    if not isinstance(rows,list):raise ValueError('Coinbase 未返回日线数组')
    bars=clean([dict(date=datetime.fromtimestamp(r[0],timezone.utc).date().isoformat(),low=r[1],high=r[2],open=r[3],close=r[4]) for r in rows if isinstance(r,list) and len(r)>=5 and start.timestamp()<=r[0]<end.timestamp()])
    if len(bars)<10:raise ValueError('Coinbase 历史日线不足')
    return dict(bars=bars,source='Coinbase Exchange',sourceUrl='https://exchange.coinbase.com/trade/'+a['symbol'],timezone='UTC',upstreamSymbol=a['symbol'],sessionNote='24/7 现货；UTC 日界；仅包含已结束日线')


def load(a):
    kind=a.get('provider','yahoo')
    if kind=='coinbase':return coinbase(a)
    if kind=='bond':return bond(a)
    if kind.startswith('sina'):return sina(a)
    # Explicit same-instrument mappings only; never use an ETF or CNY as proxy.
    adapters=[]
    if a.get('qq'):adapters.append(('腾讯财经',tencent))
    if a.get('sina_fx'):adapters.append(('新浪外汇',sina_forex))
    if kind=='eastmoney':adapters.append(('东方财富',eastmoney))
    else:
        adapters.append(('Yahoo Finance',yahoo))
        if a.get('em'):adapters.append(('东方财富',eastmoney))
    failures=[]
    for name,adapter in adapters:
        try:
            data=adapter(a)
            return {**data,'failedSources':failures}
        except (ValueError,KeyError,IndexError,TypeError,subprocess.TimeoutExpired) as exc:
            failures.append(f'{name}：{exc}' if not isinstance(exc,subprocess.TimeoutExpired) else f'{name}：请求超时')
    raise ValueError('；'.join(failures))
