const registry=new Map();
export function replaceFieldVariantHints(course,expansions){
 registry.set(course,new Map(expansions.map(e=>[e.baseId,e.variants.map(q=>q.hint)])));
}
export function fieldVariantHintFor(item){
 if(!Number.isInteger(item.variant)||item.variant<2)return null;
 return registry.get(item.course)?.get(item.family)?.[item.variant-2]??null;
}
