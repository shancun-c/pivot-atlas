from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import json
import os
import threading
import time
from providers import load
from macro_data import get_macro
from market_periods import build_views, calendar_name, sessions

ROOT=Path(__file__).resolve().parent
ASSETS=json.loads((ROOT/'assets.json').read_text())
BY_ID={a['id']:a for a in ASSETS}
CACHE={}
FAILURES={}
LOCKS={a['id']:threading.Lock() for a in ASSETS}
GATE=threading.Semaphore(4)
CACHE_DIR=Path(os.environ.get('CACHE_DIR',str(ROOT/'.cache')))
CACHE_DIR.mkdir(exist_ok=True)


def freshness(a, latest, now):
    name=calendar_name(a)
    if name:
        try:
            closed=[day for day,close in sessions(name,now.date()-timedelta(days=40),now.date()).items() if close+timedelta(minutes=15)<=now]
            expected=max(closed) if closed else None
            return ('日线滞后，应更新至 '+expected) if expected and latest['date']<expected else None
        except Exception:
            pass
    return '日线超过7个自然日，交易日历未核验' if (now.date()-datetime.fromisoformat(latest['date']).date()).days>7 else None


def get_asset(a, force=False):
    with LOCKS[a['id']]:
        path=CACHE_DIR/(a['id']+'.json')
        cached=CACHE.get(a['id'])
        if cached is None and path.exists():
            try:cached=json.loads(path.read_text())
            except (ValueError,OSError):pass
        failure=FAILURES.get(a['id'])
        cooldown=bool(failure and time.time()<failure['retryAt'])
        error=failure['error'] if cooldown else None
        if not cooldown and (force or failure is not None or cached is None or cached.get('schemaVersion') != 3 or time.time()-cached['fetchedAtEpoch']>900):
            try:
                with GATE:data=load(a)
                if not data.get('bars'):raise ValueError('上游返回空日线')
                if cached and data['bars'][-1]['date']<cached['bars'][-1]['date']:
                    raise ValueError('上游日线日期倒退，保留较新的缓存')
                cached={**data,'schemaVersion':3,'fetchedAtEpoch':time.time(),'fetchedAt':datetime.now(timezone.utc).isoformat()}
                path.write_text(json.dumps(cached,ensure_ascii=False))
                CACHE[a['id']]=cached
                FAILURES.pop(a['id'],None)
            except Exception as exc:
                error=str(exc) if isinstance(exc,ValueError) else '行情接口暂不可用'
                FAILURES[a['id']]={'error':error,'retryAt':time.time()+60}
        if not cached:
            return {**a,'status':'error','error':error or '暂无行情'}
        now=datetime.now(ZoneInfo(cached['timezone'])).date()
        views,history_pivots=build_views(a,cached)
        periods=views['reference']
        latest=cached['bars'][-1]
        stale_reason=freshness(a,latest,datetime.now(timezone.utc))
        stale=error is not None or stale_reason is not None
        return {**a,**{k:v for k,v in cached.items() if k not in ('bars','fetchedAtEpoch')},
                'status':'stale' if stale else 'ok','error':error,'freshnessReason':stale_reason,
                'statusLabel':'刷新失败 / 缓存' if error else '日线滞后' if stale_reason else '已获取','periods':periods,'periodViews':views,'historicalPivots':history_pivots,
                'latest':latest,'history':cached['bars'],
                'previousClose':cached['bars'][-2]['close'] if len(cached['bars'])>1 else None,
                'asOf':str(now),'cacheAgeSeconds':round(time.time()-cached['fetchedAtEpoch'])}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'public'),**kwargs)
    def do_GET(self):
        route=urlparse(self.path).path
        if route=='/api/macro':return self.respond(get_macro(CACHE_DIR,force=parse_qs(urlparse(self.path).query).get('refresh')==['1']))
        if route=='/api/assets':return self.respond(ASSETS)
        if route.startswith('/api/asset/'):
            a=BY_ID.get(route.rsplit('/',1)[-1])
            return self.respond(get_asset(a,force=parse_qs(urlparse(self.path).query).get('refresh')==['1']) if a else {'error':'Unknown asset'},200 if a else 404)
        if route=='/api/health':return self.respond({'ok':True,'assets':len(ASSETS)})
        return super().do_GET()
    def respond(self,data,status=200):
        body=json.dumps(data,ensure_ascii=False,allow_nan=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)))
        self.end_headers();self.wfile.write(body)
    def log_message(self,*args):pass

if __name__=='__main__':
    port=int(os.environ.get('PORT','8765'))
    print(f'Pivot Atlas: http://127.0.0.1:{port}',flush=True)
    ThreadingHTTPServer(('127.0.0.1',port),Handler).serve_forever()
