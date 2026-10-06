"""Pure calculation: Traditional pivots from the previous calendar period."""
import math
from datetime import date, timedelta


def calculate(high, low, close):
    if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in (high, low, close)):
        raise ValueError('H/L/C must be finite numbers')
    if not low <= close <= high:
        raise ValueError('Expected low <= close <= high')
    p = (high + low + close) / 3
    return dict(P=p, R1=2*p-low, S1=2*p-high,
                R2=p+high-low, S2=p-high+low,
                R3=2*p+high-2*low, S3=2*p-2*high+low,
                R4=3*p+high-3*low, S4=3*p-3*high+low,
                R5=4*p+high-4*low, S5=4*p-4*high+low)


def window(today, period):
    if period == 'week':
        start = today - timedelta(days=today.weekday())
        return start-timedelta(days=7), start, start+timedelta(days=7)
    if period != 'month':
        raise ValueError('Unknown period')
    start = today.replace(day=1)
    prev = (start-timedelta(days=1)).replace(day=1)
    end = (start.replace(day=28)+timedelta(days=4)).replace(day=1)
    return prev, start, end


def aggregate(bars, today, period):
    prev, start, end = window(today, period)
    chosen = sorted((b for b in bars if prev.isoformat() <= b['date'] < start.isoformat()), key=lambda b:b['date'])
    if not chosen:
        return {'error':'上一完整周期无有效行情', 'sourceStart':str(prev), 'sourceEnd':str(start-timedelta(days=1)), 'effectiveStart':str(start), 'effectiveEnd':str(end-timedelta(days=1))}
    h, l, c = max(b['high'] for b in chosen), min(b['low'] for b in chosen), chosen[-1]['close']
    return {'levels':calculate(h,l,c), 'high':h, 'low':l, 'close':c,
            'sourceStart':str(prev), 'sourceEnd':str(start-timedelta(days=1)),
            'firstBar':chosen[0]['date'], 'lastBar':chosen[-1]['date'], 'barCount':len(chosen),
            'effectiveStart':str(start), 'effectiveEnd':str(end-timedelta(days=1))}
