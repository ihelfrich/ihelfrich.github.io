# Mathematical Economics draft review

Author-reviewed draft: 60 original constructed questions, six units of ten, with exactly three full-string distractors per question, explanations, method hints, source URLs and draft/constructed metadata. Only the three assigned repository files were written. No activation, runtime edits, shared logs or commits.

## Source verification and level

Verified October 13, 2026:

- MIT 14.102, Mathematics for Economists, Fall 2005: https://web.mit.edu/14.102/www/syllabus.html. Official outline covers real analysis, compactness, convex sets, linear systems, rank, eigenvalues, projections, multivariate calculus, implicit functions, Taylor approximation and constrained optimization/KKT.
- UC Berkeley Econ 204, Mathematical Tools for Economists, Summer/Fall 2024: https://eml.berkeley.edu/~hie/econ204/Syllabus.pdf. Official syllabus includes matrix representation, diagonalization, quadratic forms, Taylor theory and difference/differential equations, with a substantial prior mathematics requirement.
- MIT 14.451, Dynamic Optimization Methods with Applications, Fall 2009: https://ocw.mit.edu/courses/14-451-dynamic-optimization-methods-with-applications-fall-2009/pages/syllabus/. Official course covers discrete/continuous dynamic optimization and resulting dynamic systems; its graduate level motivates the explicitly marked extensions.

These are official materials from two R1 institutions. Their scope guides this new course; examples are independently constructed, not copied assessments or empirical claims. The course distinguishes foundational computations from advanced KKT qualification, duality and fixed-point/dynamic-programming topics. It does not claim that single-variable calculus alone prepares a student for the complete source courses; prerequisite and extension requirements appear in the outline and description. No exact Mathematical Economics entry was found in the local curriculum-plan search; the requested course was organized from the verified subject outlines.

## Verification method and corrections

Applied the symbolic-verify skill: formal algebraic claims were checked in SymPy before derived keys were written, followed by seeded numerical checks. The runnable verification code is preserved below inside this review to respect the explicit three-file authoring boundary. It checks equations and algebra; it is not a proof assistant for quantified fixed-point theorems. Theorems’ hypotheses and conclusions were separately reviewed item by item.

Executed output:

```text
PASS: exact symbolic/algebraic checks and 20 seeded numerical checks; domains explicit.
PASS: additional 20 seeded path/implicit/value checks, KKT residuals and boundary stability checks.
```

Two initial verification assertions compared equivalent expressions structurally: factored characteristic polynomials and inequalities printed as x>0 versus 0<x. Replaced them with symbolic simplification/equivalence checks; both then passed. These were verification-code representation repairs, not corrections to mathematical keys. No mathematical answer needed repair. The exact code below contains the repaired assertions.

Checked signs under explicitly stated Lagrangian conventions, feasibility at boundary optima, multiplier complementarity, qualification failure, positive/negative definiteness, optimizer uniqueness versus existence, fixed-point existence versus iteration convergence, and finite versus infinite-horizon terminal behavior. Every mathematical model states a domain; a local implicit function uses a nonzero endogenous derivative. Approximation 1.105 is labeled a Taylor approximation rather than an exact exponential value.

Final saved-file checks verify 60 unique IDs/topics, six units of ten, four distinct answer options each, nonempty explanations/hints/sources, draft/constructed labels and exact outline correspondence. Parent independently reviewed the first 40 items and reported no blocking findings. No rendered-page or runtime validation was performed within this content-only assignment. Literal mathematical terms such as “undefined” appear only where semantically appropriate and should not be mechanically treated as missing data.

## Item-by-item self-review

