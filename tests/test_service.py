import unittest
from unittest.mock import patch
from tempfile import TemporaryDirectory
from pathlib import Path
from datetime import datetime, timezone
import time
import server

class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.temp=TemporaryDirectory()
        self.cache_patch=patch.object(server,'CACHE',{})
        self.path_patch=patch.object(server,'CACHE_DIR',Path(self.temp.name))
        self.cache_patch.start();self.path_patch.start()
        self.failure_patch=patch.object(server,'FAILURES',{});self.failure_patch.start()
        self.a=server.BY_ID['hsi']
        today=datetime.now(timezone.utc).date().isoformat()
        self.payload=dict(bars=[dict(date=today,high=12,low=8,close=10)],timezone='UTC',source='Test source')
    def tearDown(self):
        self.failure_patch.stop();self.path_patch.stop();self.cache_patch.stop();self.temp.cleanup()
    def test_cache_prevents_repeated_upstream(self):
        with patch.object(server,'load',return_value=self.payload) as loader:
            server.get_asset(self.a);server.get_asset(self.a)
            self.assertEqual(loader.call_count,1)
    def test_failure_retains_cache_with_explicit_stale_status(self):
        server.CACHE['hsi']={**self.payload,'fetchedAtEpoch':time.time()-1000,'fetchedAt':'2026-01-01T00:00:00+00:00'}
        with patch.object(server,'load',side_effect=ValueError('上游不可用')):
            result=server.get_asset(self.a)
            self.assertEqual(result['status'],'stale')
            self.assertEqual(result['latest']['close'],10)
            self.assertEqual(result['error'],'上游不可用')
    def test_legacy_cache_is_refetched_for_open_prices(self):
        server.CACHE['hsi']={**self.payload,'fetchedAtEpoch':time.time(),'fetchedAt':'2026-01-01T00:00:00+00:00'}
        with patch.object(server,'load',return_value=self.payload) as loader:
            result=server.get_asset(self.a)
            self.assertEqual(loader.call_count,1)
            self.assertEqual(result['schemaVersion'],3)

    def test_force_bypasses_fresh_cache(self):
        with patch.object(server,'load',return_value=self.payload) as loader:
            server.get_asset(self.a);server.get_asset(self.a,force=True)
            self.assertEqual(loader.call_count,2)

    def test_failure_backoff_preserves_error(self):
        with patch.object(server,'load',side_effect=ValueError('不可用')) as loader:
            first=server.get_asset(self.a);second=server.get_asset(self.a,force=True)
            self.assertEqual(loader.call_count,1)
            self.assertEqual(first['error'],second['error'])

    def test_regressing_response_keeps_newer_cache(self):
        with patch.object(server,'load',return_value=self.payload):server.get_asset(self.a)
        older={**self.payload,'bars':[dict(date='2020-01-01',high=12,low=8,close=9)]}
        with patch.object(server,'load',return_value=older):result=server.get_asset(self.a,force=True)
        self.assertEqual(result['latest']['close'],10)
        self.assertIn('倒退',result['error'])

    def test_china_holiday_is_not_stale(self):
        now=datetime(2026,10,4,12,tzinfo=timezone.utc)
        self.assertIsNone(server.freshness(server.BY_ID['sse'],{'date':'2026-09-30'},now))
        self.assertIsNotNone(server.freshness(server.BY_ID['sse'],{'date':'2026-09-29'},now))

    def test_no_cache_no_fabricated_levels(self):
        with patch.object(server,'load',side_effect=ValueError('上游不可用')):
            result=server.get_asset(self.a)
            self.assertEqual(result['status'],'error')
            self.assertNotIn('periods',result)

if __name__=='__main__':unittest.main()
