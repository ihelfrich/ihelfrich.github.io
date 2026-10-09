"""Build the fixed public electricity case from two downloaded provider files.

Run with openpyxl 3.1.5: python build_extract.py sales_revenue.xlsx texas.csv.
Verify NOAA's geographic header rather than inferring a state from its filename.
The workbook is already a state aggregate; never sum its aggregate with utility
records or add EIA's separately published non-bundled figures.
"""
from pathlib import Path
import csv
import hashlib
import json
import sys
from openpyxl import load_workbook

root=Path(__file__).resolve().parent
workbook,climate=map(Path,sys.argv[1:3])
climate_text=climate.read_text()
assert 'Texas Average Temperature' in climate_text,'Provider geographic label is not Texas'
assert 'Degrees Fahrenheit' in climate_text,'Temperature unit changed'
temperature={row['Date']:float(row['Value']) for row in csv.DictReader(line for line in climate_text.splitlines() if not line.startswith('#'))}
w=load_workbook(workbook,read_only=True,data_only=True)
sheet=w['Monthly-States'];rows=list(sheet.values)
assert rows[2][5]=='Megawatthours' and rows[2][6]=='Count' and rows[2][7]=='Cents/kWh'
selected={}
for row in rows[3:]:
    if row[2]!='TX' or not isinstance(row[0],(int,float)) or not 2010<=row[0]<=2025:continue
    year,month=int(row[0]),int(row[1]);key=f'{year}{month:02d}'
    assert key not in selected,'Duplicated state-month aggregate'
    assert key in temperature,'Missing temperature match'
    selected[key]=[f'{year}-{month:02d}','TX',float(row[5]),int(row[6]),float(row[7]),temperature[key],row[3]]
assert len(selected)==192
output=root/'texas-electricity.csv'
with output.open('w',newline='') as file:
    writer=csv.writer(file);writer.writerow(['period','state','residential_sales_mwh','residential_customers','residential_price_cents_kwh','temperature_f','eia_status'])
    writer.writerows(selected[key] for key in sorted(selected))
sources=[{'provider':'U.S. Energy Information Administration','url':'https://www.eia.gov/electricity/data/eia861m/xls/sales_revenue.xlsx','documentation':'https://www.eia.gov/electricity/data/eia861m/','sheet':'Monthly-States','selection':'TX; 2010-01 through 2025-12; residential fields; one aggregate per state-month','sha256':hashlib.sha256(workbook.read_bytes()).hexdigest()}, {'provider':'NOAA National Centers for Environmental Information','url':'https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series/41/tavg/1/0/2010-2025.csv','selection':'Texas Average Temperature; one-month series; all months; Fahrenheit','sha256':hashlib.sha256(climate.read_bytes()).hexdigest()}]
manifest={'retrieved_utc':'2026-10-09','rows':len(selected),'period_start':'2010-01','period_end':'2025-12','target':'Texas residential electricity sales, MWh per month','forecast_status':'Fixed downloaded vintage. Pseudo-out-of-sample demonstrations; historical publication vintages not reconstructed. Any release lag used in code is a declared teaching assumption, not verified provider release metadata.','climate_measure':'Statewide average monthly temperature; nonlinear heating/cooling transforms are monthly-temperature proxies, not degree-day totals from daily exposures.','source_terms':'U.S. government data; credit EIA and NOAA. Provider terms and third-party rights retain their original effect.','output_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sources':sources}
(root/'texas-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'rows':len(selected),'first':selected[min(selected)],'last':selected[max(selected)],'output_sha256':manifest['output_sha256']},indent=2))
