"""Independent analytic tests of gradient geometry, RK4, FTLE, and masks."""
from pathlib import Path
import sys
import unittest
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'scripts/hidden-rivers'))
from diagnostics import R, DAY, Velocity, integrate, largest_ftle, ftle, spherical_gradients

class Diagnostics(unittest.TestCase):
    def test_planar_hyperbolic_flow_exact_ftle(self):
        # Exact solution x(t)=x0 exp(a t), y(t)=y0 exp(-a t).
        a=0.3/DAY; T=2*DAY
        jac=np.diag([np.exp(a*T),np.exp(-a*T)])
        self.assertAlmostEqual(largest_ftle(jac,T),a,places=15)
        seeds=np.array([[1.,0.],[0.,1.]])
        numerical=integrate(lambda p,t:p*np.array([a,-a]),seeds,0,T,900)
        np.testing.assert_allclose(numerical,jac,rtol=1e-12,atol=1e-12)

    def test_solid_spherical_rotation_has_vorticity_but_no_strain(self):
        # Rotation about Earth's polar axis: u=Omega R cos(phi), v=0.
        lat=np.linspace(-65,65,261); omega=1.e-5
        u=np.broadcast_to((omega*R*np.cos(np.radians(lat)))[:,None],(len(lat),9))
        v=np.zeros_like(u)
        result=spherical_gradients(u,v,lat,1,.5)
        expected=2*omega*np.sin(np.radians(lat[1:-1]))
        np.testing.assert_allclose(result['vorticity'][1:-1,4],expected,rtol=1e-5,atol=1e-12)
        self.assertLess(np.nanmax(result['strain']),1.2e-10)
        self.assertEqual(np.nanmax(np.abs(result['divergence'])),0)
        self.assertTrue(np.isnan(result['vorticity'][0]).all())

    def test_spherical_rotation_preserves_material_distances(self):
        # Analytic grid-rate constant longitude rotation, independent of gridding.
        m=dict(shape=[6,61,81],lat0=-50.,lon0=0.,dlat=.5,dlon=.5)
        class ExactRotation:
            meta=m
            @staticmethod
            def rate(p,t):
                return np.broadcast_to([0.1/DAY,0.],p.shape)
        seeds=np.array([[20.,10.],[30.,40.]])
        np.testing.assert_allclose(ftle(ExactRotation(),seeds,0),0,atol=1e-12)

    def test_spherical_meridional_contraction_metric(self):
        # Constant dphi/dt shifts latitude. A longitude separation contracts by
        # cos(phi_final)/cos(phi_initial); meridional separation remains 1.
        m=dict(shape=[6,61,81],lat0=20.,lon0=0.,dlat=.5,dlon=.5)
        class ExactNorth:
            meta=m
            @staticmethod
            def rate(p,t):return np.broadcast_to([0.,1./DAY],p.shape)
        seeds=np.array([[20.,10.],[30.,40.]])
        # Maximum singular value is 1, not a spurious growing longitude scale.
        np.testing.assert_allclose(ftle(ExactNorth(),seeds,0),0,atol=1e-12)

    def test_masked_velocity_stencil_never_extrapolates(self):
        m=dict(shape=[3,4,4],lat0=0.,lon0=0.,dlat=1.,dlon=1.)
        values=np.ones((2,3,4,4)); values[:,1,1,1]=np.nan
        velocity=Velocity(m,values)
        self.assertTrue(np.isnan(velocity.rate(np.array([[.5,.5]]),DAY)).all())
        self.assertTrue(np.isfinite(velocity.rate(np.array([[.5,.5]]),0)).all())
        self.assertTrue(np.isnan(velocity.rate(np.array([[4.,.5]]),0)).all())
        self.assertTrue(np.isnan(velocity.rate(np.array([[2.,2.]]),3*DAY)).all())

    def test_three_hour_input_interpolation(self):
        m=dict(shape=[3,4,4],lat0=0.,lon0=0.,dlat=1.,dlon=1.,timeStepSeconds=10800)
        values=np.ones((2,3,4,4));values[0,1]=3.;values[0,2]=5.;values[1]=0.
        velocity=Velocity(m,values)
        rate=velocity.rate(np.array([[.5,.5]]),5400)
        expected=2/(R*np.cos(np.radians(.5))*np.radians(1))
        self.assertAlmostEqual(rate[0,0],expected,places=15)
        self.assertTrue(np.isnan(velocity.rate(np.array([[.5,.5]]),21601)).all())

    def test_ftle_eigenvalue_matches_independent_svd(self):
        matrices=np.random.default_rng(77).normal(size=(100,2,2))
        singular=np.linalg.svd(matrices,compute_uv=False)[:,0]
        np.testing.assert_allclose(largest_ftle(matrices,2*DAY),np.log(singular)/(2*DAY),rtol=1e-12,atol=1e-15)

    def test_early_domain_exit_does_not_shorten_ftle_horizon(self):
        def rate(p,t):
            v=np.broadcast_to([1.,0.],p.shape)
            return np.where((p[...,0]<10)[...,None],v,np.nan)
        final=integrate(rate,np.array([[0.,0.]]),0,20,1)
        self.assertTrue(np.isnan(final).all())

if __name__=='__main__':unittest.main()
