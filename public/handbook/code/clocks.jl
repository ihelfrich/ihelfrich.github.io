# Independent implementation using Julia Base and Dates; no package or network dependency.
using Dates
root=@__DIR__
function csvrows(name)
    lines=readlines(joinpath(root,"data",name));head=split(lines[1],',')
    [Dict(zip(head,split(line,','))) for line in lines[2:end]]
end
function timestamp(s)
    length(s)==20 && endswith(s,"Z") || error("Use UTC timestamps ending Z.")
    DateTime(s[1:19],dateformat"yyyy-mm-ddTHH:MM:SS")
end
function ledger(name,field)
    [Dict{String,Any}("record_id"=>r["record_id"],"period"=>r["period"],
     "stage"=>parse(Int,r["stage"]),"release_utc"=>r["release_utc"],"value"=>parse(Float64,r[field])) for r in csvrows(name)]
end
function validate(records)
    keys=[(r["period"],r["release_utc"]) for r in records]
    length(unique(keys))==length(keys) || error("Ambiguous period/release key.")
    for r in records;Date(r["period"]);timestamp(r["release_utc"]);isfinite(r["value"]) || error("Nonfinite value.");end
end
function latest(records)
    result=Dict{String,Any}()
    for r in records
        p=r["period"]
        if !haskey(result,p) || timestamp(r["release_utc"])>timestamp(result[p]["release_utc"]);result[p]=r;end
    end
    result
end
function asof(records,origin,delay=0)
    validate(records);delay>=0 || error("Negative delay.")
    latest([r for r in records if timestamp(r["release_utc"])+Second(delay)<=timestamp(origin)])
end
function forecast(snapshot,target="2024-03-01")
    values=[r["value"] for (p,r) in snapshot if p<target]
    isempty(values) && error("No training value; no zero imputation.")
    sum(values)/length(values)
end
out=Dict{String,Float64}();gdp=ledger("gdp-release-ledger.csv","value_percent")
for origin in csvrows("clock-origins.csv"), delay in (0,60,3600)
    prefix="gdp_o$(origin["origin_id"])_d$(delay)_";cut=origin["origin_utc"]
    selected=get(asof(gdp,cut,delay),"2024-01-01",nothing)
    future(r)=timestamp(r["release_utc"])+Second(delay)>timestamp(cut)
    changed=[merge(r,Dict("value"=>r["value"]+(future(r) ? 10 : 0))) for r in gdp]
    mutated=get(asof(changed,cut,delay),"2024-01-01",nothing)
    added=get(asof(vcat(gdp,[merge(gdp[end],Dict("record_id"=>"authored-future","release_utc"=>"2024-08-01T12:30:00Z","stage"=>4,"value"=>777.0))]),cut,delay),"2024-01-01",nothing)
    reversed=get(asof(reverse(gdp),cut,delay),"2024-01-01",nothing)
    values=Dict("stage"=>isnothing(selected) ? 0 : selected["stage"],"found"=>!isnothing(selected),
      "eligible_rows"=>sum(!future(r) for r in gdp),"latest_value"=>latest(gdp)["2024-01-01"]["value"],
      "mutated_latest_value"=>latest(changed)["2024-01-01"]["value"],
      "append_same"=>added==selected,"reorder_same"=>reversed==selected,"future_mutation_same"=>mutated==selected)
    if !isnothing(selected);values["growth"]=selected["value"];values["mutated_growth"]=mutated["value"];end
    for (k,v) in values;out[prefix*k]=v;end
end
for r in gdp;out["stage$(r["stage"])_quarterly_percent"]=100*((1+r["value"]/100)^.25-1);end
merge!(out,Dict("revision_second_minus_advance"=>gdp[2]["value"]-gdp[1]["value"],
 "revision_third_minus_second"=>gdp[3]["value"]-gdp[2]["value"],"revision_third_minus_advance"=>gdp[3]["value"]-gdp[1]["value"]))
toy=ledger("controlled-release-ledger.csv","value");origin="2024-03-06T09:00:00Z"
locked=forecast(asof(toy,origin));late=forecast(latest(toy))
changed=[merge(r,Dict("value"=>r["value"]+(timestamp(r["release_utc"])>timestamp(origin) ? 1000 : 0))) for r in toy]
merge!(out,Dict("toy_before"=>forecast(asof(toy,"2024-03-04T09:00:00Z")),"toy_locked"=>locked,
 "toy_after_revision"=>forecast(asof(toy,"2024-03-15T09:00:00Z")),"toy_late"=>late,
 "toy_mutated_locked"=>forecast(asof(changed,origin)),"toy_mutated_late"=>forecast(latest(changed)),
 "toy_first_target"=>5,"toy_revised_target"=>7,"toy_first_squared_error"=>(5-locked)^2,
 "toy_revised_squared_error"=>(7-locked)^2,"toy_late_first_squared_error"=>(5-late)^2,
 "toy_late_revised_squared_error"=>(7-late)^2,"toy_score_cross_term"=>2*(5-locked)*(7-5),"toy_score_revision_squared"=>(7-5)^2))
worlds=csvrows("information-worlds.csv");y=[parse(Float64,r["y"]) for r in worlds]
weights=[parse(Float64,r["weight"]) for r in worlds];p=weights./sum(weights);av(z)=sum(p.*z)
groups=[r["signal"] for r in worlds]
coarse=[sum(p[groups.==groups[i]].*y[groups.==groups[i]])/sum(p[groups.==groups[i]]) for i in 1:4]
merge!(out,Dict("worlds"=>4,"probability_sum"=>sum(p),"no_information_mean"=>av(y),
 "no_information_risk"=>av((y.-av(y)).^2),"coarse_risk"=>av((y.-coarse).^2),
 "coarse_gain"=>av((coarse.-av(y)).^2),"exact_risk"=>0,
 "nonadapted_pair_count"=>sum(groups[i]==groups[j] && y[i]!=y[j] for i in 1:4 for j in i+1:4)))
for i in 1:4;out["state$(i)_coarse_forecast"]=coarse[i];end
for (name,bad) in (("duplicate",vcat(gdp,[gdp[1]])),("nonfinite",[merge(gdp[1],Dict("value"=>NaN))]))
    try;asof(bad,origin);out[name*"_rejected"]=0;catch;out[name*"_rejected"]=1;end
end
try;asof(gdp,origin,-1);out["negative_delay_rejected"]=0;catch;out["negative_delay_rejected"]=1;end
try;forecast(Dict{String,Any}());out["empty_forecast_rejected"]=0;catch;out["empty_forecast_rejected"]=1;end
println("metric,value")
for key in sort(collect(keys(out)));println(key,',',out[key]);end
