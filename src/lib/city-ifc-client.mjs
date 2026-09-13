import {IFC_LIMITS} from './city-ifc.mjs';
export function createIfcClient({workerFactory=()=>new Worker(new URL('../scripts/city/city-ifc-worker.mjs',import.meta.url),{type:'module'}),timeoutMs=IFC_LIMITS.timeoutMs}={}){
 let worker=null,serial=0,disposed=false;const pending=new Map();
 function stop(error){const old=worker;worker=null;old?.terminate();for(const item of pending.values()){clearTimeout(item.timer);item.reject(error);}pending.clear();}
 function start(){if(disposed)throw Error('The model inspector was closed.');if(worker)return worker;const own=worker=workerFactory();
  own.onmessage=({data})=>{if(worker!==own)return;const item=pending.get(data.id);if(!item)return;if(data.type==='progress'){item.progress?.(data.progress);return;}clearTimeout(item.timer);pending.delete(data.id);if(data.type==='error')item.reject(Error(data.message||'The IFC parser could not read this model.'));else item.resolve(data.result);};
  own.onerror=event=>{event.preventDefault?.();if(worker===own)stop(Error('The local IFC worker could not run. Try the example or a smaller model.'));};return own;
 }
 function request(type,payload,transfer=[],progress){return new Promise((resolve,reject)=>{let own;try{own=start();}catch(error){reject(error);return;}const id=++serial,timer=setTimeout(()=>stop(Error('Local model processing exceeded 45 seconds. Try a smaller IFC.')),timeoutMs);pending.set(id,{resolve,reject,timer,progress});try{own.postMessage({id,type,...payload},transfer);}catch(error){stop(error);}});}
 return{load(bytes,onProgress){stop(new DOMException('Model replaced.','AbortError'));return request('load',{bytes},[bytes],onProgress);},properties(elementId){return request('properties',{elementId});},cancel(){stop(new DOMException('Local model loading cancelled.','AbortError'));},destroy(){disposed=true;stop(new DOMException('Model inspector closed.','AbortError'));}};
}
