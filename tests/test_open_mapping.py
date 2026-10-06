import unittest
from unittest.mock import patch
import json
from providers import yahoo, eastmoney, sina

class MappingTests(unittest.TestCase):
    def test_yahoo_open(self):
        quote={k:[v]*10 for k,v in {'open':2,'high':4,'low':1,'close':3}.items()}
        payload={'chart':{'result':[{'meta':{'exchangeTimezoneName':'UTC'},'timestamp':[1790000000+i*86400 for i in range(10)],'indicators':{'quote':[quote]}}]}}
        with patch('providers.fetch',return_value=json.dumps(payload)):
            self.assertEqual(yahoo({'symbol':'TEST'})['bars'][0]['open'],2)
    def test_eastmoney_column_order(self):
        payload={'data':{'name':'TEST','klines':['2026-09-28,2,3,4,1,0']}}
        with patch('providers.fetch',return_value=json.dumps(payload)):
            self.assertEqual(eastmoney({'em':'1.TEST'})['bars'][0],dict(date='2026-09-28',open=2,high=4,low=1,close=3))
    def test_sina_open(self):
        raw='var data=('+json.dumps([dict(d='2026-09-28',o='2',h='4',l='1',c='3')])+');'
        with patch('providers.fetch',return_value=raw):
            self.assertEqual(sina({'provider':'sina','symbol':'TEST'})['bars'][0]['open'],2)
