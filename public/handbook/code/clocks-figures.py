"""Original release-clock and controlled-forecast diagrams; no provider images used."""
from pathlib import Path
from datetime import datetime
import csv
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as dates
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent/'figures'
with (ROOT/'data/gdp-release-ledger.csv').open() as f:records=list(csv.DictReader(f))
times=[datetime.fromisoformat(r['release_utc']) for r in records]
values=[float(r['value_percent']) for r in records]
plt.rcParams.update({'font.family':'DejaVu Sans','svg.fonttype':'none','pdf.fonttype':42,'axes.spines.top':False,'axes.spines.right':False})
def figure(stacked):
 fig,axes=plt.subplots(2,1,figsize=(5.5,8.1),layout='constrained') if stacked else plt.subplots(1,2,figsize=(10.6,4.7),layout='constrained')
 a,b=axes
 a.step(times+[datetime.fromisoformat('2024-07-01T12:00:00Z')],values+[values[-1]],where='post',color='black',lw=2)
 a.scatter(times,values,color='black',s=40,zorder=4)
 origin=datetime.fromisoformat('2024-05-15T12:00:00Z');a.axvline(origin,color='black',ls='--',lw=1.4)
 a.annotate('May 15 origin',(origin,1.6),xytext=(-8,-35),textcoords='offset points',ha='right',fontsize=12)
 a.set_title('One quarter, three publications',loc='left',fontsize=16,weight='bold')
 a.set(ylim=(1.2,1.7),yticks=[1.3,1.4,1.6],xticks=times,xlabel='Publication date, 2024 (UTC)',ylabel='Annualized growth (%)')
 a.xaxis.set_major_formatter(dates.DateFormatter('%b %d',tz=times[0].tzinfo))
 b.bar([0,1],[3.5,2],color=['white','.72'],edgecolor='black',width=.55)
 b.text(0,3.64,'3 and 4',ha='center',fontsize=12);b.text(1,2.14,'3 and later 1',ha='center',fontsize=12)
 b.set_title('An old forecast, a later revision',loc='left',fontsize=16,weight='bold')
 b.set(ylim=(0,4.4),yticks=[0,1,2,3,4],xticks=[0,1],xticklabels=['Available on\nMarch 6','Latest in\nlater archive'],xlabel='Training-value selection',ylabel='March forecast (index points)')
 for ax in axes:
  ax.grid(axis='y',alpha=.18);ax.set_axisbelow(True);ax.tick_params(labelsize=14);ax.xaxis.label.set_fontsize(14);ax.yaxis.label.set_fontsize(14)
 if stacked:
  for ax in axes:
   ax.title.set_fontsize(17);ax.tick_params(labelsize=15);ax.xaxis.label.set_fontsize(16);ax.yaxis.label.set_fontsize(16)
   for t in ax.texts:t.set_fontsize(14)
 return fig
fig=figure(False)
for ext in ['svg','png','pdf']:fig.savefig(OUT/f'clocks.{ext}',dpi=180)
plt.close(fig)
fig=figure(True);fig.savefig(OUT/'clocks-stacked.svg');fig.savefig(OUT/'clocks-print.pdf',metadata={'Creator':'Ian Helfrich'});plt.close(fig)
