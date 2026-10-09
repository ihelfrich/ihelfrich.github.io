# Independent exact-state implementation: Julia Base only.
root=@__DIR__
data=readlines(joinpath(root,"data","meter-states.csv"))[2:end]
rows=[parse.(Float64,split(r,',')) for r in data]
p=[r[6] for r in rows];p ./= sum(p)
expect(a)=sum(p .* a)
covariance(a,b)=sum(p .* (a .- expect(a)) .* (b .- expect(b)))
function projection(a,b)
    s=covariance(a,b)/covariance(a,a)
    i=expect(b)-s*expect(a)
    (s,i,expect((b .- i .- s .* a).^2))
end
x=[r[2] for r in rows]
y=[30+50*r[2]+r[5] for r in rows]
out=Dict{String,Float64}("probability_sum"=>sum(p),"states"=>length(rows))
for h in (0,2,4)
    for (name,kappa) in (("classical",0.0),("compressed",-0.5),("reversed",-2.0))
        prefix="h$(h)_$(name)_"
        m=[r[2]+kappa*(r[2]-10)+h*r[3] for r in rows]
        twin=[r[2]+kappa*(r[2]-10)+h*r[4] for r in rows]
        w=m .- x
        average=(m .+ twin)./2
        slope,intercept,risk=projection(m,y)
        avg_slope,_,avg_risk=projection(average,y)
        conditional=Dict(v=>sum(p[m.==v].*y[m.==v])/sum(p[m.==v]) for v in unique(m))
        conditional_risk=expect([(y[j]-conditional[m[j]])^2 for j in eachindex(m)])
        metrics=Dict("mean_x"=>expect(x),"mean_m"=>expect(m),"mean_y"=>expect(y),
            "var_x"=>covariance(x,x),"var_m"=>covariance(m,m),"var_w"=>covariance(w,w),
            "cov_x_w"=>covariance(x,w),"cov_m_y"=>covariance(m,y),
            "cov_m1_m2"=>covariance(m,twin),"slope"=>slope,"intercept"=>intercept,
            "linear_mse"=>risk,"conditional_mse"=>conditional_risk,
            "twin_ratio"=>covariance(m,y)/covariance(m,twin),
            "copied_ratio"=>covariance(m,y)/covariance(m,m),
            "average_slope"=>avg_slope,"average_mse"=>avg_risk,
            "slope_per_kwh"=>projection(1000 .* m,y)[1],
            "minimum_meter"=>minimum(m),"maximum_meter"=>maximum(m))
        for (key,value) in metrics;out[prefix*key]=value;end
        if h==2 && name=="classical"
            for j in eachindex(x)
                out["baseline_state$(j)_x"]=x[j]
                out["baseline_state$(j)_m"]=m[j]
                out["baseline_state$(j)_bill"]=y[j]
            end
        end
    end
    m=[r[2]+h*r[3] for r in rows]
    out["h$(h)_reliability"]=covariance(x,x)/covariance(m,m)
end
q=[1000,3000];n=[100,200]
merge!(out,Dict("aggregate_ratio"=>sum(q)/sum(n),"unweighted_ratio"=>sum(q./n)/2,
    "weighted_ratio"=>sum((n./sum(n)).*(q./n)),"coverage_before"=>3000/300,
    "coverage_after"=>3000/240,"coverage_growth"=>(3000/240)/(3000/300)-1,
    "coverage_log_growth"=>log(3000/240)-log(3000/300),"mwh_to_joule"=>1_000_000*3600))
println("metric,value")
for key in sort(collect(keys(out)));println(key,',',out[key]);end
