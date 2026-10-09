"""Exact finite forecast-risk example from Lecture 2; no random draws."""
from itertools import product
import csv
import sys

def metrics():
    result={}
    for scale in (1,3):
        errors=[0.5*scale*first+scale*second for first,second in product((-1,1),repeat=2)]
        result[f'state_{scale}_mean_error']=sum(errors)/4
        result[f'state_{scale}_variance']=sum(e*e for e in errors)/4
    result['unconditional_variance']=(result['state_1_variance']+result['state_3_variance'])/2
    result['opening_forecast']=3+0.5*(3+0.5*10)
    for phi in (-0.95,-0.5,0,0.5,0.95,1):
        for h in (1,2,24):
            result[f'response_{phi:g}_{h}']=phi**h
            result[f'variance_{phi:g}_{h}']=sum(phi**(2*j) for j in range(h))
    return result

if __name__=='__main__':
    writer=csv.writer(sys.stdout);writer.writerow(['metric','value']);writer.writerows(metrics().items())
