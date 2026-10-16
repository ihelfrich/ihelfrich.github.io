# Exact enumeration for the two risk states in Lecture 2; base R only.
values <- numeric(0)
signs <- expand.grid(first=c(-1,1),second=c(-1,1))
for (scale in c(1,3)) {
  errors <- scale*(0.5*signs$first+signs$second)
  values[paste0('state_',scale,'_mean_error')] <- mean(errors)
  values[paste0('state_',scale,'_variance')] <- mean(errors^2)
}
values['unconditional_variance'] <- mean(values[c('state_1_variance','state_3_variance')])
values['opening_forecast'] <- 3+0.5*(3+0.5*10)
for (phi in c(-0.95,-0.5,0,0.5,0.95,1)) for (h in c(1,2,24)) {
  values[paste('response',format(phi,trim=TRUE),h,sep='_')] <- phi^h
  values[paste('variance',format(phi,trim=TRUE),h,sep='_')] <- sum(phi^(2*(0:(h-1))))
}
write.table(data.frame(metric=names(values),value=unname(values)),stdout(),sep=',',row.names=FALSE,quote=FALSE)
