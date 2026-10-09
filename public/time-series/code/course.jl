# Authored reference experiments. Copyright 2026 Ian Helfrich.
# Julia standard libraries only. Run: julia --startup-file=no course.jl [lecture]
using LinearAlgebra, Statistics, DelimitedFiles
const ROOT=@__DIR__
function normals(n,seed=515)
    state=seed;out=Float64[]
    while length(out)<n
        state=mod(48271*state,2147483647);u=state/2147483647
        state=mod(48271*state,2147483647);v=state/2147483647
        radius=sqrt(-2*log(u));push!(out,radius*cos(2*pi*v),radius*sin(2*pi*v))
    end
    out[1:n]
end
fixtures()=readdlm(joinpath(ROOT,"data","innovations.csv"),',',Float64;skipstart=1)
function ols(X,y)
    size(X,1)>size(X,2)||error("Too few observations")
    rank(X)==size(X,2)||error("Rank-deficient design")
    b=qr(X)\y;(b=b,u=y-X*b)
end
function ar(e,phi=.7,c=0.,initial=0.)
    y=zeros(length(e));previous=initial
    for t in eachindex(e);y[t]=c+phi*previous+e[t];previous=y[t];end
    y
end
function ac(y,lag)
    z=y.-mean(y);dot(z[lag+1:end],z[1:end-lag])/dot(z,z)
end
ar_fit(y)=ols(hcat(ones(length(y)-1),y[1:end-1]),y[2:end]).b
function pac(y,lag)
    n=length(y);X=hcat(ones(n-lag),[y[lag+1-j:n-j] for j in 1:lag]...)
    ols(X,y[lag+1:end]).b[end]
