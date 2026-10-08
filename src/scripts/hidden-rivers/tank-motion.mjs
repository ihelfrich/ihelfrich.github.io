// Display time only. No extrapolation or change to the worker's physical state.
export function createTankPacer({stepSeconds=.01}={}){
  if(!Number.isFinite(stepSeconds)||stepSeconds<=0||stepSeconds>.04)throw new RangeError('Invalid pacing timestep');
  let last=null,credit=0;
  return {
    request(now,rate,active,available){
      if(!active){last=null;credit=0;return 0;}
      const elapsed=last===null?0:Math.max(0,Math.min(.08,(now-last)/1000));last=last===null?now:Math.max(last,now);
      credit=Math.min(.08,credit+elapsed*rate);if(!available)return 0;
      const count=Math.min(2,Math.floor((credit+1e-12)/stepSeconds));credit-=count*stepSeconds;return count;
    },
    reset(){last=null;credit=0;}
  };
}
export function createTankMotion(){
  let previous=null,current=null,start=0,arrival=null,span=20,held=null;
  function sample(now){
    if(!current)return null;
    const mix=previous?Math.max(0,Math.min(1,((held??now)-start)/span)):1;
    return {previous:previous||current,current,mix,time:previous?previous.diagnostics.time+(current.diagnostics.time-previous.diagnostics.time)*mix:current.diagnostics.time};
  }
  return {
    sample,
    push(frame,now){
      const source=sample(now);previous=source?{diagnostics:{time:source.time}}:null;current=frame;
      span=arrival===null?20:Math.max(8,Math.min(500,now-arrival));arrival=now;start=held??now;return source?.mix??1;
    },
    pause(now){held=now;},
    resume(now){if(held!==null)start+=now-held;held=null;},
    reset(){previous=current=null;arrival=null;held=null;span=20;}
  };
}
