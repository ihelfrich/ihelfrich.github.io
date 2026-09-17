import {getPropertyLayer} from './property-layer-catalog.mjs';
import {PROPERTY_INFRASTRUCTURE_LAYERS} from './property-infrastructure-catalog.mjs';

const evidence=(id,group)=>({...getPropertyLayer(id),group,adapter:'evidence',...(id==='tif-districts'?{meaning:'Outlines show published district boundaries, not individual properties or confirmation of current incentives.'}:{})});
export const PROPERTY_MAP_LAYER_GROUPS=[
  {id:'infrastructure',label:'Utilities & infrastructure'},
  {id:'development',label:'Planning & development'},
  {id:'ownership',label:'Ownership evidence'},
];
export const PROPERTY_MAP_LAYERS=[
  evidence('water-materials','infrastructure'),
  ...PROPERTY_INFRASTRUCTURE_LAYERS.map(layer=>({...layer,group:'infrastructure',adapter:'infrastructure'})),
  ...['permits','zoning-petitions','tif-districts','tax-abatements','public-inventory'].map(id=>evidence(id,'development')),
  ...['ownership-signals','ownership-history'].map(id=>evidence(id,'ownership')),
];

/** Source polygons are restored where supplied. Other centroids remain points; no
 * pipe, footprint, height, or parcel relationship is synthesized from it. */
export function propertyRecordGeoJSON(record){
  if(!record||typeof record.id!=='string')return null;
  const supported=['Point','LineString','MultiLineString','Polygon','MultiPolygon'];
  const polygon=['tif-districts','tax-abatements'].includes(record.layerId)&&['Polygon','MultiPolygon'].includes(record.original?.geometry?.type);
  let geometry=polygon?record.original.geometry:record.geometry;
  if(!geometry||!supported.includes(geometry.type)){
    if(!Number.isFinite(record.longitude)||!Number.isFinite(record.latitude))return null;
    geometry={type:'Point',coordinates:[record.longitude,record.latitude]};
  }
  return {type:'Feature',id:record.id,geometry,properties:{record:polygon?{...record,geometryRole:'source-polygon-outline'}:record}};
}
export function mapLayerDetail(bounds){return bounds[2]-bounds[0]<=.06&&bounds[3]-bounds[1]<=.06?'properties':'areas';}
export function propertyFeatureBounds(record){
  const geometry=propertyRecordGeoJSON(record)?.geometry;
  const pending=[geometry?.coordinates],bounds=[Infinity,Infinity,-Infinity,-Infinity];let visited=0;
  while(pending.length&&visited++<20000){const value=pending.pop();if(!Array.isArray(value))continue;
    if(Number.isFinite(value[0])&&Number.isFinite(value[1])){bounds[0]=Math.min(bounds[0],value[0]);bounds[1]=Math.min(bounds[1],value[1]);bounds[2]=Math.max(bounds[2],value[0]);bounds[3]=Math.max(bounds[3],value[1]);}
    else pending.push(...value);
  }
  if(pending.length||!bounds.every(Number.isFinite))return null;
  const x=Math.max(.001,(bounds[2]-bounds[0])*.06),y=Math.max(.001,(bounds[3]-bounds[1])*.06);
  return [bounds[0]-x,bounds[1]-y,bounds[2]+x,bounds[3]+y];
}
