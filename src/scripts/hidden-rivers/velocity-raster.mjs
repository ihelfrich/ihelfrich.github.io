// Draw every valid source node, including coastal nodes next to missing data.
// Animation still uses the stricter four-wet-corner velocity sampler.
export function velocityRaster(field,color){
  const [,height,width]=field.shape,plane=width*height,data=new Uint8ClampedArray(plane*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,u=field.values[i],v=field.values[2*plane+i];
    if(u===-32768||v===-32768)continue;
    const edge=Math.min(x,y,width-1-x,height-1-y),alpha=Math.max(1,Math.round(120*Math.min(1,(edge+1)/6)));
    data.set([...color(Math.hypot(u,v)*.001),alpha],4*((height-1-y)*width+x));
  }
  return {data,width,height,bounds:[field.lon0-field.dlon/2,field.lat0-field.dlat/2,field.lon0+(width-.5)*field.dlon,field.lat0+(height-.5)*field.dlat]};
}
