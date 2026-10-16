// Lists use stable IDs. New records inserted during retrieval appear on refresh.
export async function readAllPages(request,path,key){
 const records=[],seen=new Set();let cursor='';
 for(;;){const page=await request(`${path}?after=${encodeURIComponent(cursor)}`);
  if(!Array.isArray(page[key]))throw new Error('The service returned an invalid list.');
  records.push(...page[key]);if(!page.hasMore)return records;
  if(!page.nextCursor||seen.has(page.nextCursor))throw new Error('The list cursor did not advance. Reload to retry.');
  seen.add(page.nextCursor);cursor=page.nextCursor;
 }
}
