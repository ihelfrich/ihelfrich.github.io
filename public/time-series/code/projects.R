# Complete public Build/Audit/Revise case. See projects.py and data manifest.
source('course.R')
data<-read.csv(file.path(ROOT,'data','texas-electricity.csv'));periods<-data$period
y<-data$residential_sales_mwh/1e6;temp<-data$temperature_f
design<-function(t,temperature=NULL) {
  X<-cbind(1,t/12,sin(2*pi*t/12),cos(2*pi*t/12))
  if(is.null(temperature))cbind(X,sin(4*pi*t/12),cos(4*pi*t/12))else cbind(X,pmax(65-temperature,0),pmax(temperature-65,0))
}
forecast<-function(y,temp,target,method='ar',window=0,release_lag=2) {
  # target is a zero-based period number to match the other implementations.
  origin<-target-1;latest<-origin-release_lag;h<-target-latest
  first<-if(window==0)0 else max(0,latest-window+1)
  if(method=='naive')return(y[target-12+1])
  idx<-(first:latest)+1
  if(method=='ar')return(ar_forecast(y[idx],h))
  time<-first:latest;X<-design(time,if(method=='weather')temp[idx]else NULL)
  fit<-ols(X,y[idx]);u<-as.vector(fit$u);rho<-ar_fit(u)[2]
  if(abs(rho)>=1)stop('Unstable residual process')
  if(method=='weather') {
    same<-time[time%%12==target%%12]
    if(length(same)<2)stop('Too little climate history')
    x<-as.numeric(design(target,65));x[5]<-mean(pmax(65-temp[same+1],0));x[6]<-mean(pmax(temp[same+1]-65,0))
  }else x<-as.numeric(design(target))
  as.numeric(sum(x*fit$b)+rho^h*tail(u,1))
}
table<-function(targets,method,window=0,y_input=y,temp_input=temp) {
  do.call(rbind,lapply(targets,function(target) {
    fallback<-0
    value<-tryCatch(forecast(y_input,temp_input,target,method,window),error=function(e){fallback<<-1;forecast(y_input,temp_input,target,'naive')})
    data.frame(origin=periods[target],target=periods[target+1],latest_available=periods[target-2],method=method,window=window,actual_million_mwh=y_input[target+1],forecast_million_mwh=value,error=y_input[target+1]-value,fallback=fallback)
  }))
}
results<-numeric();all_rows<-NULL
keep<-function(phase,rows){rows$phase<-phase;all_rows<<-rbind(all_rows,rows);rows$error}
baseline<-keep('build',table(120:155,'naive'));original<-keep('build',table(120:155,'ar'))
results['p1_naive_rmse']<-rmse(baseline);results['p1_ar_rmse']<-rmse(original)
honest<-keep('audit',table(156:179,'ar'));impossible<-sapply(156:179,function(t)y[t+1]-mean(y[(t-2+1):(t+2+1)]))
results['p2_original_rmse']<-rmse(honest);results['p2_leaky_centered_rmse']<-rmse(impossible)
mutated<-y;mutated[158:length(y)]<-mutated[158:length(y)]+100
results['p2_leaky_future_sensitivity']<-mean(mutated[155:159])-mean(y[155:159])
loss<-Inf;chosen<-NULL
for(method in c('calendar','weather'))for(window in c(60,120,0)) {
  errors<-keep('repair-selection',table(156:179,method,window));score<-mean(errors^2)
  if(score<loss){loss<-score;chosen<-list(method=method,window=window)}
}
results['p2_repair_validation_rmse']<-sqrt(loss)
revised<-keep('continuation',table(180:191,chosen$method,chosen$window));base<-keep('continuation',table(180:191,'naive'));old<-keep('continuation',table(180:191,'ar'))
results['p3_revised_rmse']<-rmse(revised);results['p3_naive_rmse']<-rmse(base);results['p3_original_rmse']<-rmse(old)
results['p3_paired_mse_difference']<-mean(revised^2-base^2);results['p3_selected_weather']<-as.integer(chosen$method=='weather');results['p3_selected_window']<-chosen$window
target<-180;value<-forecast(y,temp,target,chosen$method,chosen$window);altered<-y;altered[179:192]<-altered[179:192]+1000;altered_temp<-temp;altered_temp[179:192]<-altered_temp[179:192]+100
results['p3_future_mutation_error']<-forecast(altered,altered_temp,target,chosen$method,chosen$window)-value
stopifnot(abs(results['p3_future_mutation_error'])<1e-9,all(is.finite(results)))
write.csv(data.frame(metric=names(results),value=unname(results)),file.path(ROOT,'results','projects-r.csv'),row.names=FALSE,quote=FALSE)
write.csv(all_rows,file.path(ROOT,'results','project-forecasts-r.csv'),row.names=FALSE,quote=FALSE)
print(results)
