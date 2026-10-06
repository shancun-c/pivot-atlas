import unittest
from datetime import date
from pivots import calculate, aggregate, window
from providers import clean

class PivotTests(unittest.TestCase):
    def test_screenshot_hsi(self):
        # Reconstructed input from screenshot R1, S1 and P, rounded to 0.1.
        v=calculate(24767.2,23865.3,23972.3)
        expected={'P':24201.6,'R1':24537.9,'R2':25103.5,'R3':25439.8,'R4':25776.1,'R5':26112.4,
                  'S1':23636.0,'S2':23299.7,'S3':22734.1,'S4':22168.5,'S5':21602.9}
        for key,value in expected.items():self.assertAlmostEqual(v[key],value,places=1)
    def test_invalid_input(self):
        for args in [(1,2,1),(5,1,9),(float('nan'),1,2),(5,1,float('inf'))]:
            with self.assertRaises(ValueError):calculate(*args)
    def test_flat_negative_prices(self):
        self.assertTrue(all(v==-5 for v in calculate(-5,-5,-5).values()))
    def test_week_boundary(self):
        self.assertEqual(window(date(2026,10,4),'week'),(date(2026,9,21),date(2026,9,28),date(2026,10,5)))
        self.assertEqual(window(date(2026,10,5),'week')[0],date(2026,9,28))
    def test_month_year_boundary(self):
        self.assertEqual(window(date(2026,1,2),'month'),(date(2025,12,1),date(2026,1,1),date(2026,2,1)))
    def test_leap_month(self):
        self.assertEqual(window(date(2024,3,1),'month')[0],date(2024,2,1))
    def test_excludes_current_period_and_orders_close(self):
        bars=[dict(date='2026-09-24',high=12,low=3,close=7),dict(date='2026-09-28',high=99,low=1,close=88),dict(date='2026-09-21',high=10,low=4,close=8)]
        v=aggregate(bars,date(2026,10,4),'week')
        self.assertEqual((v['high'],v['low'],v['close'],v['barCount']),(12,3,7,2))
    def test_does_not_relabel_old_period(self):
        v=aggregate([dict(date='2025-09-21',high=12,low=3,close=7)],date(2026,10,4),'week')
        self.assertIn('error',v);self.assertNotIn('levels',v)
    def test_clean_invalid_and_duplicate(self):
        bars=[dict(date='2026-01-01',high=3,low=1,close=2),dict(date='2026-01-02',high=None,low=1,close=2),dict(date='2026-01-01',high=4,low=1,close=3)]
        self.assertEqual(clean(bars),[dict(date='2026-01-01',open=None,high=4.,low=1.,close=3.)])

    def test_preserves_real_open(self):
        b=dict(date='2026-01-01',open='2.5',high=4,low=1,close=3)
        self.assertEqual(clean([b])[0]['open'],2.5)

    def test_missing_or_invalid_open_is_never_fabricated(self):
        for opening in (None, float('nan'), 99):
            b=dict(date='2026-01-01',open=opening,high=4,low=1,close=3)
            result=clean([b])[0]
            self.assertIsNone(result['open'])
            self.assertEqual(result['close'],3)

if __name__=='__main__':unittest.main()
