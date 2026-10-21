# Writes reference values from R for the distribution library tests.
# Run: Rscript scripts/make-distribution-reference.R   (needs jsonlite)
suppressPackageStartupMessages(library(jsonlite))
ps <- c(0.001, 0.025, 0.1, 0.5, 0.9, 0.975, 0.999)
entry <- function(id, params, xs, pdf, cdf, q, discrete = FALSE) list(id = id, params = params, discrete = discrete, xs = xs, pdf = pdf, cdf = cdf, ps = ps, q = q)
out <- list(
  { x <- c(-3, -1, 0, 0.5, 2, 4.5); entry("normal", list(mu = 1, sigma = 2), x, dnorm(x, 1, 2), pnorm(x, 1, 2), qnorm(ps, 1, 2)) },
  { x <- c(-2.5, -0.3, 0, 1, 3); entry("t", list(df = 3), x, dt(x, 3), pt(x, 3), qt(ps, 3)) },
  { x <- c(-2.5, -0.3, 0, 1, 3); entry("t", list(df = 30), x, dt(x, 30), pt(x, 30), qt(ps, 30)) },
  { x <- c(-4, -1, 0, 0.7, 2, 5); entry("nct", list(df = 10, delta = 1), x, dt(x, 10, 1), pt(x, 10, 1), qt(ps, 10, 1)) },
  { x <- c(0.1, 1, 3, 8, 20); entry("chisq", list(k = 4), x, dchisq(x, 4), pchisq(x, 4), qchisq(ps, 4)) },
  { x <- c(0.05, 0.5, 2, 6); entry("chisq", list(k = 1), x, dchisq(x, 1), pchisq(x, 1), qchisq(ps, 1)) },
  { x <- c(0.5, 3, 8, 15, 30); entry("nchisq", list(k = 3, lambda = 4), x, dchisq(x, 3, 4), pchisq(x, 3, 4), qchisq(ps, 3, 4)) },
  { x <- c(0.1, 0.8, 2, 5, 12); entry("f", list(d1 = 5, d2 = 12), x, df(x, 5, 12), pf(x, 5, 12), qf(ps, 5, 12)) },
  { x <- c(0.3, 1, 2.5, 6); entry("nf", list(d1 = 4, d2 = 20, lambda = 5), x, df(x, 4, 20, 5), pf(x, 4, 20, 5), qf(ps, 4, 20, 5)) },
  { x <- c(0, 0.2, 1, 3); entry("exponential", list(rate = 0.8), x, dexp(x, 0.8), pexp(x, 0.8), qexp(ps, 0.8)) },
  { x <- c(0.2, 1, 3, 9); entry("gamma", list(shape = 2.5, scale = 1.5), x, dgamma(x, 2.5, scale = 1.5), pgamma(x, 2.5, scale = 1.5), qgamma(ps, 2.5, scale = 1.5)) },
  { x <- c(0.05, 0.3, 0.5, 0.9); entry("beta", list(a = 2, b = 5), x, dbeta(x, 2, 5), pbeta(x, 2, 5), qbeta(ps, 2, 5)) },
  { x <- c(0.2, 1, 2.5, 8); entry("lognormal", list(mu = 0.3, sigma = 0.8), x, dlnorm(x, 0.3, 0.8), plnorm(x, 0.3, 0.8), qlnorm(ps, 0.3, 0.8)) },
  { x <- c(0.1, 1, 2, 5); entry("weibull", list(shape = 1.7, scale = 2), x, dweibull(x, 1.7, 2), pweibull(x, 1.7, 2), qweibull(ps, 1.7, 2)) },
  { x <- c(1, 1.5, 3, 10); a <- 2.2; m <- 1; entry("pareto", list(xm = 1, alpha = 2.2), x, a * m^a / x^(a + 1), 1 - (m / x)^a, m / (1 - ps)^(1 / a)) },
  { x <- c(-6, -1, 0, 0.5, 3); entry("cauchy", list(x0 = 0.5, gamma = 1.5), x, dcauchy(x, 0.5, 1.5), pcauchy(x, 0.5, 1.5), qcauchy(ps, 0.5, 1.5)) },
  { x <- c(1, 2, 3.5, 5); entry("uniform", list(a = 1, b = 5), x, dunif(x, 1, 5), punif(x, 1, 5), qunif(ps, 1, 5)) },
  { x <- 0:10; entry("binomial", list(n = 10, p = 0.35), x, dbinom(x, 10, 0.35), pbinom(x, 10, 0.35), qbinom(ps, 10, 0.35), TRUE) },
  { x <- 0:12; entry("poisson", list(lambda = 3.4), x, dpois(x, 3.4), ppois(x, 3.4), qpois(ps, 3.4), TRUE) },
  { x <- 1:10; entry("geometric", list(p = 0.3), x, dgeom(x - 1, 0.3), pgeom(x - 1, 0.3), qgeom(ps, 0.3) + 1, TRUE) },
  { x <- 0:14; entry("negbin", list(r = 3, p = 0.4), x, dnbinom(x, 3, 0.4), pnbinom(x, 3, 0.4), qnbinom(ps, 3, 0.4), TRUE) }
)
write(toJSON(out, auto_unbox = TRUE, digits = NA, pretty = TRUE), "tests/fixtures/distribution-reference.json")
cat("entries:", length(out), "\n")
