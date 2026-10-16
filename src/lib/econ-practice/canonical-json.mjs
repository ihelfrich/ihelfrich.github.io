// Stable JSON for artifact identity. Reject values that JSON would silently drop/coerce.
export function canonicalJSON(value){
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Artifact contains a non-finite number.');return JSON.stringify(value);}
 if(Array.isArray(value)){
  for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))throw new Error('Artifact contains a sparse array.');
  return `[${value.map(canonicalJSON).join(',')}]`;
 }
 if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
 throw new Error('Artifact contains an unsupported JSON value.');
}
