// Display time only. No extrapolation or change to the worker's physical state.
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
      span=arrival===null?20:Math.max(8,Math.min(120,now-arrival));arrival=now;start=held??now;return source?.mix??1;
    },
    pause(now){held=now;},
    resume(now){if(held!==null)start+=now-held;held=null;},
    reset(){previous=current=null;arrival=null;held=null;span=20;}
  };
}
