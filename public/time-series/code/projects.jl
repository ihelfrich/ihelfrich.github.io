# Complete public Build/Audit/Revise case. See projects.py and data manifest.
include("course.jl")
raw=readdlm(joinpath(ROOT,"data","texas-electricity.csv"),',',Any;skipstart=1)
periods=string.(raw[:,1]);y=Float64.(raw[:,3])./1e6;temp=Float64.(raw[:,6])
function design(t,temperature=nothing)
    t=collect(t);X=hcat(ones(length(t)),t./12,sin.(2*pi*t/12),cos.(2*pi*t/12))
    isnothing(temperature) ? hcat(X,sin.(4*pi*t/12),cos.(4*pi*t/12)) : hcat(X,max.(65 .-temperature,0),max.(temperature.-65,0))
end
function forecast(y,temp,target,method="ar",window=0,release_lag=2)
    origin=target-1;latest=origin-release_lag;h=target-latest
    first=window==0 ? 0 : max(0,latest-window+1)
    method=="naive"&&return y[target-12+1]
    idx=first+1:latest+1
    method=="ar"&&return ar_forecast(y[idx],h)
    time=collect(first:latest);X=design(time,method=="weather" ? temp[idx] : nothing)
    fit=ols(X,y[idx]);u=fit.u;rho=ar_fit(u)[2]
    abs(rho)<1||error("Unstable residual process")
    if method=="weather"
        same=time[mod.(time,12).==mod(target,12)];length(same)>=2||error("Too little climate history")
        x=vec(design([target],[65.]));x[5]=mean(max.(65 .-temp[same.+1],0));x[6]=mean(max.(temp[same.+1].-65,0))
    else;x=vec(design([target]));end
    dot(x,fit.b)+rho^h*u[end]
end
function table(targets,method,window=0;y_input=y,temp_input=temp)
    rows=Vector{Any}()
    for target in targets
        fallback=0
        value=try;forecast(y_input,temp_input,target,method,window);catch;fallback=1;forecast(y_input,temp_input,target,"naive");end
        push!(rows,[periods[target],periods[target+1],periods[target-2],method,window,y_input[target+1],value,y_input[target+1]-value,fallback])
    end
    rows
end
function project_run()
    results=Dict{String,Float64}();all_rows=Vector{Any}()
    function keep(phase,rows)
        append!(all_rows,[vcat(row,phase) for row in rows]);Float64[row[8] for row in rows]
    end
    baseline=keep("build",table(120:155,"naive"));original=keep("build",table(120:155,"ar"))
    results["p1_naive_rmse"]=rmse(baseline);results["p1_ar_rmse"]=rmse(original)
    honest=keep("audit",table(156:179,"ar"));impossible=[y[t+1]-mean(y[t-1:t+3]) for t in 156:179]
    results["p2_original_rmse"]=rmse(honest);results["p2_leaky_centered_rmse"]=rmse(impossible)
    mutated=copy(y);mutated[158:end].+=100
    results["p2_leaky_future_sensitivity"]=mean(mutated[155:159])-mean(y[155:159])
    chosen=("calendar",0);loss=Inf
    for method in ["calendar","weather"],window in [60,120,0]
        errors=keep("repair-selection",table(156:179,method,window));score=mean(errors.^2)
        if score<loss;loss=score;chosen=(method,window);end
    end
    results["p2_repair_validation_rmse"]=sqrt(loss)
    revised=keep("continuation",table(180:191,chosen...));base=keep("continuation",table(180:191,"naive"));old=keep("continuation",table(180:191,"ar"))
    results["p3_revised_rmse"]=rmse(revised);results["p3_naive_rmse"]=rmse(base);results["p3_original_rmse"]=rmse(old)
    results["p3_paired_mse_difference"]=mean(revised.^2 .-base.^2);results["p3_selected_weather"]=chosen[1]=="weather";results["p3_selected_window"]=chosen[2]
    target=180;value=forecast(y,temp,target,chosen...);altered=copy(y);altered[179:192].+=1000;altered_temp=copy(temp);altered_temp[179:192].+=100
    results["p3_future_mutation_error"]=forecast(altered,altered_temp,target,chosen...)-value
    @assert abs(results["p3_future_mutation_error"])<1e-9&&all(isfinite,values(results))
    open(joinpath(ROOT,"results","projects-julia.csv"),"w") do file
        println(file,"metric,value")
        for key in sort(collect(keys(results)));println(file,key,",",results[key]);println(key,": ",results[key]);end
    end
    open(joinpath(ROOT,"results","project-forecasts-julia.csv"),"w") do file
        println(file,"origin,target,latest_available,method,window,actual_million_mwh,forecast_million_mwh,error,fallback,phase")
        for row in all_rows;println(file,join(row,","));end
    end
    results
end
project_run()
