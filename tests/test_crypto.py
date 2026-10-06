import json
import unittest
from datetime import datetime, timedelta, timezone, date
from unittest.mock import patch
from providers import coinbase
from market_periods import sessions, build_views, checked_aggregate

class CryptoTests(unittest.TestCase):
    def test_weekend_and_midnight_close(self):
        days=sessions('CRYPTO_24_7',date(2026,10,3),date(2026,10,4))
        self.assertEqual(len(days),2)
        self.assertEqual(days['2026-10-04'],datetime(2026,10,5,tzinfo=timezone.utc))

    def test_completed_bars_only_and_field_order(self):
        today=datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0)
        rows=[[(today-timedelta(days=i)).timestamp(),8,12,9,11,1] for i in range(12)]
        with patch('providers.fetch',return_value=json.dumps(rows)):
            data=coinbase({'symbol':'BTC-USD'})
        self.assertEqual(len(data['bars']),11)
        self.assertEqual(data['bars'][-1],dict(date=str((today-timedelta(days=1)).date()),low=8,high=12,open=9,close=11))

    def test_missing_sunday_invalidates_period(self):
        bars=[dict(date=str(date(2026,9,21)+timedelta(days=i)),high=12,low=8,close=10) for i in range(6)]
        calc=checked_aggregate(bars,date(2026,10,4),'week','CRYPTO_24_7')
        self.assertNotIn('levels',calc)
        self.assertIn('2026-09-27',calc['error'])

    def test_sunday_does_not_advance_to_next_week(self):
        bars=[dict(date=str(date(2026,9,1)+timedelta(days=i)),high=12,low=8,close=10) for i in range(33)]
        views,_=build_views({'id':'btc','group':'加密货币'},{'timezone':'UTC','bars':bars,'fetchedAt':'2026-10-04T12:00:00+00:00'},datetime(2026,10,4,12,tzinfo=timezone.utc))
        self.assertEqual(views['reference']['week']['selection'],'current')
        self.assertTrue(views['reference']['week']['calendarVerified'])
