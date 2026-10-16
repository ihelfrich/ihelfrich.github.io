// Directed shortest paths and employment accessibility. No UI or credentials.
export class MinHeap {
  a = [];
  push(node, cost) {
    const a=this.a; let i=a.length; a.push([node,cost]);
    while(i>0){const p=(i-1)>>1;if(a[p][1]<=cost)break;a[i]=a[p];i=p;}a[i]=[node,cost];
  }
  pop(){const a=this.a,first=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&a[j+1][1]<a[j][1])j++;if(a[j][1]>=last[1])break;a[i]=a[j];i=j;}a[i]=last;}return first;}
  get size(){return this.a.length;}
}
export function makeGraph(data){
  const adj=Array.from({length:data.nodes.length},()=>[]);
  for(const [a,b,t,g] of data.edges){if(!(t>0)||!Number.isFinite(t))throw new Error('Invalid edge time');adj[a].push([b,t,g]);}
  return adj;
}
export function shortestPaths(adj, source, closed = new Set(), targets) {
  const dist=new Float64Array(adj.length).fill(Infinity); dist[source]=0;
  const heap=new MinHeap();heap.push(source,0);
  const remaining=targets ? new Set(targets) : null;
  while(heap.size){
    const [u,du]=heap.pop();if(du!==dist[u])continue;
    if(remaining){remaining.delete(u);if(!remaining.size)break;}
    for(const [v,w,group] of adj[u]){
      if(group>=0&&closed.has(group))continue;
      const candidate=du+w;if(candidate<dist[v]){dist[v]=candidate;heap.push(v,candidate);}
    }
  }
  return dist;
}
export function travelMatrix(data, adj, closed = []) {
  const n=data.cells.length, result=new Float64Array(n*n),targets=data.cells.map(c=>c.node), set=new Set(closed);
  const connector=c=>c.snapMeters/(15*1609.344/60);
  for(let i=0;i<n;i++){
    const d=shortestPaths(adj,data.cells[i].node,set,targets);
    for(let j=0;j<n;j++){
      // Within a 1 km cell uses a fixed 2 minute local-access assumption.
      result[i*n+j]=i===j ? 2 : d[data.cells[j].node]+connector(data.cells[i])+connector(data.cells[j]);
    }
  }
  return result;
}
export function accessibility(data,matrix,{halfLife=15,threshold=30,speedFactor=1}={}){
  if(!(Number.isFinite(halfLife)&&halfLife>0&&threshold>0&&speedFactor>0))throw new Error('Positive parameters required');
  const n=data.cells.length,gravity=new Float64Array(n),within=new Float64Array(n),reachable=new Float64Array(n);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
    const t=matrix[i*n+j]/speedFactor,jobs=data.cells[j].jobs;
    if(!Number.isFinite(t))continue;
    gravity[i]+=jobs*Math.exp(-Math.LN2*t/halfLife);
    if(t<=threshold)within[i]+=jobs;
    reachable[i]+=jobs;
  }
  return {gravity,within,reachable};
}
export function compareAccess(data,base,current){
  const groups={};
  for(const weight of ['workers','low','middle','high']){
    let denom=0,initial=0,after=0,initialWithin=0,afterWithin=0,unreachable=0;
    data.cells.forEach((c,i)=>{const w=c[weight];denom+=w;initial+=w*base.gravity[i];after+=w*current.gravity[i];initialWithin+=w*base.within[i];afterWithin+=w*current.within[i];unreachable+=w*(base.reachable[i]-current.reachable[i]);});
    groups[weight]={workers:denom,retained:initial>0?100*after/initial:null,baselineGravity:denom?initial/denom:null,scenarioGravity:denom?after/denom:null,baselineWithin:denom?initialWithin/denom:null,scenarioWithin:denom?afterWithin/denom:null,unreachableJobs:denom?unreachable/denom:null};
  }
  const cells=data.cells.map((c,i)=>({id:c.id,retained:base.gravity[i]>0?100*current.gravity[i]/base.gravity[i]:null,gravity:current.gravity[i],baselineGravity:base.gravity[i],within:current.within[i],baselineWithin:base.within[i],unreachable:base.reachable[i]-current.reachable[i]}));
  return {groups,cells};
}
