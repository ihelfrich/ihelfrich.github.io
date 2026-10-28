# Reproduce the observed-worlds experiment in base R (no packages).
# Run: Rscript reproduce.R observed-worlds-seed-2026.csv
# With no argument, reads the fixed synthetic sample from the public site.
args <- commandArgs(trailingOnly=TRUE)
source <- if (length(args)) args[1] else "https://ihelfrich.github.io/econometrics/data/observed.csv"
obs <- read.csv(source)
# Training is D, as in chapter 1. Older exports name the training column x.
if (!"d" %in% names(obs) && "x" %in% names(obs)) names(obs)[names(obs) == "x"] <- "d"
stopifnot(all(c("id", "d", "y") %in% names(obs)), nrow(obs) > 2)
print(coef(lm(y ~ d, data=obs)))

# This latent decomposition is imposed as a model; it is not identified.
# The equality check holds by construction for any data; it restates
# observational equivalence.
u <- obs$d
v <- obs$y-obs$d
for (b in c(-1,0,.5,1,2)) {
  model.y <- b*obs$d+(1-b)*u+v
  stopifnot(max(abs(model.y-obs$y)) < 1e-12)
  # Under do(D=1), U and V keep their values. The population mean is b; the
  # sample analogue differs from b by the sampling error in the means of U and V.
  sample.mean <- mean(b+(1-b)*u+v)
  cat(sprintf("b = %4.1f: same observed data; E[Y | do(D=1)] = %4.1f in the model, %.4f in this sample\n",
              b, b, sample.mean))
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
