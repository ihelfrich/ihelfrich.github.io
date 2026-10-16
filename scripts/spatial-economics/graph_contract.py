"""Contract geometry chains while preserving directed minimum-cost routes."""
from collections import defaultdict

def contract_graph(edges, retained):
    # Parallel OSM segments must not make a two-neighbour chain look like a
    # branching path. Keep each intervention identity, and its fastest segment.
    unique = {}
    for a,b,t,g in edges:
        key=(a,b,g)
        unique[key]=min(t,unique.get(key,float('inf')))
    outgoing=defaultdict(list)
    neighbors=defaultdict(set)
    keep=set(retained)
    for (a,b,g),t in unique.items():
        outgoing[a].append((a,b,t,g))
        neighbors[a].add(b);neighbors[b].add(a)
        if g>=0:keep.update((a,b))
    keep.update(n for n,ns in neighbors.items() if len(ns)!=2)
    kept=sorted(keep);remap={old:i for i,old in enumerate(kept)}
    compressed={}
    for a in kept:
        for initial in outgoing[a]:
            prev=a;curr=initial[1];cost=initial[2];group=initial[3];seen={a}
            while curr not in keep:
                if curr in seen:break
                seen.add(curr)
                onward=[e for e in outgoing[curr] if e[1]!=prev]
                if len(onward)!=1:break
                e=onward[0];prev,curr=curr,e[1];cost+=e[2]
            if curr in remap and curr!=a:
                key=(remap[a],remap[curr],group)
                compressed[key]=min(cost,compressed.get(key,float('inf')))
    return kept,remap,compressed
