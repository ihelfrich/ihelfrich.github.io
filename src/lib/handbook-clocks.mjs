import releases from '../../public/handbook/code/data/gdp-release-ledger.json' with {type:'json'};
import origins from '../../public/handbook/code/data/clock-origins.json' with {type:'json'};
export {releases,origins};
export function clockAudit(originId,delay,mutate){
  if(!Number.isInteger(originId)||originId<0||originId>=origins.length||![0,60,3600].includes(delay)||typeof mutate!=='boolean')throw new RangeError('Use a declared origin, collection delay and boolean mutation.');
  const origin=origins[originId].origin_utc,cut=Date.parse(origin);
  const rows=releases.map(r=>{
    const availability=Date.parse(r.release_utc)+delay*1000;
    const eligible=availability<=cut;
    return {...r,availability:new Date(availability).toISOString().replace('.000Z','Z'),eligible,
      changed:mutate&&!eligible,value:r.value_percent+(mutate&&!eligible?10:0)};
  });
  const eligible=rows.filter(r=>r.eligible),selected=eligible.at(-1)??null;
  return {originId,origin,delay,mutate,rows,selected,stage:selected?.stage??0,
    growth:selected?.value??null,eligibleRows:eligible.length,
    latestValue:rows.at(-1).value,originalLatest:releases.at(-1).value_percent,
    futureMutationSame:!selected||selected.value===selected.value_percent};
}
