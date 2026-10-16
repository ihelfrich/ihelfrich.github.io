# Independent UTC selection and finite partitions in base R.
args <- commandArgs(trailingOnly=FALSE)
root <- dirname(normalizePath(sub('^--file=','',args[grepl('^--file=',args)])))
read <- function(name) read.csv(file.path(root,'data',name),stringsAsFactors=FALSE)
timestamp <- function(s) {
  if (any(nchar(s)!=20) || any(!grepl('Z$',s))) stop('Use second-resolution UTC timestamps ending Z.')
  x <- as.POSIXct(s,format='%Y-%m-%dT%H:%M:%SZ',tz='UTC')
  if (any(is.na(x))) stop('Invalid date/time.')
  x
}
ledger <- function(name,field) {d <- read(name);d$value <- d[[field]];d}
validate <- function(d) {
  if (any(duplicated(paste(d$period,d$release_utc)))) stop('Ambiguous period/release key.')
  if (any(is.na(as.Date(d$period))) || any(!is.finite(d$value))) stop('Invalid period or nonfinite value.')
  timestamp(d$release_utc)
}
latest <- function(d) {
  if (!nrow(d)) return(d)
  ordered <- d[order(d$period,timestamp(d$release_utc)),,drop=FALSE]
  ordered[!duplicated(ordered$period,fromLast=TRUE),,drop=FALSE]
}
asof <- function(d,origin,delay=0) {
  validate(d);if (delay<0) stop('Negative collection delay.')
  latest(d[timestamp(d$release_utc)+delay<=timestamp(origin),,drop=FALSE])
}
forecast <- function(d,target='2024-03-01') {
  values <- d$value[d$period<target]
  if (!length(values)) stop('No released training value; no zero imputation.')
  mean(values)
}
same <- function(a,b) identical(a$record_id,b$record_id) && identical(a$value,b$value)
out <- c();gdp <- ledger('gdp-release-ledger.csv','value_percent')
origins <- read('clock-origins.csv')
for (i in seq_len(nrow(origins))) {
  for (delay in c(0,60,3600)) {
    cut <- origins$origin_utc[i];prefix <- paste0('gdp_o',origins$origin_id[i],'_d',delay,'_')
    selected <- asof(gdp,cut,delay)
    future <- timestamp(gdp$release_utc)+delay>timestamp(cut)
    changed <- gdp;changed$value[future] <- changed$value[future]+10
    mutated <- asof(changed,cut,delay)
    new <- gdp[3,,drop=FALSE];new$record_id <- 'authored-future';new$release_utc <- '2024-08-01T12:30:00Z';new$stage <- 4;new$value <- 777
    added <- asof(rbind(gdp,new),cut,delay);reordered <- asof(gdp[3:1,],cut,delay)
    values <- c(stage=if(nrow(selected)) selected$stage else 0,found=as.numeric(nrow(selected)>0),
      eligible_rows=sum(!future),latest_value=latest(gdp)$value,mutated_latest_value=latest(changed)$value,
      append_same=as.numeric(same(added,selected)),reorder_same=as.numeric(same(reordered,selected)),future_mutation_same=as.numeric(same(mutated,selected)))
    if(nrow(selected)) values <- c(values,growth=selected$value,mutated_growth=mutated$value)
    names(values) <- paste0(prefix,names(values));out <- c(out,values)
  }
}
for(i in 1:3) out[paste0('stage',i,'_quarterly_percent')] <- 100*((1+gdp$value[i]/100)^.25-1)
out <- c(out,revision_second_minus_advance=gdp$value[2]-gdp$value[1],revision_third_minus_second=gdp$value[3]-gdp$value[2],revision_third_minus_advance=gdp$value[3]-gdp$value[1])
toy <- ledger('controlled-release-ledger.csv','value');origin <- '2024-03-06T09:00:00Z'
locked <- forecast(asof(toy,origin));late <- forecast(latest(toy))
changed <- toy;future <- timestamp(toy$release_utc)>timestamp(origin);changed$value[future] <- changed$value[future]+1000
out <- c(out,toy_before=forecast(asof(toy,'2024-03-04T09:00:00Z')),toy_locked=locked,
  toy_after_revision=forecast(asof(toy,'2024-03-15T09:00:00Z')),toy_late=late,
  toy_mutated_locked=forecast(asof(changed,origin)),toy_mutated_late=forecast(latest(changed)),
  toy_first_target=5,toy_revised_target=7,toy_first_squared_error=(5-locked)^2,
  toy_revised_squared_error=(7-locked)^2,toy_late_first_squared_error=(5-late)^2,
  toy_late_revised_squared_error=(7-late)^2,toy_score_cross_term=2*(5-locked)*(7-5),toy_score_revision_squared=(7-5)^2)
d <- read('information-worlds.csv');p <- d$weight/sum(d$weight);av <- function(x) sum(p*x)
coarse <- sapply(d$signal,function(s) sum(p[d$signal==s]*d$y[d$signal==s])/sum(p[d$signal==s]))
pair_count <- sum(sapply(1:3,function(i) sum(d$signal[(i+1):4]==d$signal[i] & d$y[(i+1):4]!=d$y[i])))
out <- c(out,worlds=4,probability_sum=sum(p),no_information_mean=av(d$y),no_information_risk=av((d$y-av(d$y))^2),
  coarse_risk=av((d$y-coarse)^2),coarse_gain=av((coarse-av(d$y))^2),exact_risk=0,nonadapted_pair_count=pair_count)
for(i in 1:4) out[paste0('state',i,'_coarse_forecast')] <- coarse[i]
rejected <- function(expr) tryCatch({force(expr);0},error=function(e) 1)
bad <- gdp[1,,drop=FALSE];bad$value <- NaN
out <- c(out,duplicate_rejected=rejected(asof(rbind(gdp,gdp[1,]),origin)),
  nonfinite_rejected=rejected(asof(bad,origin)),negative_delay_rejected=rejected(asof(gdp,origin,-1)),
  empty_forecast_rejected=rejected(forecast(toy[FALSE,])))
options(digits=17)
write.table(data.frame(metric=names(out),value=unname(out)),stdout(),sep=',',row.names=FALSE,quote=FALSE)
