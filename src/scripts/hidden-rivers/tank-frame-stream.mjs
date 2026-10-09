// Presentation only: immutable computed endpoints, never predicted fluid fields.
export function createTankFrameStream(){
 let from=null,to=null,queue=[],start=0,span=20,arrival=null,lastTime=null,rate=null,held=null,waiting=true,lastSample=null;
 function duration(next){const delta=Math.max(0,next.diagnostics.time-to.diagnostics.time);return Math.max(8,delta/(rate||.001)*(queue.length>=2?.9:1.06));}
 function advance(now){
  const clock=held??now,effective=lastSample===null?clock:Math.max(lastSample,clock);lastSample=effective;
  while(to&&queue.length&&(from===to||effective-start>=span)){
   const next=queue.shift(),nextSpan=duration(next),nextStart=waiting?effective:start+span;from=to;to=next;start=nextStart;span=nextSpan;waiting=false;
  }
  if(to&&effective-start>=span&&!queue.length)waiting=true;
  return effective;
 }
 return {
  push(frame,now){
   if(!frame||!Number.isFinite(frame.diagnostics?.time)||!Number.isFinite(now))throw new TypeError('Invalid computed tank frame');
   if(!to){from=to=frame;arrival=now;lastTime=frame.diagnostics.time;start=held??now;return;}
   advance(now);const time=frame.diagnostics.time;
   if(time<lastTime)throw new RangeError('Tank frame time moved backwards');
   if(time===lastTime){if(to.diagnostics.time===time)to=frame;if(from.diagnostics.time===time)from=frame;if(queue.length)queue[queue.length-1]=frame;return;}
   const measured=(time-lastTime)/Math.max(8,now-arrival);rate=rate===null?measured:.8*rate+.2*measured;arrival=now;lastTime=time;
   queue.push(frame);if(queue.length>3)queue.splice(0,queue.length-3);advance(now);
  },
  sample(now){if(!to)return null;const effective=advance(now),mix=from===to?1:Math.max(0,Math.min(1,(effective-start)/span));return {previous:from,current:to,mix,time:from.diagnostics.time+(to.diagnostics.time-from.diagnostics.time)*mix};},
  pause(now){advance(now);held=now;},
  resume(now){if(held!==null){start+=now-held;arrival=now;lastSample=now;}held=null;},
  getStats:()=>({queued:queue.length,spanMs:span}),
  reset(){from=to=null;queue=[];start=0;span=20;arrival=lastTime=rate=held=lastSample=null;waiting=true;}
 };
}