end
ljung_box(y,lags=8)=length(y)*(length(y)+2)*sum(ac(y,k)^2/(length(y)-k) for k in 1:lags)
function adf_stat(y,lags=2,trend=false)
    dy=diff(y);n=length(dy);time=collect(lags:n-1);X=hcat(ones(length(time)),y[time.+1])
    if trend;X=hcat(X,time.+1);end
    for j in 1:lags;X=hcat(X,dy[time.-j.+1]);end
    fit=ols(X,dy[time.+1]);covariance=dot(fit.u,fit.u)/(length(fit.u)-size(X,2))*((X'X)\Matrix{Float64}(I,size(X,2),size(X,2)))
    fit.b[2]/sqrt(covariance[2,2])
end
function hac_mean_se(y,bandwidth=3)
    z=y.-mean(y);n=length(z);long_run=dot(z,z)/n
    for lag in 1:bandwidth;long_run+=2*(1-lag/(bandwidth+1))*dot(z[lag+1:end],z[1:end-lag])/n;end
    long_run>= -1e-12||error("Negative long-run variance");sqrt(max(long_run,0)/n)
end
function ar_forecast(y,h=1)
    c,phi=ar_fit(y);value=y[end]
    for j in 1:h;value=c+phi*value;end
    value
end
function rolling(y,h=1,start=80,window=nothing)
    errors=Float64[]
    for origin in start:length(y)-h
        first=isnothing(window) ? 1 : max(1,origin-window+1)
        push!(errors,y[origin+h]-ar_forecast(y[first:origin],h))
    end
    errors
end
rmse(e)=sqrt(mean(e.^2))
function ma_filter(y,centered=false)
    z=fill(NaN,length(y));last=length(y)-(centered ? 2 : 0)
    for t in 3:last;z[t]=mean(y[t-2:t+(centered ? 2 : 0)]);end
    z
end
function arma_residuals(y,phi,theta)
    u=zeros(length(y));previous=0.
    for t in 2:length(y);u[t]=y[t]-phi*y[t-1]-theta*previous;previous=u[t];end
    u
end
function df_stat(y)
    X=hcat(ones(length(y)-1),y[1:end-1]);fit=ols(X,diff(y));u=fit.u
    covariance=dot(u,u)/(length(u)-2)*((X'X)\Matrix{Float64}(I,2,2))
    fit.b[2]/sqrt(covariance[2,2])
end
function kalman(y,phi=.8,q=.25,r=1.)
    all(isfinite,[phi,q,r])&&q>=0&&r>0&&abs(phi)<1||error("Invalid stationary filter parameters")
    isempty(y)&&error("Require at least one observation")
    n=length(y);m=zeros(n);P=zeros(n);a=zeros(n);V=zeros(n)
    previous=0.;variance=q/(1-phi^2)
    for t in 1:n
        a[t]=phi*previous;V[t]=phi^2*variance+q
        if isnan(y[t]);m[t]=a[t];P[t]=V[t]
        else;K=V[t]/(V[t]+r);m[t]=a[t]+K*(y[t]-a[t]);P[t]=(1-K)*V[t];end
        previous=m[t];variance=P[t]
    end
    s=copy(m);S=copy(P)
    for t in n-1:-1:1
        J=V[t+1]==0 ? 0. : P[t]*phi/V[t+1];s[t]=m[t]+J*(s[t+1]-a[t+1]);S[t]=P[t]+J^2*(S[t+1]-V[t+1])
    end
    (m=m,P=P,s=s,S=S)
end
function var_fit(Y)
    X=hcat(ones(size(Y,1)-1),Y[1:end-1,:]);fit=ols(X,Y[2:end,:]);U=fit.u
    (c=fit.b[1,:],A=Matrix(fit.b[2:end,:]'),Sigma=U'U/(size(U,1)-size(X,2)))
end
function garch_variance(u,omega,alpha,beta)
    omega>0&&alpha>=0&&beta>=0&&alpha+beta<1||error("Invalid GARCH parameters")
    v=zeros(length(u));v[1]=omega/(1-alpha-beta)
    for t in 2:length(u);v[t]=omega+alpha*u[t-1]^2+beta*v[t-1];end
    v
end
function garch_fit(u)
    best=(0.,0.,0.);objective=Inf
    for omega in [.02,.05,.1,.2,.4],alpha in [.05,.1,.2],beta in [.5,.7,.8,.9]
        alpha+beta>=.999&&continue
        v=garch_variance(u,omega,alpha,beta);loss=mean(log.(v).+u.^2 ./v)
        if loss<objective;objective=loss;best=(omega,alpha,beta);end
    end
    best,objective
end
function experiment(k,E=fixtures())
    e=E[:,1];f=E[:,2];out=Dict{String,Float64}()
    record(key,value)=(out[lpad(k,2,'0')*"_"*key]=Float64(value))
    if k==1
        temperature=[40.,80.];weights=[.5,.5];mt=dot(weights,temperature)
        record("weighted_temperature",mt);record("degree_days_before_aggregation",dot(weights,max.(65 .-temperature,0)))
        record("degree_days_after_aggregation",max(65-mt,0));y=100 .+ar(e[1:180],.8)
        record("naive_rmse",rmse(diff(y[120:180])));period=0:11;release=period.+2;origin=8
        record("latest_available_period",maximum(period[release.<=origin]));@assert maximum(release[release.<=origin])<=origin
    elseif k==2
        phi=.7;c=.6;y=ar(e[1:1024],phi,c)
        record("population_mean",c/(1-phi));record("population_variance",1/(1-phi^2))
        record("sample_mean",mean(y[101:1024]));record("sample_variance",var(y[101:1024];corrected=false))
        record("forecast_h4",c/(1-phi)+phi^4*(y[end]-c/(1-phi)));record("variance_h4",sum(phi.^(2 .*collect(0:3))))
        quarterly=vec(mean(reshape(y[1:1023],3,:),dims=1));record("aggregated_fitted_phi",ar_fit(quarterly)[2])
        @assert abs(sum(phi.^(2 .*collect(0:3)))-(1-phi^8)/(1-phi^2))<1e-12
    elseif k==3
        phi=.6;theta=.4;y=zeros(512)
        for t in 2:512;y[t]=phi*y[t-1]+e[t]+theta*e[t-1];end
        best=(0.,0.);loss=Inf
        for p in [.2,.4,.6,.8],q in [-.4,0.,.4,.8]
            candidate=mean(arma_residuals(y,p,q)[31:512].^2)
            if candidate<loss;best=(p,q);loss=candidate;end
        end
        record("conditional_phi",best[1]);record("conditional_theta",best[2]);record("sample_acf1",ac(y,1))
        record("theoretical_ma1_acf",theta/(1+theta^2));record("invertible_ma_equivalent",theta/(1+theta^2)-(1/theta)/(1+(1/theta)^2));record("innovation_mse",loss)
        record("sample_pacf1",pac(y,1));record("sample_pacf2",pac(y,2));innovation=arma_residuals(y,best...)[end]
        forecast=best[1]*y[end]+best[2]*innovation;record("arma_forecast_h3",best[1]^2*forecast)
    elseif k==4
        y=ar(e[1:360],.8);err=rolling(y,4,120);naive=[y[t+4]-y[t] for t in 120:356]
        record("ar_rmse_h4",rmse(err));record("naive_rmse_h4",rmse(naive));v=sum(0.8 .^(2 .*collect(0:3)))
        record("known_parameter_variance",v);record("known_parameter_interval_coverage",mean(abs.(err).<=1.96*sqrt(v)))
        record("loss_difference",mean(err.^2 .-naive.^2));record("asymmetric_optimal_quantile",3/4);@assert length(y[124:360])==length(err)
        record("forecast_error_ljung_box8",ljung_box(err,8))
    elseif k==5
        signal=ar(e[1:240],.8);y=signal.+f[1:240];a=ma_filter(y);b=ma_filter(y,true)
        altered=copy(y);altered[122:240].+=100
        record("one_sided_future_sensitivity",ma_filter(altered)[121]-a[121]);record("centered_future_sensitivity",ma_filter(altered,true)[121]-b[121])
        record("raw_signal_rmse",rmse(y.-signal));record("one_sided_signal_rmse",rmse(a[3:240].-signal[3:240]));record("noise_variance",var(f[1:240];corrected=false))
        @assert ma_filter(altered)[121]==a[121] && ma_filter(altered,true)[121]!=b[121]
    elseif k==6
        walk=cumsum(e[1:360]);other=cumsum(f[1:360]);u=ols(hcat(ones(360),other),walk).u
        record("spurious_level_r2",1-dot(u,u)/sum((walk.-mean(walk)).^2));d=ols(hcat(ones(359),diff(other)),diff(walk)).u
        record("differenced_r2",1-dot(d,d)/sum((diff(walk).-mean(diff(walk))).^2));record("df_statistic",df_stat(walk))
        record("adf_statistic_lag2",adf_stat(walk,2));record("df_adf_zero_lag_error",adf_stat(walk,0)-df_stat(walk))
        record("arima010_drift_forecast_h3",walk[end]+3*mean(diff(walk)))
        for n in [80,240,720]
            stats=[df_stat(cumsum(normals(n,515+i))) for i in 0:199];count=mean(stats.< -2.86)
            record("df_rejection_n"*string(n),count);record("df_mcse_n"*string(n),sqrt(count*(1-count)/200))
        end
        record("random_walk_h12_variance",12)
    elseif k==7
        n=360;t=collect(0:n-1);temperature=60 .+18*sin.(2*pi*t/12).+3*f[1:n]
        cooling=max.(temperature.-65,0);heating=max.(65 .-temperature,0)
        X=hcat(ones(n),sin.(2*pi*t/12),cos.(2*pi*t/12),heating,cooling)
        y=X*[100.,3.,-2.,.8,1.2]+ar(e[1:n],.6);fit=ols(X,y);rho=ar_fit(fit.u)[2]
        gls=ols(X[2:end,:].-rho*X[1:end-1,:],y[2:end].-rho*y[1:end-1]);bt=gls.b
        record("ols_heating",fit.b[4]);record("gls_heating",bt[4]);record("gls_cooling",bt[5]);record("estimated_error_phi",rho)
        record("gls_innovation_acf1",ac(gls.u,1));record("hot_scenario_level",dot([1.,0.,1.,0.,15.],bt));record("cold_scenario_level",dot([1.,0.,1.,15.,0.],bt));@assert rank(X)==5
    elseif k==8
        state=ar(.5*e[1:360],.8);y=state.+f[1:360];y[151]=NaN;K=kalman(y)
        record("filter_rmse",rmse(K.m.-state));record("smoother_rmse",rmse(K.s.-state));record("missing_filtered_variance",K.P[151]);record("previous_filtered_variance",K.P[150])
        changed=copy(y);changed[182:360].+=10;C=kalman(changed)
        record("filter_future_sensitivity",C.m[181]-K.m[181]);record("smoother_future_sensitivity",C.s[181]-K.s[181]);record("minimum_smoothing_variance",minimum(K.S))
        a=vcat(0.,.8*K.m[1:end-1]);previous=vcat(.25/(1-.8^2),K.P[1:end-1]);observation_variance=.8^2*previous .+ 0.25 .+ 1
        observed=.!isnan.(y);innovation=y[observed]-a[observed]
        record("gaussian_log_likelihood",-.5*sum(log.(2*pi*observation_variance[observed]).+innovation.^2 ./observation_variance[observed]))
        @assert all(K.S.>= -1e-12)&&all(K.S.<=K.P.+1e-12)&&C.m[181]==K.m[181]
    elseif k in [9,10]
        A=[.6 .15;.05 .5];Y=zeros(600,2);B=[1. 0.;.7 .8]
        for t in 2:600;Y[t,:]=A*Y[t-1,:]+B*E[t,1:2];end
        fit=var_fit(Y);Ah=fit.A;Sigma=fit.Sigma
        if k==9
            record("estimated_a12",Ah[1,2]);record("estimated_a21",Ah[2,1]);record("spectral_radius",maximum(abs.(eigvals(Ah))))
            W=[0. 1.;1. 0.];record("network_forecast_first",((.6*I+.15*W)*Y[600,:])[1]);record("var_forecast_first",(fit.c+Ah*Y[600,:])[1]);record("residual_covariance12",Sigma[1,2])
            V=zeros(2,2);power=Matrix{Float64}(I,2,2)
            for j in 1:4;V+=power*Sigma*power';power=power*Ah;end
            record("forecast_covariance_h4_trace",tr(V));record("forecast_sum_variance_h4",sum(V))
        else
            L=Matrix(cholesky(Symmetric(Sigma)).L);order=[0. 1.;1. 0.];reverse=order*Matrix(cholesky(Symmetric(order*Sigma*order)).L)*order
            record("first_order_impact21",L[2,1]);record("reverse_order_impact21",reverse[2,1]);angle=.5;Q=[cos(angle) -sin(angle);sin(angle) cos(angle)];rotated=L*Q
            record("covariance_reconstruction_error",maximum(abs.(rotated*rotated'-Sigma)));record("rotated_impact21",rotated[2,1]);record("response_h4",(Ah^4*L)[2,1])
            @assert maximum(abs.(L*L'-Sigma))<1e-10&&maximum(abs.(reverse*reverse'-Sigma))<1e-10
        end
    elseif k==11
        x=cumsum(e[1:720]);spread=ar(.4*f[1:720],.5);y=1.5*x+spread
        fit=ols(hcat(ones(720),x),y);u=fit.u;X=hcat(ones(719),u[1:end-1],diff(x));ec=ols(X,diff(y))
        record("cointegrating_beta",fit.b[2]);record("error_correction_alpha",ec.b[2]);record("short_run_dx",ec.b[3]);record("spread_variance",var(u;corrected=false))
        record("ecm_innovation_acf1",ac(ec.u,1));record("spread_ar_phi",ar_fit(u)[2]);record("ecm_forecast_change",dot([1.,u[end],0.],ec.b))
    elseif k==12
        n=1024;u=zeros(n);v=ones(n)
        for t in 1:n
            if t>1;v[t]=.1+.1*u[t-1]^2+.8*v[t-1];end
            u[t]=sqrt(v[t])*e[t]
        end
        parameters,loss=garch_fit(u);fitted=garch_variance(u,parameters...);z=u./sqrt.(fitted)
        record("omega_grid",parameters[1]);record("alpha_grid",parameters[2]);record("beta_grid",parameters[3]);record("qll_objective",loss)
        record("squared_return_acf1",ac(u.^2,1));record("squared_standardized_acf1",ac(z.^2,1))
        next_variance=parameters[1]+parameters[2]*u[end]^2+parameters[3]*fitted[end]
        record("conditional_q05",-1.6448536269514722*sqrt(next_variance));record("unconditional_variance",.1/(1-.1-.8))
        long_run=parameters[1]/(1-parameters[2]-parameters[3]);record("variance_forecast_h5",long_run+(parameters[2]+parameters[3])^4*(next_variance-long_run))
        decimal=garch_variance(u./100,parameters[1]/10000,parameters[2],parameters[3]);record("unit_scaling_error",maximum(abs.(decimal*10000-fitted)))
        rejected=try;garch_variance(u,.1,.3,.8);0;catch;1;end
        record("invalid_parameter_rejected",rejected);@assert rejected==1
    elseif k==13
        y=zeros(480)
        for t in 2:480;y[t]=(t<=300 ? .8 : -.4)*y[t-1]+e[t];end
        expanding=rolling(y,1,330);moving=rolling(y,1,330,80)
        record("expanding_rmse",rmse(expanding));record("rolling_rmse",rmse(moving));difference=moving.^2 .-expanding.^2
        record("paired_mean_loss_difference",mean(difference));blocks=[mean(difference[i:i+9]) for i in 1:10:div(length(difference),10)*10]
        record("block_standard_error",std(blocks)/sqrt(length(blocks)));record("early_fitted_phi",ar_fit(y[1:240])[2]);record("late_fitted_phi",ar_fit(y[361:480])[2])
        record("hac_standard_error",hac_mean_se(difference,3))
    elseif k==14
        y=ar(e[1:420],.65);y[301:420].+=4;candidates=[40,80,160]
        validation=[rmse(rolling(y[1:300],1,240,w)) for w in candidates];chosen=candidates[argmin(validation)]
        record("validation_selected_window",chosen);frozen=rolling(y,1,340,chosen);benchmark=y[341:420]-y[340:419]
        record("continuation_rmse",rmse(frozen));record("continuation_naive_rmse",rmse(benchmark));record("validation_rmse",minimum(validation));record("continuation_observations",length(frozen));record("future_targets_excluded",1)
    elseif k==15
        y=ar(e[1:240],.75,2.);forecast=ar_forecast(y[1:180],3);record("forecast_original_units",forecast)
        record("forecast_rescaled_error",ar_forecast(100*y[1:180],3)/100-forecast);changed=copy(y);changed[181:240].+=1000
        record("future_mutation_forecast_error",ar_forecast(changed[1:180],3)-forecast);record("random_walk_error_variance_h1",1)
        record("random_walk_error_variance_h12",12);record("ar_zero_error_variance_h12",1)
        rejected=try;ols(ones(10,2),collect(0:9));0;catch;1;end
        record("rank_failure_detected",rejected);@assert abs(out["15_forecast_rescaled_error"])<1e-10
    else
        error("Lecture must be an integer from 1 through 15")
    end
    @assert all(isfinite,values(out));out
end
function run(lecture=nothing,output=joinpath(ROOT,"results","julia.csv"))
    E=fixtures();result=Dict{String,Float64}()
    for k in (isnothing(lecture) ? (1:15) : [lecture]);merge!(result,experiment(k,E));end
    mkpath(dirname(output))
    open(output,"w") do file
        println(file,"metric,value")
        for key in sort(collect(keys(result)));println(file,key,",",result[key]);println(key,": ",result[key]);end
    end
    result
end
if abspath(PROGRAM_FILE)==@__FILE__;run(isempty(ARGS) ? nothing : parse(Int,ARGS[1]));end
