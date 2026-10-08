const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a,s)=>[a[0]*s,a[1]*s,a[2]*s];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=a=>scale(a,1/norm(a));

/** Perspective camera shared by volume ray casting and physical-plane picking. */
export function createTankCamera({width,height,depth}){
  for(const [name,value] of Object.entries({width,height,depth}))if(!Number.isFinite(value)||value<=0)throw new RangeError(`${name} must be positive and finite`);
  const dims=[width/width,height/width,depth/width];
  const target=[0,0,0],worldUp=[0,1,0],fov=Math.PI/4;
  const homePose={azimuth:.68,elevation:.38,distance:1.8};
  let azimuth=homePose.azimuth,elevation=homePose.elevation,distance=homePose.distance;
  const pose=()=>{
    const ce=Math.cos(elevation),position=add(target,[distance*ce*Math.cos(azimuth),distance*Math.sin(elevation),distance*ce*Math.sin(azimuth)]);
    const forward=unit(sub(target,position)),right=unit(cross(forward,worldUp)),up=unit(cross(right,forward));
    return {position,forward,right,up};
  };
  const physicalToWorld=({x,y,z})=>[x/width-.5,dims[1]/2-y/width,z/width-dims[2]/2];
  const worldToPhysical=p=>({x:(p[0]+.5)*width,y:(dims[1]/2-p[1])*width,z:(p[2]+dims[2]/2)*width});
  const ray=(nx,ny,aspect)=>{
    if(!Number.isFinite(nx)||!Number.isFinite(ny)||!Number.isFinite(aspect)||aspect<=0)throw new RangeError('Ray coordinates and aspect must be finite; aspect must be positive');
    const b=pose();return {origin:b.position,direction:unit(add(b.forward,add(scale(b.right,nx*Math.tan(fov/2)*aspect),scale(b.up,ny*Math.tan(fov/2)))))};
  };
  const project=(point,aspect)=>{
    if(!Number.isFinite(aspect)||aspect<=0)throw new RangeError('aspect must be positive and finite');
    const p=physicalToWorld(point),b=pose(),q=sub(p,b.position),z=dot(q,b.forward),h=Math.tan(fov/2);
    if(z<=0)return {x:NaN,y:NaN,depth:z};
    return {x:dot(q,b.right)/(z*h*aspect),y:dot(q,b.up)/(z*h),depth:z};
  };
  const rectInfo=rect=>{
    if(!rect||![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)throw new RangeError('A finite, nonempty canvas rectangle is required');
  };
  return {
    home(){azimuth=homePose.azimuth;elevation=homePose.elevation;distance=homePose.distance;},
    orbit(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy))return;azimuth+=dx*.006;elevation=clamp(elevation+dy*.006,.025,Math.PI/2-.025);},
    zoom(factor){if(!Number.isFinite(factor)||factor<=0)return;distance=clamp(distance/factor,.9,8);},
    getCamera(){const b=pose();return {azimuth,elevation,distance,position:b.position.slice(),target:target.slice(),forward:b.forward,right:b.right,up:b.up,dimensions:dims.slice(),fov};},
    getFrame(aspect){const b=pose();return {...b,dimensions:dims.slice(),tanHalfFov:Math.tan(fov/2),aspect};},
    ray,
    project(point,aspect){return project(point,aspect);},
    projectToPixel(point,rect){rectInfo(rect);const q=project(point,rect.width/rect.height);return {x:rect.left+(q.x+1)*rect.width/2,y:rect.top+(1-q.y)*rect.height/2,depth:q.depth};},
    pick(clientX,clientY,rect,planeFraction){
      rectInfo(rect);
      if(!Number.isFinite(clientX)||!Number.isFinite(clientY)||!Number.isFinite(planeFraction)||planeFraction<0||planeFraction>1)return null;
      if(clientX<rect.left||clientX>rect.left+rect.width||clientY<rect.top||clientY>rect.top+rect.height)return null;
      const nx=2*(clientX-rect.left)/rect.width-1,ny=1-2*(clientY-rect.top)/rect.height;
      const {origin,direction}=ray(nx,ny,rect.width/rect.height);
      const planeZ=(planeFraction-.5)*dims[2];
      if(Math.abs(direction[2])<1e-12)return null;
      const t=(planeZ-origin[2])/direction[2];if(t<0)return null;
      const p=add(origin,scale(direction,t));
      const eps=1e-12;
      if(p[0]<-.5-eps||p[0]>.5+eps||p[1]<-dims[1]/2-eps||p[1]>dims[1]/2+eps)return null;
      const physical=worldToPhysical([clamp(p[0],-.5,.5),clamp(p[1],-dims[1]/2,dims[1]/2),planeZ]);
      return physical;
    }
  };
}
