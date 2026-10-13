const PREFIX='econ-answer-event-v2:',LEGACY='econ-answer-outbox-v1';
export function createOutbox(storage){
 function enqueue(event){
  if(!event?.payload?.eventId||!event.sessionId)throw new Error('Invalid pending answer.');
  const key=PREFIX+event.payload.eventId,encoded=JSON.stringify(event),old=storage.getItem(key);
  if(old!==null&&old!==encoded)throw new Error('Pending answer ID conflict. Existing answer preserved.');
  storage.setItem(key,encoded);
 }
 function migrate(){
  const raw=storage.getItem(LEGACY);if(raw===null)return;
  let events;try{events=JSON.parse(raw);}catch{throw new Error('The previous answer queue could not be read. It has been preserved.');}
  if(!Array.isArray(events))throw new Error('The previous answer queue is invalid. It has been preserved.');
  for(const event of events)enqueue(event);
  // Remove only the exact legacy snapshot migrated, never a concurrent replacement.
  if(storage.getItem(LEGACY)===raw)storage.removeItem(LEGACY);
 }
 function list(){
  migrate();const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(PREFIX))keys.push(key);}
  return keys.sort().flatMap(key=>{const raw=storage.getItem(key);if(raw===null)return [];try{return [JSON.parse(raw)];}catch{throw new Error('A pending answer could not be read. It has been preserved.');}}).sort((a,b)=>String(a.payload.submittedAt).localeCompare(String(b.payload.submittedAt))||a.payload.eventId.localeCompare(b.payload.eventId));
 }
 function acknowledge(event,receipt){
  if(receipt?.persisted!==true||receipt.eventId!==event.payload.eventId)throw new Error('No matching storage receipt. Your answer remains queued.');
  const key=PREFIX+event.payload.eventId,raw=storage.getItem(key);
  if(raw!==null&&raw!==JSON.stringify(event))throw new Error('Pending answer changed. It has been preserved.');
  storage.removeItem(key);
 }
 return {enqueue,list,acknowledge};
}
