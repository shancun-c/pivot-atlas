import unittest
from datetime import datetime, timezone
from market_periods import build_views, sessions
from datetime import date

UTC=timezone.utc
class CalendarSelectionTests(unittest.TestCase):
    def payload(self,days,fetched='2026-10-04T14:00:00+00:00'):
        return dict(timezone='America/New_York',fetchedAt=fetched,bars=[dict(date=d,open=10,high=12,low=8,close=11) for d in days])
    def test_hsi_weekend_reproduces_screenshot(self):
        data=self.payload(['2026-09-28','2026-09-29','2026-09-30','2026-10-02'])
        data['bars']=[dict(date=b['date'],high=24767.220703125,low=23865.330078125,close=23972.2890625) for b in data['bars']]
        views,_=build_views({'id':'hsi','group':'港股'},data,datetime(2026,10,4,14,tzinfo=UTC))
        w=views['reference']['week'];self.assertEqual(w['selection'],'next');self.assertAlmostEqual(w['levels']['P'],24201.61328125)
        self.assertEqual(w['effectiveStart'],'2026-10-05');self.assertEqual(w['sourceStart'],'2026-09-28')
        self.assertEqual(views['review']['week']['effectiveStart'],'2026-09-28')
    def test_friday_requires_close_and_post_close_fetch(self):
        days=['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02']
        asset={'id':'spx','group':'美股'}
        for now,fetched,expected in [(19,'2026-10-02T19:00:00+00:00','current'),(21,'2026-10-02T19:00:00+00:00','current'),(21,'2026-10-02T20:20:00+00:00','next')]:
            v,_=build_views(asset,self.payload(days,fetched),datetime(2026,10,2,now,tzinfo=UTC))
            self.assertEqual(v['reference']['week']['selection'],expected)
    def test_missing_last_or_middle_session_does_not_advance(self):
        all_days=['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02']
        for missing in ['2026-10-02','2026-09-30']:
            v,_=build_views({'id':'spx','group':'美股'},self.payload([d for d in all_days if d!=missing]),datetime(2026,10,4,14,tzinfo=UTC))
            self.assertEqual(v['reference']['week']['selection'],'current');self.assertIn('等待完整日线',v['reference']['week']['selectionReason'])
    def test_good_friday_week_ends_thursday(self):
        v,_=build_views({'id':'spx','group':'美股'},self.payload(['2026-03-30','2026-03-31','2026-04-01','2026-04-02'],'2026-04-02T21:00:00+00:00'),datetime(2026,4,2,21,tzinfo=UTC))
        self.assertEqual(v['reference']['week']['selection'],'next');self.assertEqual(v['reference']['week']['finalSession'],'2026-04-02')
    def test_monthend_uses_last_session_before_weekend(self):
        days=list(sessions('NYSE',date(2026,1,1),date(2026,1,31)))
        v,_=build_views({'id':'spx','group':'美股'},self.payload(days,'2026-01-30T22:00:00+00:00'),datetime(2026,1,30,22,tzinfo=UTC))
        self.assertEqual(v['reference']['month']['effectiveStart'],'2026-02-01');self.assertEqual(v['review']['month']['effectiveStart'],'2026-01-01')
    def test_monday_uses_same_levels_as_weekend_preview(self):
        d=self.payload(['2026-09-28','2026-09-29','2026-09-30','2026-10-02']);a={'id':'hsi','group':'港股'}
        sunday,_=build_views(a,d,datetime(2026,10,4,14,tzinfo=UTC));monday,_=build_views(a,d,datetime(2026,10,5,1,tzinfo=UTC))
        self.assertEqual(sunday['reference']['week']['levels'],monday['reference']['week']['levels']);self.assertEqual(monday['reference']['week']['selection'],'current')
    def test_unknown_fixing_calendar_stays_current(self):
        v,_=build_views({'id':'cn10y'},self.payload(['2026-10-02']),datetime(2026,10,4,14,tzinfo=UTC))
        self.assertEqual(v['reference']['week']['selection'],'current');self.assertIn('尚无已核验',v['reference']['week']['selectionReason'])
    def test_dst_close_changes_in_utc(self):
        self.assertEqual(sessions('NYSE',date(2026,3,6),date(2026,3,6))['2026-03-06'].hour,21)
        self.assertEqual(sessions('NYSE',date(2026,3,13),date(2026,3,13))['2026-03-13'].hour,20)
    def test_historical_levels_never_use_their_own_period(self):
        days=list(sessions('NYSE',date(2026,9,14),date(2026,10,2)))
        data=self.payload(days)
        for b in data['bars']:
            if b['date']>='2026-09-28':b.update(high=1000,low=800,close=900)
        _,history=build_views({'id':'spx','group':'美股'},data,datetime(2026,10,4,14,tzinfo=UTC))
        for h in history['week']:
            self.assertLess(h['lastBar'],h['effectiveStart'])
        current=next(h for h in history['week'] if h['effectiveStart']=='2026-09-28')
        self.assertLess(current['levels']['P'],20)
