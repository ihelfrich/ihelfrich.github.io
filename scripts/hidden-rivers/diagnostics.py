"""Finite-time deformation and covariant horizontal gradients from bundled HYCOM.

Run from repository root: python scripts/hidden-rivers/diagnostics.py
No new network request: inputs are the exact int16 velocity files served by site.
All integration uses float64; only final display fields are stored as float32.
"""
from pathlib import Path
import argparse
import hashlib
import json
import numpy as np

R = 6_371_000.0
DAY = 86_400.0
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/hidden-rivers/data'


def spherical_gradients(u, v, latitudes, dlon_degrees, dlat_degrees):
    """Covariant velocity gradient in local east/north orthonormal bases.

    Central differences only. Domain rim and every missing center or neighbor
    are masked. Leading dimensions (such as time) are retained.
    """
    phi = np.radians(latitudes).reshape((1,) * (u.ndim - 2) + (-1, 1))
    dx = R * np.cos(phi) * np.radians(dlon_degrees)
    dy = R * np.radians(dlat_degrees)
    ux = np.full_like(u, np.nan, dtype=float)
    vx = ux.copy(); uy = ux.copy(); vy = ux.copy()
    ux[..., 1:-1, 1:-1] = (u[..., 1:-1, 2:] - u[..., 1:-1, :-2]) / (2 * dx[..., 1:-1, :])
    vx[..., 1:-1, 1:-1] = (v[..., 1:-1, 2:] - v[..., 1:-1, :-2]) / (2 * dx[..., 1:-1, :])
    uy[..., 1:-1, 1:-1] = (u[..., 2:, 1:-1] - u[..., :-2, 1:-1]) / (2 * dy)
    vy[..., 1:-1, 1:-1] = (v[..., 2:, 1:-1] - v[..., :-2, 1:-1]) / (2 * dy)
    a = ux - v * np.tan(phi) / R
    b = uy
    c = vx + u * np.tan(phi) / R
    d = vy
    mask = np.isfinite(a+b+c+d+u+v)
    vorticity = np.where(mask, c-b, np.nan)
    strain = np.where(mask, np.hypot(a-d, b+c), np.nan)
    return dict(vorticity=vorticity, strain=strain,
                divergence=np.where(mask, a+d, np.nan),
                okuboWeiss=strain**2-vorticity**2)


