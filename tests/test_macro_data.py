import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory
from datetime import datetime, timezone
from pathlib import Path
import macro_data as m

class MacroDataTests(unittest.TestCase):
    def setUp(self):
        self.temp=TemporaryDirectory();m.FAILURES.clear()
        self.now=datetime(2026,10,7,12,tzinfo=timezone.utc)
    def tearDown(self):self.temp.cleanup();m.FAILURES.clear()
    def fetch(self,kind,year):
        return [{'date':f'{year}-10-06','BC_2YEAR':4.79,'BC_10YEAR':5.27}]
    def test_parse_missing_negative_and_nonfinite(self):
        xml='<feed><properties><NEW_DATE>2026-10-06T00:00:00</NEW_DATE><TC_10YEAR>-0.2</TC_10YEAR><other>3</other></properties></feed>'
        self.assertEqual(m.parse_curve(xml,('TC_10YEAR',))[0]['TC_10YEAR'],-.2)
        with self.assertRaises(ValueError):m.parse_curve(xml.replace('-0.2','NaN'),('TC_10YEAR',))
        with self.assertRaises(ValueError):m.parse_curve(xml,('missing',))
    def test_cache_failure_cooldown_and_recovery(self):
        with patch.object(m,'fetch_year',side_effect=self.fetch) as loader:
            self.assertEqual(m.get_curve('nominal',self.temp.name,now=self.now)['status'],'ok')
            m.get_curve('nominal',self.temp.name,now=self.now);self.assertEqual(loader.call_count,2)
        with patch.object(m,'fetch_year',side_effect=ValueError('offline')) as loader:
            r=m.get_curve('nominal',self.temp.name,True,self.now)
            self.assertEqual(r['status'],'stale');self.assertEqual(r['latestDate'],'2026-10-06')
            m.get_curve('nominal',self.temp.name,True,self.now);self.assertLessEqual(loader.call_count,2)
        m.FAILURES.clear()
        with patch.object(m,'fetch_year',side_effect=self.fetch):self.assertEqual(m.get_curve('nominal',self.temp.name,True,self.now)['status'],'ok')
    def test_no_cache_and_regression(self):
        with patch.object(m,'fetch_year',side_effect=ValueError('offline')):
            self.assertEqual(m.get_curve('real',self.temp.name,now=self.now)['status'],'error')
        with patch.object(m,'fetch_year',side_effect=self.fetch):m.get_curve('nominal',self.temp.name,now=self.now)
        with patch.object(m,'fetch_year',return_value=[{'date':'2025-10-01','BC_2YEAR':3}]):
            r=m.get_curve('nominal',self.temp.name,True,self.now);self.assertEqual(r['status'],'stale');self.assertIn('倒退',r['error'])
    def test_old_observations_mark_stale(self):
        with patch.object(m,'fetch_year',side_effect=lambda k,y:[{'date':f'{y}-09-01','BC_2YEAR':3}]):
            self.assertEqual(m.get_curve('nominal',self.temp.name,now=self.now)['status'],'stale')
    def test_new_year_empty_current_feed_keeps_previous_observations(self):
        old='<feed><entry><properties><NEW_DATE>2026-12-31</NEW_DATE><BC_2YEAR>4</BC_2YEAR><BC_10YEAR>4.5</BC_10YEAR></properties></entry></feed>'
        def annual(kind,year):return m.parse_curve(old if year==2026 else '<feed/>',m.KINDS[kind][1],allow_empty=True)
        with patch.object(m,'fetch_year',side_effect=annual):
            r=m.get_curve('nominal',self.temp.name,now=datetime(2027,1,1,12,tzinfo=timezone.utc))
            self.assertEqual(r['status'],'ok');self.assertEqual(r['latestDate'],'2026-12-31')
        with self.assertRaises(ValueError):m.parse_curve('<html/>',('BC_2YEAR',),allow_empty=True)
        with self.assertRaises(ValueError):m.parse_curve('<feed><entry/></feed>',('BC_2YEAR',),allow_empty=True)
