import {createPropertyActivityData,aggregatePropertyActivities} from './property-activity-data.mjs';
import {createPropertyPlanningData} from './property-planning-data.mjs';
import {createPropertyUtilitiesData} from './property-utilities-data.mjs';
import {createPropertyHistoryData} from './property-history-data.mjs';
import {getPropertyLayer} from './property-layer-catalog.mjs';

export const PROPERTY_LENSES=Object.freeze({
  ownership:{label:'Ownership',question:'Who owns this area?',intro:'Find recorded names, follow observed changes, and examine documented company relationships.',layers:['ownership-signals','ownership-history'],defaults:['ownership-signals','ownership-history']},
  development:{label:'Development',question:'What is changing here?',intro:'Follow permit records, public planning documents and recorded incentives in one place.',layers:['planning-documents','planning-notices','permits','zoning-petitions','tif-districts','tax-abatements','public-inventory'],defaults:['planning-documents','planning-notices']},
  utilities:{label:'Utilities',question:'What serves this place?',intro:'Inspect City water-service materials and open official broadband, provider and infrastructure resources.',layers:['water-materials'],defaults:['water-materials']},
});
const validDay=d=>d==null||typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function propertyPeriod(period,from,to,now=new Date()){
  if(period==='all')return {fromDate:null,toDate:null};
  if(period==='30'||period==='90'){const end=new Date(now),start=new Date(now);start.setUTCDate(start.getUTCDate()-Number(period)+1);return {fromDate:start.toISOString().slice(0,10),toDate:end.toISOString().slice(0,10)};}
  const fromDate=from||null,toDate=to||null;
  if(period!=='custom'||!validDay(fromDate)||!validDay(toDate)||fromDate&&toDate&&fromDate>toDate)throw new RangeError('Choose a valid calendar date range.');
  return {fromDate,toDate};
}
export function createPropertyWorkspaceData(options={}){
  const activity=options.activity||createPropertyActivityData(options),planning=options.planning||createPropertyPlanningData(options),
    utilities=options.utilities||createPropertyUtilitiesData(options),history=options.history||createPropertyHistoryData(options);
  const groups=[{adapter:activity,ids:['ownership-signals','permits','zoning-petitions','planning-notices','public-inventory']},
    {adapter:planning,ids:['planning-documents','tif-districts','tax-abatements']},{adapter:utilities,ids:['water-materials']},{adapter:history,ids:['ownership-history']}];
  async function query(options){
    const jobs=groups.map(g=>({...g,selected:options.layers.filter(id=>g.ids.includes(id))})).filter(g=>g.selected.length);
    const results=await Promise.allSettled(jobs.map(g=>g.adapter.query({...options,layers:g.selected})));
    if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
    const records=[],layers=[],points=[],health=[];let partial=false;
    results.forEach((result,index)=>{
      if(result.status==='rejected'){partial=true;for(const id of jobs[index].selected)layers.push({id,label:getPropertyLayer(id)?.label,status:'unavailable',count:0,mappedCount:0,unmappedCount:0,partial:true,coverage:getPropertyLayer(id)?.coverage,error:result.reason?.message||'Source unavailable'});return;}
      const r=result.value;records.push(...r.records);points.push(...r.features);layers.push(...r.layers);health.push(...(r.health||[]));partial||=Boolean(r.partial);
    });
    // Preserve each adapter's status/category-aware cells. Only coarsen when
    // combining sources would exceed the map's dedicated activity budget.
    const features=points.length<=2000?points:aggregatePropertyActivities(points,{level:'areas'});
    return {records,layers,features,health,partial,counts:{records:layers.reduce((n,l)=>n+(l.count||0),0)}};
  }
  return {query,health:history.health,entities:history.entities,dispose(){for(const g of groups)g.adapter.dispose?.();}};
}
