/** A pending destination is an instruction, never a claim that a renderer or
 * geographic surface is available. Keep only the latest user camera intent. */
export function createPendingMapActions() {
  let camera=null,pin=null;
  const queue=(method,args)=>{camera={method,args};pin=null;return false;};
  const map={
    flyTo(x,z,zoom,options){
      if(![x,z,zoom].every(Number.isFinite)||zoom<=0)return false;
      return queue('flyTo',[x,z,zoom,options?{...options}:undefined]);
    },
    fitPropertyAtlasBounds(bounds){
      if(!Array.isArray(bounds)||bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3]||bounds[0]<-180||bounds[2]>180||bounds[1]<-90||bounds[3]>90)return false;
      return queue('fitPropertyAtlasBounds',[[...bounds]]);
    },
    flyToPropertyAtlasFeature(feature){
      if(!Number.isFinite(feature?.longitude)||!Number.isFinite(feature?.latitude)||Math.abs(feature.longitude)>180||Math.abs(feature.latitude)>90)return false;
      return queue('flyToPropertyAtlasFeature',[{...feature}]);
    },
    pin(x,z,color){if([x,z].every(Number.isFinite))pin=[x,z,color];},
  };
  return {map,apply(renderer){
    if(!renderer||!camera||typeof renderer[camera.method]!=='function')return false;
    const next=camera,marker=pin;camera=null;pin=null;
    const result=renderer[next.method](...next.args);
    if(result===false){camera=next;pin=marker;return false;}
    if(marker)renderer.pin?.(...marker);return true;
  }};
}
