"""Original analytic graphic for Lecture 2's two-month forecast."""
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path(__file__).resolve().parent.parent/'figures'
plt.rcParams.update({'font.size':12,'svg.fonttype':'none','pdf.fonttype':42,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'white'})
fig,ax=plt.subplots(figsize=(8,4))
x=[0,1,2];y=[10,8,7]
ax.plot(x,y,'o-',color='#222222',lw=2,ms=7)
ax.axhline(6,color='#555555',ls='--',lw=1)
for t,value,gap in zip(x,y,[4,2,1]):
    ax.annotate(f'{value}',(t,value),xytext=(0,12),textcoords='offset points',ha='center')
    ax.annotate('',(t,6),(t,value),arrowprops={'arrowstyle':'|-|','color':'#555555'},annotation_clip=False)
    ax.text(t+.09,(value+6)/2,f'gap {gap}',fontsize=11,va='center')
ax.text(1.7,5.64,'reference level = 6',fontsize=11)
ax.set(xlim=(-.2,2.45),ylim=(5.4,11.4),ylabel='Indicator units',xlabel='Forecast month')
ax.set_xticks(x,['Today','One month','Two months']);ax.set_yticks([6,7,8,10])
fig.tight_layout()
for ext in ('svg','png','pdf'):fig.savefig(root/f'ar-two-step.{ext}',dpi=300,bbox_inches='tight')
plt.close(fig)
