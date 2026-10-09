# Independent weighted finite-population calculations in base R.
args <- commandArgs(trailingOnly=FALSE)
script <- sub('^--file=', '', args[grepl('^--file=', args)])
root <- dirname(normalizePath(script))
d <- read.csv(file.path(root, 'data', 'meter-states.csv'))
p <- d$weight / sum(d$weight)
av <- function(a) sum(p*a)
cv <- function(a,b) sum(p*(a-av(a))*(b-av(b)))
project <- function(a,b) {
  slope <- cv(a,b)/cv(a,a)
  intercept <- av(b)-slope*av(a)
  c(slope=slope,intercept=intercept,mse=av((b-intercept-slope*a)^2))
}
x <- d$x_mwh
y <- 30+50*x+d$epsilon_dollars
out <- c(probability_sum=sum(p),states=nrow(d))
for (h in c(0,2,4)) {
  for (name in c('classical','compressed','reversed')) {
    kappa <- c(classical=0,compressed=-.5,reversed=-2)[[name]]
    prefix <- paste0('h',h,'_',name,'_')
    m <- x+kappa*(x-10)+h*d$z1
    twin <- x+kappa*(x-10)+h*d$z2
    w <- m-x
    average <- (m+twin)/2
    fitted <- project(m,y)
    avgfit <- project(average,y)
    conditional <- sapply(m,function(a) sum(p[m==a]*y[m==a])/sum(p[m==a]))
    metrics <- c(mean_x=av(x),mean_m=av(m),mean_y=av(y),var_x=cv(x,x),var_m=cv(m,m),
      var_w=cv(w,w),cov_x_w=cv(x,w),cov_m_y=cv(m,y),cov_m1_m2=cv(m,twin),
      slope=unname(fitted['slope']),intercept=unname(fitted['intercept']),
      linear_mse=unname(fitted['mse']),conditional_mse=av((y-conditional)^2),
      twin_ratio=cv(m,y)/cv(m,twin),copied_ratio=cv(m,y)/cv(m,m),
      average_slope=unname(avgfit['slope']),average_mse=unname(avgfit['mse']),
      slope_per_kwh=unname(project(1000*m,y)['slope']),minimum_meter=min(m),maximum_meter=max(m))
    names(metrics) <- paste0(prefix,names(metrics));out <- c(out,metrics)
    if (h==2 && name=='classical') {
      for (j in seq_along(x)) {
        out[paste0('baseline_state',j,'_x')] <- x[j]
        out[paste0('baseline_state',j,'_m')] <- m[j]
        out[paste0('baseline_state',j,'_bill')] <- y[j]
      }
    }
  }
  m <- x+h*d$z1
  out[paste0('h',h,'_reliability')] <- cv(x,x)/cv(m,m)
}
q <- c(1000,3000);n <- c(100,200)
out <- c(out,aggregate_ratio=sum(q)/sum(n),unweighted_ratio=mean(q/n),
         weighted_ratio=sum((n/sum(n))*(q/n)),coverage_before=3000/300,
         coverage_after=3000/240,coverage_growth=(3000/240)/(3000/300)-1,
         coverage_log_growth=log(3000/240)-log(3000/300),mwh_to_joule=1e6*3600)
options(digits=17)
write.table(data.frame(metric=names(out),value=unname(out)),stdout(),sep=',',row.names=FALSE,quote=FALSE)
