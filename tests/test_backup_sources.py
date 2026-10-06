import json
import unittest
from unittest.mock import patch
import providers

class BackupSourceTests(unittest.TestCase):
    def test_tencent_ohlc_order(self):
        rows=[[f'2026-09-{i:02d}','10','11','12','9','100'] for i in range(1,12)]
        raw=json.dumps({'data':{'sh000001':{'day':rows}}})
        with patch.object(providers,'fetch',return_value=raw):data=providers.tencent({'qq':'sh000001'})
        self.assertEqual(data['bars'][-1],dict(date='2026-09-11',open=10,close=11,high=12,low=9))

    def test_sina_forex_ohlc_order(self):
        rows='|'.join(f'2026-09-{i:02d},10,9,12,11' for i in range(1,12))
        with patch.object(providers,'fetch',return_value='var _fx=('+json.dumps(rows)+');'):
            data=providers.sina_forex({'sina_fx':'fx_susdcnh'})
        self.assertEqual(data['bars'][-1],dict(date='2026-09-11',open=10,low=9,high=12,close=11))

    def test_explicit_mapping_falls_back(self):
        with patch.object(providers,'tencent',side_effect=ValueError('不可用')),patch.object(providers,'eastmoney',return_value={'bars':[1]}) as backup:
            data=providers.load({'provider':'eastmoney','qq':'sh000001','em':'1.000001'})
        self.assertEqual(backup.call_count,1)
        self.assertIn('腾讯财经',data['failedSources'][0])

    def test_sina_rejects_executable_payload(self):
        with patch.object(providers,'fetch',return_value='var _fx=(alert(1));'):
            with self.assertRaises(ValueError):providers.sina_forex({'sina_fx':'fx_susdcnh'})
