# Reproduce the observed-worlds experiment in base R (no packages).
# Run: Rscript reproduce.R observed-worlds-seed-2026.csv
# With no argument, reads the fixed synthetic sample from the public site.
args <- commandArgs(trailingOnly=TRUE)
source <- if (length(args)) args[1] else "https://ihelfrich.github.io/econometrics/data/observed.csv"
d <- read.csv(source)
stopifnot(all(c("id", "x", "y") %in% names(d)), nrow(d) > 2)
print(coef(lm(y ~ x, data=d)))

# This latent decomposition is imposed as a model; it is not identified.
u <- d$x
v <- d$y-d$x
for (b in c(-1,0,.5,1,2)) {
  model.y <- b*d$x+(1-b)*u+v
  stopifnot(max(abs(model.y-d$y)) < 1e-12)
  cat("b =", b, ": same observed data; E[Y | do(X=1)] =", b, "\n")
}

dd <- (62-50)-(46-40)
M <- c(0,2,3,4,8)
result <- data.frame(M, effect.low=dd-M, effect.high=dd+M,
                     net.low=100*(dd-M)-300, net.high=100*(dd+M)-300)
print(result)
stopifnot(dd == 6, result$net.low[result$M==3] == 0)

# Optional second argument: CSV from the browser's sampling experiment.
if (length(args) >= 2) {
  s <- read.csv(args[2])
  width <- qnorm(.975)/sqrt(s$n)
  stopifnot(max(abs(s$low-(s$mean-width))) < 1e-12)
  stopifnot(max(abs(s$high-(s$mean+width))) < 1e-12)
  cat("Verified sampling coverage:", mean(s$low<=0 & s$high>=0), "\n")
}
