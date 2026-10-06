import unittest
from research import yahoo_research,validate_split_boundaries
from datetime import datetime,timezone
from unittest.mock import patch
from providers import load

class ResearchTests(unittest.TestCase):
    def test_adjusted_history_is_separate_and_keeps_raw_quotes(self):
        bars=[{'date':'2026-01-01','close':100},{'date':'2026-01-02','close':50}]
        response={'timestamp':[int(datetime(2026,1,d,tzinfo=timezone.utc).timestamp()) for d in (1,2)],'meta':{'exchangeTimezoneName':'UTC'},'indicators':{'adjclose':[{'adjclose':[50,50]}]}}
        r=yahoo_research({'id':'test','researchClass':'fund'},response,bars)
        self.assertEqual(r['history'][0]['close'],50)
        self.assertEqual(bars[0]['close'],100)
        response['indicators']['adjclose'][0]['adjclose'][0]=None
        self.assertEqual(yahoo_research({'id':'test','researchClass':'fund'},response,bars)['status'],'unavailable')
    def test_known_split_requires_real_adjustment_not_just_a_field_name(self):
        a={'id':'telecom'}
        with self.assertRaisesRegex(ValueError,'拆分'):
            validate_split_boundaries(a,[{'date':'2026-02-02','close':3.16},{'date':'2026-02-03','close':1.084}])
        validate_split_boundaries(a,[{'date':'2026-02-02','close':.527},{'date':'2026-02-03','close':.542}])
    def test_missing_adjusted_source_keeps_quote_but_blocks_research(self):
        a={'id':'test','researchClass':'fund'}
        with patch('providers.load_quote',return_value={'bars':[{'date':'2026-01-01','close':100}]}):
            r=load(a)
        self.assertEqual(r['bars'][0]['close'],100)
        self.assertEqual(r['research']['status'],'unavailable')
    def test_qfq_failure_does_not_silently_use_yahoo_or_raw(self):
        a={'id':'telecom','researchClass':'fund','researchQQ':'sh515880'}
        with patch('providers.load_quote',return_value={'bars':[{'date':'2026-01-01','close':100}],'research':{'status':'ok'}}),patch('providers.fetch',side_effect=ValueError('unavailable')):
            r=load(a)
        self.assertEqual(r['research']['status'],'unavailable')
        self.assertEqual(r['bars'][0]['close'],100)