| Topic | Check performed |
|---|---|
| 1.1 | Inverted nonsingular matrix; unique solution (2,1). |
| 1.2 | Coefficient and augmented ranks both one; one free variable, not inconsistency. |
| 1.3 | Augmented rank two exceeds coefficient rank one; no solution. |
| 1.4 | Triangular transition eigenvalues are 0.8 and 0.5. |
| 1.5 | Inverse first column gives responses 3/5 and −1/5. |
| 1.6 | Gross outputs (10,20) satisfy q=Aq+d, not merely final demand. |
| 1.7 | Positive eigenvalues 1,3 imply positive definite quadratic form. |
| 1.8 | Hessian eigenvalues −4,0 and constant lines rule out strict concavity. |
| 1.9 | Orthogonal projection (2,2); residual (1,−1) orthogonal to (1,1). |
| 1.10 | One independent equality defines a two-dimensional affine plane excluding origin. |
| 2.1 | Gradient components 2xy and x²+1/y give (4,5); positive log domain explicit. |
| 2.2 | Path output 3t³ gives derivative 36 at t=2. |
| 2.3 | Implicit slope −x/y=−3/4 with nonzero denominator. |
| 2.4 | Demand slope −q/(2q+p)=−2/5; numerical positive-root derivative confirmed. |
| 2.5 | Constant Hessian first minor −2, determinant 4 gives strict concavity/global maximum. |
| 2.6 | Opposite coordinate-direction signs establish saddle, not an extremum. |
| 2.7 | Taylor polynomial at 0.1 gives 221/200; approximation correctly labeled. |
| 2.8 | Signed elasticity simplifies to −2 for all p>0. |
| 2.9 | Symbolic and random-point Euler identity verified on positive domain. |
| 2.10 | Optimizer a/2 and value a²/4 imply V′(4)=2. |
| 3.1 | Reduced quadratic on [0,10] gives unique maximum (5,5), endpoints checked. |
| 3.2 | Specified multiplier convention gives λ=6, not −6. |
| 3.3 | Log KKT system yields (3,6), λ=1/6; budget binds and objective strictly concave. |
| 3.4 | Upper boundary binds; stationarity gives λ=2, lower multiplier zero. |
| 3.5 | Unconstrained optimizer feasible and inequality slack; λ=0 despite unbounded domain. |
| 3.6 | Positive slack forces zero multiplier; complementary slackness alone not sufficient. |
| 3.7 | Increasing square root maximized at upper endpoint; zero derivative not required. |
| 3.8 | Singleton feasible set has optimum but no stationarity multiplier because gradient vanishes. |
| 3.9 | Cauchy–Schwarz bound √2 attained uniquely at equal positive coordinates on circle. |
| 3.10 | Product nonnegative; exactly two zero-product endpoints minimize it. |
| 4.1 | Positive-domain product requirement is epigraph of convex 1/x. |
| 4.2 | Feasible −1 and 1 have infeasible midpoint zero. |
| 4.3 | Strict concavity ensures at most one maximizer, not existence without more hypotheses. |
| 4.4 | Continuity plus nonempty compactness gives attainment, not uniqueness/interiority. |
| 4.5 | Supremum one lies outside the open domain; no maximum. |
| 4.6 | ln(2.5)>ln2 is strict Jensen for two distinct positive consumptions. |
| 4.7 | Cost q min(w,r) gives six at (3,0); tie-price nondifferentiability noted. |
| 4.8 | Conjugate optimum x=p gives p²/2 on all real p. |
| 4.9 | Both primal and dual candidates feasible with value ten; weak duality certificate valid. |
| 4.10 | Value max(0,a) continuous with unequal one-sided slopes; full optimizer set at zero. |
| 5.1 | Fixed-point equation gives six. |
| 5.2 | Closed path checked against initial condition, symbolic recurrence and random iterative paths. |
| 5.3 | Negative factor −0.5 alternates sign and halves magnitude around two. |
| 5.4 | Factor 1.2 grows nonzero deviations; exact zero remains fixed. |
| 5.5 | Drift gives x0+2t and inconsistent finite steady-state equation. |
| 5.6 | Characteristic roots 0.5,0.2 inside unit circle imply all real initial solutions decay. |
| 5.7 | ODE solution checked by differentiation and initial condition, including seeded numerical points. |
| 5.8 | Flow/derivative signs identify one-sided repulsion at zero and attraction at one. |
| 5.9 | Stable manifold requires only the growing component’s initial coefficient to vanish. |
| 5.10 | Solved |1−2h|<1; boundary h=1 yields nondecaying oscillations. |
| 6.1 | Brouwer assumptions support existence only; neither uniqueness nor iterative convergence promised. |
| 6.2 | Complete-space contraction factor 0.3 gives unique fixed point one and global iteration convergence. |
| 6.3 | T=1−x has unique fixed point but initial 0.2 cycles with 0.8. |
| 6.4 | Constant correspondence has nonconvex values; theorem unavailable although actual fixed points exist. |
| 6.5 | Bellman action values 7 and 6 use correctly discounted continuation. |
| 6.6 | Displayed contraction bound gives 1.8; not claimed exact realized error. |
| 6.7 | Strictly concave two-period log choice yields (2,1); boundary utility diverges downward. |
| 6.8 | Terminal linear utility exhausts stock, including k=0 case. |
| 6.9 | Wealth alone fails to distinguish productivity-dependent transition distributions. |
| 6.10 | Discounted terminal term equals (3/2)^T and diverges despite β<1. |

