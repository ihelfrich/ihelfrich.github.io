# Chapter 1: independent Julia enumeration using only Base.
lines = readlines(joinpath(@__DIR__, "data", "alert-days.csv"))
rows = [parse.(Int, split(line, ',')) for line in lines[2:end]]
heat = [r[2] for r in rows]
shock = [r[3] for r in rows]
weights = [r[4] for r in rows]
function weighted(values, indices=eachindex(rows))
    sum(weights[i]*values[i] for i in indices) / sum(weights[i] for i in indices)
end
result = Dict{String,Float64}("probability_sum"=>sum(weights./sum(weights)),
    "heat_mean"=>weighted(heat), "shock_mean"=>weighted(shock),
    "missing_heat0_alert1_probability"=>0, "missing_heat1_alert0_probability"=>0)
for b in (-2,-1,0,1,2)
    y = [10+b*heat[i]+(2-b)*heat[i]+shock[i] for i in eachindex(rows)]
    baseline = 10 .+ 2 .* heat .+ shock
    forecast = 10 .+ 2 .* heat
    potential0 = 10 .+ (2-b) .* heat .+ shock
    potential1 = 10 .+ b .+ (2-b) .* heat .+ shock
    conditional = [weighted(y, findall(==(a),heat)) for a in (0,1)]
    randomized = [(a=a,u=heat[i],v=shock[i],w=weights[i]) for a in (0,1) for i in eachindex(rows)]
    randommeans = [sum(r.w*(10+b*r.a+(2-b)*r.u+r.v) for r in randomized if r.a==a) /
                   sum(r.w for r in randomized if r.a==a) for a in (0,1)]
    metrics = Dict("observed_mean"=>weighted(y), "conditional0"=>conditional[1],
       "conditional1"=>conditional[2], "observed_difference"=>conditional[2]-conditional[1],
       "forecast_mse"=>weighted((y.-forecast).^2), "constant_mse"=>weighted((y.-11).^2),
       "poor_forecast_mse"=>weighted((y.-(9 .+ 4 .* heat)).^2),
       "do0_mean"=>weighted(potential0), "do1_mean"=>weighted(potential1),
       "paired_effect"=>weighted(potential1.-potential0),
       "randomized0"=>randommeans[1], "randomized1"=>randommeans[2],
       "randomized_difference"=>randommeans[2]-randommeans[1],
       "net_benefit"=>1000*(weighted(potential0)-weighted(potential1))-500,
       "mse_kw2"=>weighted((1000 .* y.-1000 .* forecast).^2),
       "effect_kw"=>weighted(1000 .* potential1.-1000 .* potential0),
       "observational_invariance_error"=>maximum(abs.(y.-baseline)),
       "minimum_intervention_load"=>minimum(vcat(potential0,potential1)))
    for i in eachindex(rows)
        metrics["observed_state$i"] = y[i]
        metrics["do0_state$i"] = potential0[i]
        metrics["do1_state$i"] = potential1[i]
    end
    for (key,value) in metrics
        result["b$(b)_$key"] = value
    end
end
println("metric,value")
for key in sort(collect(keys(result)))
    println(key, ',', result[key])
end