class Velocity:
    def __init__(self, metadata, values):
        self.meta, self.values = metadata, values
        self.nt, self.ny, self.nx = metadata['shape']
        self.time_step = metadata.get('timeStepSeconds', DAY)

    def rate(self, p, seconds):
        """Grid-cell rates per second. Strict mask at all interpolation corners."""
        x, y = p[..., 0], p[..., 1]
        inside = np.isfinite(x+y) & (x>=0) & (y>=0) & (x<self.nx-1) & (y<self.ny-1)
        if seconds < 0 or seconds > (self.nt-1)*self.time_step:
            return np.full_like(p, np.nan)
        sx, sy = np.where(inside,x,0), np.where(inside,y,0)
        ix, iy = sx.astype(int), sy.astype(int)
        ax, ay = sx-ix, sy-iy
        ti = min(self.nt-2, int(seconds/self.time_step)); at = seconds/self.time_step-ti
        uv = np.zeros((2,)+x.shape)
        for j, weight in ((0,(1-ax)*(1-ay)), (1,ax*(1-ay)), (2,(1-ax)*ay), (3,ax*ay)):
            for off, tw in ((0,1-at),(1,at)):
                if tw == 0:
                    continue
                val = self.values[:,ti+off,iy+(j//2),ix+(j%2)]
                inside &= np.all(np.isfinite(val),axis=0)
                uv += val * weight * tw
        phi = np.radians(self.meta['lat0']+sy*self.meta['dlat'])
        dx = uv[0] / (R*np.cos(phi)*np.radians(self.meta['dlon']))
        dy = uv[1] / (R*np.radians(self.meta['dlat']))
        return np.where(inside[...,None],np.stack((dx,dy),axis=-1),np.nan)


def integrate(rate, initial, start, horizon, dt):
    """Classical fourth-order Runge-Kutta with a full, never-shortened horizon.

    Masked particles stay masked; there is no reseeding. An extra endpoint
    sample ensures trajectories ending outside the supported grid are masked.
    """
    p = np.asarray(initial,dtype=float).copy()
    elapsed = 0.0
    while elapsed < horizon:
        h = min(dt,horizon-elapsed); t=start+elapsed
        k1=rate(p,t); k2=rate(p+h*k1/2,t+h/2)
        k3=rate(p+h*k2/2,t+h/2); k4=rate(p+h*k3,t+h)
        p += h/6*(k1+2*k2+2*k3+k4)
        elapsed += h
    return np.where(np.isfinite(rate(p,start+horizon)).all(axis=-1)[...,None],p,np.nan)


def largest_ftle(jacobian, horizon):
    """log(sqrt(lambda_max(F.T F))) / T, with an analytic 2x2 eigenvalue."""
    a,b,c,d=(jacobian[...,0,0],jacobian[...,0,1],jacobian[...,1,0],jacobian[...,1,1])
    q=a*a+c*c; r=b*b+d*d; s=a*b+c*d
    eigenvalue=(q+r+np.sqrt((q-r)**2+4*s*s))/2
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.log(eigenvalue)/(2*horizon)


def ftle(velocity, seeds, start, horizon=2*DAY, dt=900, epsilon=.25):
    """Metric-correct forward FTLE using five trajectories per seed.

    Neighbors begin +/- epsilon SOURCE cells east/west/north/south. Endpoint
    differences are measured in the central endpoint's local tangent basis;
    initial differences are measured in the seed's local tangent basis.
    """
    offsets=np.array([[0,0],[epsilon,0],[-epsilon,0],[0,epsilon],[0,-epsilon]])
    final=integrate(velocity.rate,seeds[...,None,:]+offsets,start,horizon,dt)
    scale=np.radians([velocity.meta['dlon'],velocity.meta['dlat']])
    angles=final*scale
    phi0=np.radians(velocity.meta['lat0']+seeds[...,1]*velocity.meta['dlat'])
    phi1=np.radians(velocity.meta['lat0']+final[...,0,1]*velocity.meta['dlat'])
    dlon=(angles[...,1,:]-angles[...,2,:])/(2*epsilon*scale[0])
    dlat=(angles[...,3,:]-angles[...,4,:])/(2*epsilon*scale[1])
    F=np.empty(seeds.shape[:-1]+(2,2))
    F[...,0,0]=np.cos(phi1)/np.cos(phi0)*dlon[...,0]
    F[...,1,0]=dlon[...,1]/np.cos(phi0)
    F[...,0,1]=np.cos(phi1)*dlat[...,0]
    F[...,1,1]=dlat[...,1]
    return largest_ftle(F,horizon)*DAY


def stats(a):
    finite=a[np.isfinite(a)]
    if not finite.size:return dict(valid=0,total=a.size)
    return dict(valid=int(finite.size),total=int(a.size),minimum=float(finite.min()),
                median=float(np.median(finite)),p95=float(np.percentile(finite,95)),
                p99=float(np.percentile(finite,99)),maximum=float(finite.max()))


def comparison(a,b):
    good=np.isfinite(a)&np.isfinite(b)
    return dict(commonValid=int(good.sum()),maskDisagreement=int((np.isfinite(a)^np.isfinite(b)).sum()),
                absoluteDifferencePerDay=stats(np.abs(a[good]-b[good])))


def build(data=DATA,stride=2):
    manifest=json.loads((data/'manifest.json').read_text())
    diagnostic=dict(schemaVersion=1,created='2026-10-07',source=manifest['source'],
        earthRadiusMetres=R,encoding='float32 little-endian; C order [time,latitude,longitude]; NaN is masked',
        sourceManifest='manifest.json', sourceRequestManifest=manifest.get('provenance','source-requests.json'),
        inputTimeStepSeconds=manifest.get('timeStepSeconds'),
        inputTimeStepsSeconds=sorted({layer.get('timeStepSeconds',DAY) for region in manifest['regions'] for layer in region['layers']}),
        method=dict(gradient='Central differences of the covariant spherical horizontal velocity gradient',
          advection='RK4; bilinear space and linear time interpolation', integrationStepSeconds=900,
          ftleHorizonHours=48, ftlePerturbationSourceGridCells=.25, diagnosticGridStride=stride,
          temporalSampling='Input cadence is recorded per layer. Daily diagnostic display frames; four daily 48 h FTLE starts across the five-day input window. No extrapolation.',
          mask='Gradient center and four neighbors must be valid. FTLE requires central and all four perturbed trajectories to survive the full 48 h within valid interpolation cells. Never reseed FTLE trajectories.',
          ftleDefinition='ln(sqrt(lambda_max(F_transpose F)))/T, with F measured in initial and final local east/north metric bases; displayed in day^-1.'),
        limitations=[
          'Depth-fixed horizontal trajectories omit vertical velocity and cross-depth exchange.',
          'Three-hour input sampling and spatial decimation limit resolved motion; integration accuracy cannot recover unresolved frequencies or scales.',
          'FTLE indicates finite-time separation, including shear; ridges are not by themselves verified material transport barriers.',
          'Okubo-Weiss is an instantaneous strain-versus-rotation diagnostic, not a validated eddy boundary.',
          'Missing trajectories and domain exits reduce coverage; masks must never be displayed as zero.',
          'Convergence checks quantify numerical sensitivity within these same sampled model fields, not agreement with observations.',
          'Velocity quantization is 0.001 m/s. Derivatives and trajectories cannot resolve scales finer than the source sampling.',
          'Tessera coastal embeddings are separate annual land/coastal context, not an ocean velocity measurement.'
        ],sources=[
          'https://www.hycom.org/dataserver/espc-d-v02/global-analysis',
          'https://doi.org/10.1146/annurev-fluid-010313-141322',
          'https://georgehaller.com/reprints/PhysToday.pdf',
          'https://ncas-cms.github.io/cf-python/function/cf.relative_vorticity.html',
          'https://mitgcm.org/public/r2_manual/latest/online_documents/node62.html'
        ],regions=[])
    for region in manifest['regions']:
        target=dict(id=region['id'],layers=[]);diagnostic['regions'].append(target)
        for m in region['layers']:
            print('Computing',region['id'],m['depth'],flush=True)
            raw=(data/m['file']).read_bytes()
            encoded=np.frombuffer(raw,dtype='<i2').reshape((2,)+tuple(m['shape']))
            values=np.where(encoded == -32768,np.nan,encoded.astype(float)*manifest['velocityScale'])
            velocity=Velocity(m,values)
            nt,ny,nx=m['shape']; yy,xx=np.mgrid[0:ny:stride,0:nx:stride]
            frames_per_day=int(DAY/velocity.time_step)
            assert abs(frames_per_day*velocity.time_step-DAY)<1e-6
            daily_dates=m['dates'][::frames_per_day]
            start_days=range(len(daily_dates)-2)
            seeds=np.stack((xx,yy),axis=-1)
            metadata=dict(depth=m['depth'],grid=dict(shape=list(xx.shape),lon0=m['lon0'],lat0=m['lat0'],
                          dlon=m['dlon']*stride,dlat=m['dlat']*stride),fields={},
                          sourceFile=m['file'],sourceSha256=hashlib.sha256(raw).hexdigest(),
                          inputTimeStepSeconds=velocity.time_step,inputFrames=nt)
            fields={k:v[::frames_per_day,::stride,::stride] for k,v in spherical_gradients(values[0],values[1],
                    m['lat0']+np.arange(ny)*m['dlat'],m['dlon'],m['dlat']).items()}
            fields['ftle']=np.stack([ftle(velocity,seeds,start*DAY) for start in start_days])
            # Numerical sensitivity audit across the whole region on every 4th diagnostic seed.
            # Check every available start time, so coastal mask sensitivity is reported too.
            checkseeds=seeds[::4,::4]
            reference=fields['ftle'][:,::4,::4]
            halfstep=np.stack([ftle(velocity,checkseeds,start*DAY,dt=450) for start in start_days])
            halfpert=np.stack([ftle(velocity,checkseeds,start*DAY,epsilon=.125) for start in start_days])
            metadata['validation']=dict(seedGridShape=list(checkseeds.shape[:-1]),startDates=daily_dates[:-2],
                timestep900Versus450Seconds=comparison(reference,halfstep),
                perturbationQuarterVersusEighthCell=comparison(reference,halfpert))
            if frames_per_day > 1:
                daily_metadata={**m,'shape':[len(daily_dates),ny,nx],'timeStepSeconds':DAY,'dates':daily_dates}
                daily_velocity=Velocity(daily_metadata,values[:,::frames_per_day])
                daily_ftle=np.stack([ftle(daily_velocity,checkseeds,start*DAY) for start in start_days])
                metadata['validation']['inputCadenceVersusDaily']=comparison(reference,daily_ftle)
                metadata['validation']['inputCadenceComparisonNote']='Same spatial grid, integration settings, seeds, and dates. Three-hour inputs versus every eighth snapshot from those same inputs. Sensitivity to temporal sampling, not an observational error estimate.'
            for name,a in fields.items():
                file=f'diagnostics_{region["id"]}_{m["depth"]}_{name}.bin'
                a.astype('<f4').tofile(data/file)
                units='day^-1' if name=='ftle' else 's^-2' if name=='okuboWeiss' else 's^-1'
                entry=dict(file=file,sha256=hashlib.sha256((data/file).read_bytes()).hexdigest(),shape=list(a.shape),dates=daily_dates[:len(a)],units=units,
                           stats=stats(a),frames=[stats(frame) for frame in a])
                if name=='ftle':entry['horizonHours']=48
                metadata['fields'][name]=entry
            target['layers'].append(metadata)
    # Shared color limits across regions/depths/dates; values remain unclipped on disk.
    for name in ['vorticity','strain','divergence','okuboWeiss','ftle']:
        arrays=[np.fromfile(data/l['fields'][name]['file'],dtype='<f4') for r in diagnostic['regions'] for l in r['layers']]
        allvalues=np.concatenate(arrays); allvalues=allvalues[np.isfinite(allvalues)]
        signed=name in ['vorticity','divergence','okuboWeiss']
        limit=float(np.percentile(np.abs(allvalues) if signed else allvalues,98))
        for r in diagnostic['regions']:
            for l in r['layers']:
                lower=-limit if signed else min(0.,float(np.percentile(allvalues,2))) if name=='ftle' else 0
                l['fields'][name]['displayDomain']=[lower,limit]
                l['fields'][name]['displayClipping']='Shared all-region, all-depth, all-date 98th-percentile absolute limit for signed fields; nonnegative fields use p98. FTLE lower bound is min(0,p02). Values outside these display bounds remain available numerically.'
    (data/'diagnostics.json').write_text(json.dumps(diagnostic,indent=2,allow_nan=False)+'\n')
    print('Wrote',data/'diagnostics.json',flush=True)


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--data',type=Path,default=DATA)
    args=parser.parse_args();build(args.data)
