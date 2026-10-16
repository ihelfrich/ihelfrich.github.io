"""Original explanatory figures for the six-state alert example."""
from pathlib import Path
import csv
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent/'figures';OUT.mkdir(exist_ok=True)
with (ROOT/'data/alert-days.csv').open() as f:
    states=list(csv.DictReader(f))
plt.rcParams.update({'font.size':12,'axes.spines.top':False,'axes.spines.right':False,
                     'svg.fonttype':'none','pdf.fonttype':42,'font.family':'DejaVu Sans'})
def create_figure(stacked=False):
    fig,ax=plt.subplots(2,1,figsize=(5.3,8.4),layout='constrained') if stacked else plt.subplots(1,2,figsize=(10.5,4.2),layout='constrained')
    draw(ax)
    return fig

def draw(ax):
    draw_observed(ax[0])
    draw_assignment(ax[1])
    for i in range(2):
        ax[i].set(xticks=[0,1],xticklabels=['No alert','Alert'],yticks=[9,10,11,12,13],ylim=(8.6,13.7),
                  ylabel='Peak load (MW)',xlabel='Observed status' if i==0 else 'Assigned status')
        ax[i].grid(axis='y',alpha=.18)
    ax[0].set_xlim(-.16,1.3);ax[1].set_xlim(-.1,1.58)

a=[int(s['u']) for s in states]
y=[10+2*int(s['u'])+int(s['v_mw']) for s in states]
def draw_observed(ax):
    ax.scatter(a,y,s=65,facecolors='white',edgecolors='black',linewidths=1.5,zorder=3)
    ax.plot([0,1],[10,12],color='black',ls=':',lw=1.5)
    ax.scatter([0,1],[10,12],s=30,color='black',zorder=4)
    ax.set_title('Same observed days',loc='left',weight='bold',fontsize=13)
    ax.text(.07,10,'Mean 10',va='center',fontsize=11)
    ax.text(.57,12.05,'Mean 12',va='bottom',fontsize=11)
def draw_assignment(ax):
    for b,style in [(-2,'-'),(0,'--'),(2,':')]:
        means=[11+b*(assigned-.5) for assigned in (0,1)]
        ax.plot([0,1],means,color='black',ls=style,lw=1.8,marker='o',ms=4)
        ax.text(1.07,means[1],f'b = {b:+d} MW',va='center',fontsize=11)
    ax.set_title('Different assignment responses',loc='left',weight='bold',fontsize=13)
fig=create_figure()
for ext in ('svg','png','pdf'):
    fig.savefig(OUT/f'alert-worlds.{ext}',dpi=180,metadata={'Creator':'Ian Helfrich'} if ext=='pdf' else None)
plt.close(fig)
fig=create_figure(stacked=True)
fig.savefig(OUT/'alert-worlds-stacked.svg')
for axes in fig.axes:
    axes.title.set_fontsize(16)
    axes.xaxis.label.set_size(14)
    axes.yaxis.label.set_size(14)
    axes.tick_params(labelsize=14)
    for label in axes.texts:label.set_fontsize(14)
fig.savefig(OUT/'alert-worlds-print.pdf',metadata={'Creator':'Ian Helfrich'})
plt.close(fig)
