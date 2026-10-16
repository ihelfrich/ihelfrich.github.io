// One navigation operation at a time; rejected operations always release the lock.
export function createSessionActions({isBusy,setBusy,onError}){
 return async function run(action){
  if(isBusy())return false;
  setBusy(true);
  try{await action();return true;}
  catch(error){onError(error);return false;}
  finally{setBusy(false);}
 };
}
// A delayed hint belongs only to the presentation on which it was requested.
export async function loadCurrentHint({presentationId,request,isCurrent,show,onError}){
 try{const result=await request();if(isCurrent(presentationId))show(result.hint);}
 catch(error){if(isCurrent(presentationId))onError(error);}
}
