# Chapter 1: independent base-R enumeration; all inputs are controlled states.
args <- commandArgs(trailingOnly = FALSE)
script <- sub("^--file=", "", args[grepl("^--file=", args)])
root <- dirname(normalizePath(script))
d <- read.csv(file.path(root, "data", "alert-days.csv"))
avg <- function(x, keep = rep(TRUE, nrow(d))) {
  sum(d$weight[keep] * x[keep]) / sum(d$weight[keep])
}
out <- c(probability_sum = sum(d$weight / sum(d$weight)),
         heat_mean = avg(d$u), shock_mean = avg(d$v_mw),
         missing_heat0_alert1_probability = 0,
         missing_heat1_alert0_probability = 0)
for (b in c(-2, -1, 0, 1, 2)) {
  alert <- d$u
  y <- 10 + b * alert + (2 - b) * d$u + d$v_mw
  baseline <- 10 + 2 * d$u + d$v_mw
  prediction <- 10 + 2 * alert
  potential0 <- 10 + (2 - b) * d$u + d$v_mw
  potential1 <- 10 + b + (2 - b) * d$u + d$v_mw
  # Two independent assignments for each of the six background states.
  random <- rbind(transform(d, a = 0), transform(d, a = 1))
  random$y <- 10 + b * random$a + (2-b) * random$u + random$v_mw
  rm <- vapply(0:1, function(a) {
    keep <- random$a == a
    sum(random$weight[keep]*random$y[keep])/sum(random$weight[keep])
  }, numeric(1))
  conditional <- vapply(0:1, function(a) avg(y, alert == a), numeric(1))
  metrics <- c(observed_mean = avg(y), conditional0 = conditional[1],
    conditional1 = conditional[2], observed_difference = conditional[2]-conditional[1],
    forecast_mse = avg((y-prediction)^2), constant_mse = avg((y-11)^2),
    poor_forecast_mse = avg((y-(9+4*alert))^2),
    do0_mean = avg(potential0), do1_mean = avg(potential1),
    paired_effect = avg(potential1-potential0),
    randomized0 = rm[1], randomized1 = rm[2], randomized_difference = rm[2]-rm[1],
    net_benefit = 1000*(avg(potential0)-avg(potential1))-500,
    mse_kw2 = avg((1000*y-1000*prediction)^2),
    effect_kw = avg(1000*potential1-1000*potential0),
    observational_invariance_error = max(abs(y-baseline)),
    minimum_intervention_load = min(c(potential0,potential1)))
  for (i in seq_len(nrow(d))) {
    metrics[paste0("observed_state",i)] <- y[i]
    metrics[paste0("do0_state",i)] <- potential0[i]
    metrics[paste0("do1_state",i)] <- potential1[i]
  }
  names(metrics) <- paste0("b",b,"_",names(metrics))
  out <- c(out, metrics)
}
options(digits=17)
write.csv(data.frame(metric=sort(names(out)), value=unname(out[sort(names(out))])),
          stdout(), row.names=FALSE, quote=FALSE)