## Reproducible verification code

Run this code with Python and SymPy. It uses exact arithmetic wherever possible and seed 42 for numerical checks. The tests check the algebraic claims listed above; conceptual theorem scope is assessed in the review table.

```python
import sympy as s
import random
x,y,z,a,p,t=s.symbols('x y z a p t', real=True)
xp,yp=s.symbols('xp yp', positive=True)
A=s.Matrix([[2,1],[1,3]])
assert A.inv()*s.Matrix([5,5])==s.Matrix([2,1])
assert s.Matrix([[1,2],[2,4]]).rank()==1
assert s.Matrix([[1,2,3],[2,4,7]]).rank()==2
assert s.Matrix([[s.Rational(4,5),0],[s.Rational(1,10),s.Rational(1,2)]]).eigenvals()=={s.Rational(4,5):1,s.Rational(1,2):1}
assert A.inv()*s.Matrix([1,0])==s.Matrix([s.Rational(3,5),-s.Rational(1,5)])
assert (s.eye(2)-s.diag(s.Rational(1,5),s.Rational(2,5))).inv()*s.Matrix([8,12])==s.Matrix([10,20])
assert s.Matrix([[2,1],[1,2]]).eigenvals()=={1:1,3:1}
assert s.hessian(-(x+y)**2,(x,y)).eigenvals()=={-4:1,0:1}
v=s.Matrix([1,1]);b=s.Matrix([3,1]);assert v*(v.dot(b)/v.dot(v))==s.Matrix([2,2])
f=x*x*y+s.log(y);assert s.Matrix([s.diff(f,x),s.diff(f,y)]).subs({x:2,y:1})==s.Matrix([4,5])
assert s.diff((t*t)*(3*t),t).subs(t,2)==36
assert (-x/y).subs({x:3,y:4})==-s.Rational(3,4)
assert (-y/(2*y+p)).subs({y:2,p:1})==-s.Rational(2,5)
H=s.hessian(-x*x-2*y*y+2*x*y,(x,y));assert H[0,0]==-2 and H.det()==4
assert s.hessian(x*x-y*y,(x,y)).det()==-4
assert (1+x+x*x/2).subs(x,s.Rational(1,10))==s.Rational(221,200)
assert s.simplify(s.diff(3/p**2,p)*p/(3/p**2))==-2
f=s.sqrt(xp*yp);assert s.simplify(xp*s.diff(f,xp)+yp*s.diff(f,yp)-f)==0
assert s.simplify((a*x-x*x).subs(x,a/2)-a*a/4)==0
assert s.diff(a*a/4,a)==a/2
assert s.solve(s.diff(x*(10-x),x),x)==[5]
assert s.solve(s.diff(x*x+(6-x)**2,x),x)==[3]
assert s.solve(s.diff(s.log(x)+s.log(12-2*x),x),x)==[3]
assert s.diff(-(x-3)**2,x).subs(x,2)==2
assert s.diff(-(x-1)**2,x).subs(x,1)==0
assert s.diff(x-s.symbols('lam')*x*x,x).subs(x,0)==1
assert s.simplify(2*(1/s.sqrt(2))**2)==1
assert s.diff(1/xp,xp,2)==2/xp**3
assert s.log(s.Rational(5,2))>s.log(2)
assert s.simplify((p*x-x*x/2).subs(x,p)-p*p/2)==0
# LP primal (2,2), dual (2,1): objective 10, both constraints satisfied.
assert 3*2+2*2==4*2+2*1==10
assert s.solve(s.Eq(x,s.Rational(1,2)*x+3),x)==[6]
x0=s.symbols('x0',real=True);n=s.symbols('n',integer=True,nonnegative=True)
path=6+(x0-6)*s.Rational(1,2)**n
assert s.simplify(path.subs(n,n+1)-(path/2+3))==0
assert s.solve(s.Eq(x,3-x/2),x)==[2]
assert s.simplify(z*z-s.Rational(7,10)*z+s.Rational(1,10)-(z-s.Rational(1,2))*(z-s.Rational(1,5)))==0
ode=2+(x0-2)*s.exp(-2*t);assert s.simplify(s.diff(ode,t)-(4-2*ode))==0
assert s.diff(x*(1-x),x).subs(x,0)==1 and s.diff(x*(1-x),x).subs(x,1)==-1
assert s.diag(-1,2).eigenvals()=={-1:1,2:1}
assert s.simplify(s.Equivalent(s.solve_univariate_inequality(s.Abs(1-2*x)<1,x),s.And(0<x,x<1)))==s.true
assert s.solve(s.Eq(x,s.Rational(3,10)*x+s.Rational(7,10)),x)==[1]
assert s.solve(s.Eq(x,1-x),x)==[s.Rational(1,2)]
assert 3+s.Rational(1,2)*8==7 and 5+s.Rational(1,2)*2==6
assert s.Rational(9,10)*2==s.Rational(9,5)
assert s.solve(s.diff(s.log(x)+s.Rational(1,2)*s.log(3-x),x),x)==[2]
assert s.limit((s.Rational(3,4)*2)**n,n,s.oo)==s.oo
# Reproducible numerical checks of free-variable identities, away from singularities.
rng=random.Random(42)
for _ in range(20):
 xx=rng.uniform(.05,8); yy=rng.uniform(.05,8);aa=rng.uniform(-4,4);tt=rng.uniform(0,5);init=rng.uniform(-5,5)
 assert abs(float((xp*s.diff(f,xp)+yp*s.diff(f,yp)).subs({xp:xx,yp:yy}))-(xx*yy)**.5)<1e-10
 assert abs((aa*(aa/2)-(aa/2)**2)-aa**2/4)<1e-10
 assert abs(float((s.diff(ode,t)-(4-2*ode)).subs({x0:init,t:tt})))<1e-10
 pp=rng.uniform(.1,8)
 assert abs((-6/pp**3)*pp/(3/pp**2)+2)<1e-10
 assert abs((pp*pp-pp*pp/2)-pp*pp/2)<1e-10
print('PASS: exact symbolic/algebraic checks and 20 seeded numerical checks; domains explicit.')
# Additional numeric checks of recursion formulas, implicit slopes, and KKT points.
for _ in range(20):
 init=rng.uniform(-5,5); state=init
 for j in range(12):
  assert abs(state-(6+(init-6)*(.5**j)))<1e-10
  state=.5*state+3
 pp=rng.uniform(.1,6)
 qq=(-pp+(pp*pp+24)**.5)/2
 slope=(-1+pp/(pp*pp+24)**.5)/2
 assert abs(slope+qq/(2*qq+pp))<1e-10
 pp=rng.uniform(-5,5)
 assert max(0,pp)==max(pp*0,pp*1)
assert s.diff(s.log(x)+s.log(12-2*x),x,2).subs(x,3)<0
assert s.diff(s.log(x)+s.Rational(1,2)*s.log(3-x),x,2).subs(x,2)<0
assert s.diff(x*(1-x),x,2)==-2
# Resource log KKT: reciprocal marginal utilities equal price-scaled multiplier.
assert s.Rational(1,3)==2*s.Rational(1,6) and s.Rational(1,6)==s.Rational(1,6)
assert 2*3+6==12
for h in [.01,.25,.75,.99]:assert abs(1-2*h)<1
for h in [1,1.1,2]:assert abs(1-2*h)>=1
assert (1-.2)==.8 and abs(1-.8-.2)<1e-15
print('PASS: additional 20 seeded path/implicit/value checks, KKT residuals and boundary stability checks.')
```

## Remaining gate

Drafts await parent integration and release review. The course is a bounded set of methods exercises, not a complete proof-based mathematics sequence.

Parent integration: mathematical-economics-u6-01 explanation clarified. Final released source SHA256: 72154b5ba01696de1c5157d66b72313b76f56669c043b2703c973726acd6ba82.
