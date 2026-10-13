import {requireValue} from './common.mjs';
export function pageCursor(value=''){
 requireValue(typeof value==='string'&&(value===''||/^[a-f0-9-]{36}$/.test(value)),'Invalid list cursor.');return value;
}
export function listPage(rows,key){const page=rows.slice(0,100);return {[key]:page,hasMore:rows.length>100,nextCursor:page.at(-1)?.id??null};}
