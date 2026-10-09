"""Recreate the edition's original scientific figures from fixed course inputs."""
from pathlib import Path
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from course import fixtures,ar,acf,kalman,garch_variance,normals,df_stat
from projects import load,forecast

ROOT=Path(__file__).resolve().parent;OUTPUT=ROOT.parent/'figures';OUTPUT.mkdir(exist_ok=True)
plt.rcParams.update({'font.size':12,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none','pdf.fonttype':42,'figure.facecolor':'white','axes.labelcolor':'#142b49','text.color':'#142b49','xtick.color':'#142b49','ytick.color':'#142b49'})
ink='#142b49';blue='#3156e8';red='#9e4d38';teal='#28706b'

def save(name,figure):
    figure.tight_layout()
    for extension in ['svg','png','pdf']:figure.savefig(OUTPUT/f'{name}.{extension}',dpi=180,bbox_inches='tight')
    plt.close(figure)

fig,ax=plt.subplots(figsize=(8,4.7));ax.set_xlim(-.5,9.5);ax.set_ylim(-1.8,2.1);ax.axis('off')
ax.plot([0,9],[0,0],color=ink,lw=1.4)
for t in range(10):
    ax.plot([t,t],[-.06,.06],color=ink);ax.text(t,-.26,str(t),ha='center',fontsize=11)
ax.add_patch(Rectangle((-.2,.35),6.4,.55,facecolor=blue,alpha=.13,edgecolor=blue))
ax.text(3,.62,'Records available through period 6',ha='center',fontsize=13)
ax.annotate('Decision at 8',xy=(8,0),xytext=(7.9,1.45),ha='right',arrowprops={'arrowstyle':'->','color':ink},fontsize=14)
ax.scatter([9],[0],color=red,s=55);ax.annotate('Target: period 9',xy=(9,0),xytext=(9,1),ha='right',arrowprops={'arrowstyle':'->','color':red},color=red,fontsize=14)
ax.text(4.5,-.85,'Periods 7 and 8 describe the past but are not yet released.',ha='center',fontsize=12)
ax.text(4.5,-1.35,'Illustrative two-period availability lag',ha='center',fontsize=11,color=ink)
save('information-clock',fig)

E=fixtures();e=E[:,0];f=E[:,1]
fig,axs=plt.subplots(1,2,figsize=(9,3.8));h=np.arange(13)
for phi in [0,.7,-.7,.95]:
    axs[0].plot(h,phi**h,marker='o',ms=3,label=f'φ = {phi:g}')
    axs[1].plot(h[1:],[sum(phi**(2*j) for j in range(k)) for k in h[1:]],label=f'φ = {phi:g}')
axs[0].set(xlabel='Horizon',ylabel='Unit-shock response');axs[1].set(xlabel='Horizon',ylabel='Error variance, innovation variance = 1')
axs[0].axhline(0,color=ink,lw=.5);axs[0].legend(fontsize=10);save('ar-persistence',fig)

fig,ax=plt.subplots(figsize=(8,3.8));n=np.array([80,240,720]);rates=[];errors=[]
for size in n:
    probability=np.mean([df_stat(np.cumsum(normals(int(size),515+i)))< -2.86 for i in range(200)])
    rates.append(probability);errors.append(1.96*np.sqrt(probability*(1-probability)/200))
ax.errorbar(n,rates,yerr=errors,fmt='o',color=blue,capsize=5,label='Simulation proportion ± 1.96 MCSE')
ax.axhline(.05,color=ink,ls='--',label='Nominal reference: 0.05');ax.set(xlabel='Observations per replication',ylabel='Rejection proportion',ylim=(0,.13));ax.legend(fontsize=10);save('unit-root-simulation',fig)

state=ar(.5*e[:360],.8);y=state+f[:360];y[150]=np.nan;m,P,s,S=kalman(y)
fig,ax=plt.subplots(figsize=(9,3.8));t=np.arange(110,191)
ax.plot(t,state[t],color=ink,label='Known simulated state');ax.plot(t,m[t],color=blue,label='Filtered estimate');ax.plot(t,s[t],color=red,label='Retrospective smoother')
ax.fill_between(t,m[t]-1.96*np.sqrt(P[t]),m[t]+1.96*np.sqrt(P[t]),color=blue,alpha=.12,label='Filter conditional 95% band')
ax.axvline(150,color=teal,ls=':',label='Missing observation');ax.set(xlabel='Observation index',ylabel='State units');ax.legend(fontsize=9,ncol=2);save('state-filter',fig)

x=np.cumsum(e[:240]);spread=ar(.4*f[:240],.5);y=1.5*x+spread
fig,axs=plt.subplots(2,1,figsize=(8,5),sharex=True)
axs[0].plot(x,color=blue,label='X: common trend');axs[0].plot(y,color=red,label='Y = 1.5 X + spread');axs[0].set(ylabel='Level units');axs[0].legend(fontsize=10)
axs[1].plot(spread,color=ink);axs[1].axhline(0,color=ink,lw=.5);axs[1].set(xlabel='Observation index',ylabel='Y − 1.5 X');save('cointegrated-spread',fig)

u=np.zeros(1024);v=np.ones(1024)
for t in range(1024):
    if t:v[t]=.1+.1*u[t-1]**2+.8*v[t-1]
    u[t]=np.sqrt(v[t])*e[t]
fig,axs=plt.subplots(2,1,figsize=(9,5),sharex=True);t=np.arange(300)
axs[0].plot(t,u[:300],color=ink,lw=.9);axs[0].set(ylabel='Simulated return units')
axs[1].plot(t,v[:300],color=blue);axs[1].set(xlabel='Observation index',ylabel='Conditional variance');save('volatility',fig)

y=np.zeros(480)
for t in range(1,480):y[t]=(.8 if t<300 else -.4)*y[t-1]+e[t]
fig,ax=plt.subplots(figsize=(9,3.7));ax.plot(y,color=ink,lw=.9);ax.axvline(300,color=red,ls='--',label='Designed coefficient change: 0.8 to −0.4');ax.set(xlabel='Observation index',ylabel='Simulated outcome');ax.legend(fontsize=10);save('changing-dynamics',fig)

periods,y,temp=load();targets=np.arange(180,192);actual=y[targets];naive=np.array([forecast(y,temp,int(t),'naive') for t in targets]);calendar=np.array([forecast(y,temp,int(t),'calendar',60) for t in targets])
fig,ax=plt.subplots(figsize=(9,4));ax.plot(targets,actual,color=ink,marker='o',label='Observed sales');ax.plot(targets,naive,color=teal,marker='s',label='Seasonal naive');ax.plot(targets,calendar,color=blue,marker='^',label='Frozen calendar repair')
ax.set_xticks(targets);ax.set_xticklabels([p[5:] for p in np.array(periods)[targets]]);ax.set(xlabel='2025 target month',ylabel='Residential sales, million MWh');ax.legend(fontsize=10);save('texas-continuation',fig)

# Public simulator values are precomputed by the same tested implementation.
# They are ungraded teaching data, not a secure live-assessment holdout.
room=[]
for target in range(120,192):
    methods={name:forecast(y,temp,target,name,60 if name=='calendar' else 0) for name in ['naive','ar','calendar']}
    room.append({'origin':periods[target-1],'target':periods[target],'latest':periods[target-3],'actual':float(y[target]),'forecasts':methods,'history':[[periods[t],float(y[t])] for t in range(max(0,target-15),target-2)]})
(ROOT.parent/'forecast-room.json').write_text(json.dumps(room,separators=(',',':'))+'\n')
print(f'Recreated {len(list(OUTPUT.glob("*.svg")))} scientific figures and 72 forecast-room periods.')
