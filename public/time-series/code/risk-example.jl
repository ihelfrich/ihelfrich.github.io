# Exact enumeration for the two risk states in Lecture 2; standard library only.
values=Dict{String,Float64}()
for scale in (1,3)
    errors=[scale*(0.5*first+second) for (first,second) in Iterators.product((-1,1),(-1,1))]
    values["state_$(scale)_mean_error"]=sum(errors)/length(errors)
    values["state_$(scale)_variance"]=sum(abs2,errors)/length(errors)
end
values["unconditional_variance"]=(values["state_1_variance"]+values["state_3_variance"])/2
values["opening_forecast"]=3+0.5*(3+0.5*10)
for phi in (-0.95,-0.5,0,0.5,0.95,1), h in (1,2,24)
    key=isinteger(phi) ? string(Int(phi)) : string(phi)
    values["response_$(key)_$(h)"]=phi^h
    values["variance_$(key)_$(h)"]=sum(phi^(2*j) for j in 0:h-1)
end
println("metric,value")
for key in sort!(collect(keys(values)))
    println(key,",",values[key])
end
