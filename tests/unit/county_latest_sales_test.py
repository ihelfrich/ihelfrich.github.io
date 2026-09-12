import sys, unittest
sys.path.insert(0, 'scripts/st-louis')
from fetch_county_region import select_latest_sales

def row(locator='a', date='02-MAY-25', price='1000', validity='X', market='0'):
    return {'PARID':locator,'SALEDT':date,'PRICE':price,'SALEVAL':validity,'MKTVALID':market,'INSTRTYP':'WD'}

class LatestTransfers(unittest.TestCase):
    def choose(self, rows): return select_latest_sales(rows)[0]['a']
    def test_conflict_ignores_file_order_as_chronology(self):
        for rows in ([row(price='200'),row(price='300')],[row(price='300'),row(price='200')]):
            selected=self.choose(rows)
            self.assertIsNone(selected[2]);self.assertEqual(selected[3],'conflicting-same-date')
            self.assertEqual(selected[8],float(rows[-1]['PRICE']))
    def test_latest_zero_not_replaced_by_positive_older(self):
        selected=self.choose([row(price='0'),row(date='01-MAY-25',price='500000')])
        self.assertEqual(selected[2:4],[0,'zero-recorded']);self.assertIsNone(selected[8])
    def test_each_explicit_multi_parcel_code_withholds(self):
        for flags in ({'validity':'1'},{'validity':'U'},{'market':'1'}):
            selected=self.choose([row(**flags)])
            self.assertEqual(selected[2:4],[None,'multi-parcel-total-withheld']);self.assertEqual(selected[8],1000)
    def test_multi_parcel_code_anywhere_latest_group(self):
        selected=self.choose([row(validity='U'),row()])
        self.assertEqual(selected[2:4],[None,'multi-parcel-total-withheld'])
    def test_older_multi_conflicts_do_not_poison_later_single_parcel(self):
        selected=self.choose([row(date='01-MAY-25',price='30',validity='U'),row(date='01-MAY-25',price='40'),row()])
        self.assertEqual(selected[2:4],[1000,'recorded'])
    def test_missing_and_numeric_conflict_same_date(self):
        self.assertEqual(self.choose([row(price=''),row()])[2:4],[None,'conflicting-same-date'])
    def test_matching_same_day_prices_are_not_conflicts(self):
        self.assertEqual(self.choose([row(),row()])[2:4],[1000,'recorded'])
    def test_invalid_non_multi_code_remains_explicit(self):
        self.assertEqual(self.choose([row(validity='2',market='2')])[2:6],[1000,'recorded','2','2'])

if __name__=='__main__':unittest.main()
