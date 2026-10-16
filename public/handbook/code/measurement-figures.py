"""Original measurement figures generated from the released controlled fixture."""
from pathlib import Path
import csv
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent/'figures'
with (ROOT/'data/meter-states.csv').open() as f:
    records=list(csv.DictReader(f))
pairs=sorted({(int(r['x_mwh'])+2*int(r['z1']),30+50*int(r['x_mwh'])+int(r['epsilon_dollars'])) for r in records})
plt.rcParams.update({'font.family':'DejaVu Sans','svg.fonttype':'none','pdf.fonttype':42,
                     'axes.spines.top':False,'axes.spines.right':False})
def figure(stacked):
    fig,axes=plt.subplots(2,1,figsize=(5.5,8.7),layout='constrained') if stacked else plt.subplots(1,2,figsize=(10.6,4.7),layout='constrained')
    a,b=axes
    a.scatter(*zip(*pairs),facecolors='white',edgecolors='black',s=45,zorder=4)
    a.plot([6,14],[410,650],color='black',lw=2,label='Noisy-reading line')
    a.plot([6,14],[330,730],color='black',lw=1.8,ls='--',label='Perfect-reading line')
    a.set(xlim=(5,15),ylim=(300,760),xticks=[6,10,14],yticks=[350,500,650],
          xlabel='Recorded energy (MWh)',ylabel='Bill (dollars)')
    a.set_title('Random noise flattens the line',loc='left',fontsize=16,weight='bold')
    a.legend(frameon=False,fontsize=11,loc='upper left')
    b.bar([0,1],[10,12.5],color=['white','.75'],edgecolor='black',width=.6)
    b.set(ylim=(0,16),yticks=[0,5,10,15],xticks=[0,1],xticklabels=['Full count','Reduced count'],
          xlabel='Customer-file coverage',ylabel='MWh per recorded customer')
    b.set_title('Only coverage changes',loc='left',fontsize=16,weight='bold')
    b.text(0,10.5,'300 counted',ha='center',fontsize=12)
    b.text(1,13,'240 counted',ha='center',fontsize=12)
    for ax in axes:
        ax.grid(axis='y',alpha=.18);ax.set_axisbelow(True)
        ax.xaxis.label.set_fontsize(14);ax.yaxis.label.set_fontsize(14);ax.tick_params(labelsize=14)
    if stacked:
        for ax in axes:
            ax.title.set_fontsize(17);ax.xaxis.label.set_fontsize(16);ax.yaxis.label.set_fontsize(16);ax.tick_params(labelsize=16)
            for t in ax.texts:t.set_fontsize(15)
        a.legend(frameon=False,fontsize=14,loc='upper left')
    return fig
fig=figure(False)
for ext in ['svg','png','pdf']:fig.savefig(OUT/f'measurement.{ext}',dpi=180)
plt.close(fig)
fig=figure(True);fig.savefig(OUT/'measurement-stacked.svg')
fig.savefig(OUT/'measurement-print.pdf',metadata={'Creator':'Ian Helfrich'})
plt.close(fig)
