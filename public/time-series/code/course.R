# Authored reference experiments. Copyright 2026 Ian Helfrich.
# Base R only; identical inputs, indexing contract, and metrics as course.py.
script_file <- function() {
  arg <- grep('^--file=', commandArgs(FALSE), value=TRUE)
  if(length(arg)) normalizePath(sub('^--file=', '', arg[1])) else normalizePath('course.R')
}
ROOT <- dirname(script_file())
normals <- function(n, seed=515) {
  state <- seed; out <- numeric(2*ceiling(n/2))
  for(i in seq(1,length(out),by=2)) {
    state <- (48271*state) %% 2147483647; u <- state/2147483647
    state <- (48271*state) %% 2147483647; v <- state/2147483647
    radius <- sqrt(-2*log(u)); out[i] <- radius*cos(2*pi*v); out[i+1] <- radius*sin(2*pi*v)
  }
  out[seq_len(n)]
}
fixtures <- function() as.matrix(read.csv(file.path(ROOT,'data','innovations.csv')))
ols <- function(X,y) {
  X <- as.matrix(X)
  observations <- if(is.matrix(y)) nrow(y) else length(y)
  if(observations <= ncol(X)) stop('Too few observations')
  q <- qr(X)
  if(q$rank<ncol(X)) stop('Rank-deficient design')
  b <- qr.coef(q,y); list(b=b,u=y-X%*%b)
}
ar <- function(e,phi=.7,c=0,initial=0) {
  y <- numeric(length(e)); previous <- initial
  for(t in seq_along(e)) {y[t]<-c+phi*previous+e[t];previous<-y[t]}; y
}
ac <- function(y,lag) {y<-y-mean(y);n<-length(y);sum(y[(lag+1):n]*y[1:(n-lag)])/sum(y*y)}
pac <- function(y,lag) {
  n<-length(y);X<-matrix(1,n-lag,1)
  for(j in seq_len(lag))X<-cbind(X,y[(lag+1-j):(n-j)])
  tail(ols(X,y[(lag+1):n])$b,1)
}
ljung_box <- function(y,lags=8) {n<-length(y);n*(n+2)*sum(sapply(1:lags,function(k)ac(y,k)^2/(n-k)))}
adf_stat <- function(y,lags=2,trend=FALSE) {
  dy<-diff(y);n<-length(dy);time<-lags:(n-1);X<-cbind(1,y[time+1])
  if(trend)X<-cbind(X,time+1)
  if(lags>0)for(j in 1:lags)X<-cbind(X,dy[time-j+1])
  fit<-ols(X,dy[time+1]);covariance<-sum(fit$u^2)/(length(fit$u)-ncol(X))*solve(crossprod(X))
  fit$b[2]/sqrt(covariance[2,2])
}
hac_mean_se <- function(y,bandwidth=3) {
  z<-y-mean(y);n<-length(z);long_run<-sum(z*z)/n
  for(lag in 1:bandwidth)long_run<-long_run+2*(1-lag/(bandwidth+1))*sum(z[(lag+1):n]*z[1:(n-lag)])/n
  if(long_run< -1e-12)stop('Negative long-run variance');sqrt(max(long_run,0)/n)
}
ar_fit <- function(y) as.numeric(ols(cbind(1,y[-length(y)]),y[-1])$b)
ar_forecast <- function(y,h=1) {b<-ar_fit(y);value<-tail(y,1);for(j in seq_len(h))value<-b[1]+b[2]*value;value}
rolling <- function(y,h=1,start=80,window=NULL) {
  errors<-numeric()
  for(origin in start:(length(y)-h)) {
    first<-if(is.null(window))1 else max(1,origin-window+1)
    errors<-c(errors,y[origin+h]-ar_forecast(y[first:origin],h))
  };errors
}
rmse <- function(e) sqrt(mean(e^2))
ma_filter <- function(y,centered=FALSE) {
  z<-rep(NA_real_,length(y));last<-length(y)-if(centered)2 else 0
  for(t in 3:last) z[t]<-mean(y[(t-2):(t+if(centered)2 else 0)]);z
}
arma_residuals <- function(y,phi,theta) {
  u<-numeric(length(y));previous<-0
  for(t in 2:length(y)){u[t]<-y[t]-phi*y[t-1]-theta*previous;previous<-u[t]};u
}
df_stat <- function(y) {
  X<-cbind(1,y[-length(y)]);fit<-ols(X,diff(y));u<-fit$u
  covariance<-sum(u^2)/(length(u)-2)*solve(crossprod(X))
  fit$b[2]/sqrt(covariance[2,2])
}
kalman <- function(y,phi=.8,q=.25,r=1) {
  if(any(!is.finite(c(phi,q,r)))||q<0||r<=0||abs(phi)>=1)stop('Invalid stationary filter parameters')
  if(length(y)==0)stop('Require at least one observation')
  n<-length(y);m<-P<-a<-V<-numeric(n);previous<-0;variance<-q/(1-phi^2)
  for(t in seq_len(n)) {
    a[t]<-phi*previous;V[t]<-phi^2*variance+q
    if(is.na(y[t])){m[t]<-a[t];P[t]<-V[t]}else{K<-V[t]/(V[t]+r);m[t]<-a[t]+K*(y[t]-a[t]);P[t]<-(1-K)*V[t]}
    previous<-m[t];variance<-P[t]
  }
  s<-m;S<-P
  if(n>1)for(t in (n-1):1){J<-if(V[t+1]==0)0 else P[t]*phi/V[t+1];s[t]<-m[t]+J*(s[t+1]-a[t+1]);S[t]<-P[t]+J^2*(S[t+1]-V[t+1])}
  list(m=m,P=P,s=s,S=S)
}
var_fit <- function(Y) {
  X<-cbind(1,Y[-nrow(Y),]);fit<-ols(X,Y[-1,]);U<-fit$u
  list(c=fit$b[1,],A=t(fit$b[-1,]),Sigma=crossprod(U)/(nrow(U)-ncol(X)))
}
garch_variance <- function(u,omega,alpha,beta) {
  if(omega<=0||alpha<0||beta<0||alpha+beta>=1)stop('Invalid GARCH parameters')
  v<-numeric(length(u));v[1]<-omega/(1-alpha-beta)
  for(t in 2:length(u))v[t]<-omega+alpha*u[t-1]^2+beta*v[t-1];v
}
garch_fit <- function(u) {
  best<-NULL;objective<-Inf
  for(omega in c(.02,.05,.1,.2,.4))for(alpha in c(.05,.1,.2))for(beta in c(.5,.7,.8,.9)) {
    if(alpha+beta>=.999)next
    v<-garch_variance(u,omega,alpha,beta);loss<-mean(log(v)+u^2/v)
    if(loss<objective){objective<-loss;best<-c(omega,alpha,beta)}
  };list(parameters=best,objective=objective)
}
experiment <- function(k,E=fixtures()) {
  e<-E[,1];f<-E[,2];out<-numeric()
  record<-function(key,value)out[paste0(sprintf('%02d',k),'_',key)]<<-as.numeric(value)
  if(k==1) {
    temperature<-c(40,80);weights<-c(.5,.5);mt<-sum(weights*temperature)
    record('weighted_temperature',mt);record('degree_days_before_aggregation',sum(weights*pmax(65-temperature,0)))
    record('degree_days_after_aggregation',max(65-mt,0));y<-100+ar(e[1:180],.8)
    record('naive_rmse',rmse(diff(y[120:180])));period<-0:11;release<-period+2;origin<-8
    record('latest_available_period',max(period[release<=origin]));stopifnot(max(release[release<=origin])<=origin)
  } else if(k==2) {
    phi<-.7;c<-.6;y<-ar(e[1:1024],phi,c)
    record('population_mean',c/(1-phi));record('population_variance',1/(1-phi^2))
    record('sample_mean',mean(y[101:1024]));record('sample_variance',mean((y[101:1024]-mean(y[101:1024]))^2))
    record('forecast_h4',c/(1-phi)+phi^4*(tail(y,1)-c/(1-phi)))
    record('variance_h4',sum(phi^(2*(0:3))));quarterly<-rowMeans(matrix(y[1:1023],ncol=3,byrow=TRUE))
    record('aggregated_fitted_phi',ar_fit(quarterly)[2]);stopifnot(abs(sum(phi^(2*(0:3)))-(1-phi^8)/(1-phi^2))<1e-12)
  } else if(k==3) {
    phi<-.6;theta<-.4;y<-numeric(512)
    for(t in 2:512)y[t]<-phi*y[t-1]+e[t]+theta*e[t-1]
    best<-c(0,0);loss<-Inf
    for(p in c(.2,.4,.6,.8))for(q in c(-.4,0,.4,.8)) {
      candidate<-mean(arma_residuals(y,p,q)[31:512]^2)
      if(candidate<loss){best<-c(p,q);loss<-candidate}
    }
    record('conditional_phi',best[1]);record('conditional_theta',best[2]);record('sample_acf1',ac(y,1))
    record('theoretical_ma1_acf',theta/(1+theta^2));record('invertible_ma_equivalent',theta/(1+theta^2)-(1/theta)/(1+(1/theta)^2));record('innovation_mse',loss)
    record('sample_pacf1',pac(y,1));record('sample_pacf2',pac(y,2));innovation<-tail(arma_residuals(y,best[1],best[2]),1)
    forecast<-best[1]*tail(y,1)+best[2]*innovation;record('arma_forecast_h3',best[1]^2*forecast)
  } else if(k==4) {
    y<-ar(e[1:360],.8);err<-rolling(y,4,120);naive<-sapply(120:356,function(t)y[t+4]-y[t])
    record('ar_rmse_h4',rmse(err));record('naive_rmse_h4',rmse(naive));v<-sum(.8^(2*(0:3)))
    record('known_parameter_variance',v);record('known_parameter_interval_coverage',mean(abs(err)<=1.96*sqrt(v)))
    record('loss_difference',mean(err^2-naive^2));record('asymmetric_optimal_quantile',3/4)
    record('forecast_error_ljung_box8',ljung_box(err,8))
    stopifnot(length(y[124:360])==length(err))
  } else if(k==5) {
    signal<-ar(e[1:240],.8);y<-signal+f[1:240];a<-ma_filter(y);b<-ma_filter(y,TRUE)
    altered<-y;altered[122:240]<-altered[122:240]+100
    record('one_sided_future_sensitivity',ma_filter(altered)[121]-a[121]);record('centered_future_sensitivity',ma_filter(altered,TRUE)[121]-b[121])
    record('raw_signal_rmse',rmse(y-signal));record('one_sided_signal_rmse',rmse(a[3:240]-signal[3:240]))
    record('noise_variance',mean((f[1:240]-mean(f[1:240]))^2));stopifnot(ma_filter(altered)[121]==a[121],ma_filter(altered,TRUE)[121]!=b[121])
  } else if(k==6) {
    walk<-cumsum(e[1:360]);other<-cumsum(f[1:360]);u<-ols(cbind(1,other),walk)$u
    record('spurious_level_r2',1-sum(u^2)/sum((walk-mean(walk))^2));d<-ols(cbind(1,diff(other)),diff(walk))$u
    record('differenced_r2',1-sum(d^2)/sum((diff(walk)-mean(diff(walk)))^2));record('df_statistic',df_stat(walk))
    record('adf_statistic_lag2',adf_stat(walk,2));record('df_adf_zero_lag_error',adf_stat(walk,0)-df_stat(walk))
    record('arima010_drift_forecast_h3',tail(walk,1)+3*mean(diff(walk)))
    for(n in c(80,240,720)) {
      stats<-sapply(0:199,function(i)df_stat(cumsum(normals(n,515+i))))
      count<-mean(stats< -2.86);record(paste0('df_rejection_n',n),count);record(paste0('df_mcse_n',n),sqrt(count*(1-count)/200))
    };record('random_walk_h12_variance',12)
  } else if(k==7) {
    n<-360;t<-0:(n-1);temperature<-60+18*sin(2*pi*t/12)+3*f[1:n]
    cooling<-pmax(temperature-65,0);heating<-pmax(65-temperature,0)
    X<-cbind(1,sin(2*pi*t/12),cos(2*pi*t/12),heating,cooling)
    y<-as.vector(X%*%c(100,3,-2,.8,1.2))+ar(e[1:n],.6);fit<-ols(X,y);rho<-ar_fit(as.vector(fit$u))[2]
    gls<-ols(X[-1,]-rho*X[-n,],y[-1]-rho*y[-n]);bt<-gls$b
    record('ols_heating',fit$b[4]);record('gls_heating',bt[4]);record('gls_cooling',bt[5]);record('estimated_error_phi',rho)
    record('gls_innovation_acf1',ac(gls$u,1));record('hot_scenario_level',sum(c(1,0,1,0,15)*bt));record('cold_scenario_level',sum(c(1,0,1,15,0)*bt))
    stopifnot(qr(X)$rank==5)
  } else if(k==8) {
    state<-ar(.5*e[1:360],.8);y<-state+f[1:360];y[151]<-NA;K<-kalman(y)
    record('filter_rmse',rmse(K$m-state));record('smoother_rmse',rmse(K$s-state));record('missing_filtered_variance',K$P[151]);record('previous_filtered_variance',K$P[150])
    changed<-y;changed[182:360]<-changed[182:360]+10;C<-kalman(changed)
    record('filter_future_sensitivity',C$m[181]-K$m[181]);record('smoother_future_sensitivity',C$s[181]-K$s[181]);record('minimum_smoothing_variance',min(K$S))
    a<-c(0,.8*K$m[-360]);previous<-c(.25/(1-.8^2),K$P[-360]);observation_variance<-.8^2*previous+.25+1
    observed<-!is.na(y);innovation<-y[observed]-a[observed]
    record('gaussian_log_likelihood',-.5*sum(log(2*pi*observation_variance[observed])+innovation^2/observation_variance[observed]))
    stopifnot(all(K$S>= -1e-12),all(K$S<=K$P+1e-12),C$m[181]==K$m[181])
  } else if(k %in% c(9,10)) {
    A<-matrix(c(.6,.15,.05,.5),2,byrow=TRUE);Y<-matrix(0,600,2);B<-matrix(c(1,0,.7,.8),2,byrow=TRUE)
    for(t in 2:600)Y[t,]<-A%*%Y[t-1,]+B%*%E[t,1:2]
    fit<-var_fit(Y);Ah<-fit$A;Sigma<-fit$Sigma
    if(k==9) {
      record('estimated_a12',Ah[1,2]);record('estimated_a21',Ah[2,1]);record('spectral_radius',max(Mod(eigen(Ah)$values)))
      W<-matrix(c(0,1,1,0),2);record('network_forecast_first',((.6*diag(2)+.15*W)%*%Y[600,])[1])
      record('var_forecast_first',(fit$c+Ah%*%Y[600,])[1]);record('residual_covariance12',Sigma[1,2])
      V<-matrix(0,2,2);power<-diag(2)
      for(j in 1:4){V<-V+power%*%Sigma%*%t(power);power<-power%*%Ah}
      record('forecast_covariance_h4_trace',sum(diag(V)));record('forecast_sum_variance_h4',sum(V))
    } else {
      L<-t(chol(Sigma));order<-matrix(c(0,1,1,0),2);reverse<-order%*%t(chol(order%*%Sigma%*%order))%*%order
      record('first_order_impact21',L[2,1]);record('reverse_order_impact21',reverse[2,1]);angle<-.5
      Q<-matrix(c(cos(angle),-sin(angle),sin(angle),cos(angle)),2,byrow=TRUE);rotated<-L%*%Q
      record('covariance_reconstruction_error',max(abs(rotated%*%t(rotated)-Sigma)));record('rotated_impact21',rotated[2,1])
      record('response_h4',(Ah%*%Ah%*%Ah%*%Ah%*%L)[2,1]);stopifnot(max(abs(L%*%t(L)-Sigma))<1e-10,max(abs(reverse%*%t(reverse)-Sigma))<1e-10)
    }
  } else if(k==11) {
    x<-cumsum(e[1:720]);spread<-ar(.4*f[1:720],.5);y<-1.5*x+spread
    fit<-ols(cbind(1,x),y);u<-as.vector(fit$u);X<-cbind(1,u[-720],diff(x));ec<-ols(X,diff(y))
    record('cointegrating_beta',fit$b[2]);record('error_correction_alpha',ec$b[2]);record('short_run_dx',ec$b[3]);record('spread_variance',mean((u-mean(u))^2))
    record('ecm_innovation_acf1',ac(ec$u,1));record('spread_ar_phi',ar_fit(u)[2]);record('ecm_forecast_change',sum(c(1,tail(u,1),0)*ec$b))
  } else if(k==12) {
    n<-1024;u<-numeric(n);v<-rep(1,n)
    for(t in 1:n){if(t>1)v[t]<-.1+.1*u[t-1]^2+.8*v[t-1];u[t]<-sqrt(v[t])*e[t]}
    fit<-garch_fit(u);p<-fit$parameters;fitted<-garch_variance(u,p[1],p[2],p[3]);z<-u/sqrt(fitted)
    record('omega_grid',p[1]);record('alpha_grid',p[2]);record('beta_grid',p[3]);record('qll_objective',fit$objective)
    record('squared_return_acf1',ac(u^2,1));record('squared_standardized_acf1',ac(z^2,1))
    next_variance<-p[1]+p[2]*tail(u,1)^2+p[3]*tail(fitted,1)
    record('conditional_q05',-1.6448536269514722*sqrt(next_variance))
    long_run<-p[1]/(1-p[2]-p[3]);record('variance_forecast_h5',long_run+(p[2]+p[3])^4*(next_variance-long_run))
    record('unconditional_variance',.1/(1-.1-.8));decimal<-garch_variance(u/100,p[1]/10000,p[2],p[3]);record('unit_scaling_error',max(abs(decimal*10000-fitted)))
    rejected<-tryCatch({garch_variance(u,.1,.3,.8);0},error=function(e)1);record('invalid_parameter_rejected',rejected);stopifnot(rejected==1)
  } else if(k==13) {
    y<-numeric(480);for(t in 2:480)y[t]<-(if(t<=300).8 else -.4)*y[t-1]+e[t]
    expanding<-rolling(y,1,330);moving<-rolling(y,1,330,80)
    record('expanding_rmse',rmse(expanding));record('rolling_rmse',rmse(moving));difference<-moving^2-expanding^2
    record('paired_mean_loss_difference',mean(difference));blocks<-sapply(seq(1,floor(length(difference)/10)*10,by=10),function(i)mean(difference[i:(i+9)]))
    record('block_standard_error',sd(blocks)/sqrt(length(blocks)));record('early_fitted_phi',ar_fit(y[1:240])[2]);record('late_fitted_phi',ar_fit(y[361:480])[2])
    record('hac_standard_error',hac_mean_se(difference,3))
  } else if(k==14) {
    y<-ar(e[1:420],.65);y[301:420]<-y[301:420]+4;candidates<-c(40,80,160)
    validation<-sapply(candidates,function(w)rmse(rolling(y[1:300],1,240,w)));chosen<-candidates[which.min(validation)]
    record('validation_selected_window',chosen);frozen<-rolling(y,1,340,chosen);benchmark<-y[341:420]-y[340:419]
    record('continuation_rmse',rmse(frozen));record('continuation_naive_rmse',rmse(benchmark));record('validation_rmse',min(validation));record('continuation_observations',length(frozen));record('future_targets_excluded',1)
  } else if(k==15) {
    y<-ar(e[1:240],.75,2);forecast<-ar_forecast(y[1:180],3);record('forecast_original_units',forecast)
    record('forecast_rescaled_error',ar_forecast(100*y[1:180],3)/100-forecast);changed<-y;changed[181:240]<-changed[181:240]+1000
    record('future_mutation_forecast_error',ar_forecast(changed[1:180],3)-forecast);record('random_walk_error_variance_h1',1)
    record('random_walk_error_variance_h12',12);record('ar_zero_error_variance_h12',1)
    rejected<-tryCatch({ols(matrix(1,10,2),0:9);0},error=function(e)1);record('rank_failure_detected',rejected)
    stopifnot(abs(out['15_forecast_rescaled_error'])<1e-10)
  } else stop('Lecture must be an integer from 1 through 15')
  stopifnot(all(is.finite(out)));out
}
run <- function(lecture=NULL,output=file.path(ROOT,'results','r.csv')) {
  E<-fixtures();result<-numeric()
  for(k in if(is.null(lecture))1:15 else lecture)result<-c(result,experiment(k,E))
  dir.create(dirname(output),showWarnings=FALSE)
  write.csv(data.frame(metric=names(result),value=unname(result)),output,row.names=FALSE,quote=FALSE)
  print(result);invisible(result)
}
if(sys.nframe()==0) {args<-commandArgs(TRUE);run(if(length(args))as.integer(args[1])else NULL)}
