export const iso=()=>new Date().toISOString();
export const uuid=()=>crypto.randomUUID();
export const secret=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
export const requireValue=(condition,message,status=400)=>{if(!condition)throw new HttpError(status,message);};
export const query=(db,sql,...args)=>db.prepare(sql).bind(...args);
export const all=async(db,sql,...args)=>(await query(db,sql,...args).all()).results;
export const CONSENT_VERSION='2026-10-12-v1';
