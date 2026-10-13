import {query,requireValue} from './common.mjs';
export async function responseWindow(db,cursor='',participantId,table='responses'){
 requireValue(['responses','unscored_submissions','hint_events'].includes(table),'Invalid ledger.');
 requireValue(!(table==='hint_events'&&participantId),'Hint owner windows require a session join.');
 const match=/^v1:(\d{1,16}):(\d{1,16})$/.exec(cursor);
 requireValue(match||cursor===''||/^\d{1,16}$/.test(cursor),'Invalid response cursor.');
 const after=Number(match?match[1]:cursor||0);
 const until=match?Number(match[2]):(await query(db,`SELECT COALESCE(MAX(ledger_sequence),0) AS last FROM ${table}${participantId?' WHERE participant_id=?':''}`,...(participantId?[participantId]:[])).first()).last;
 requireValue(Number.isSafeInteger(after)&&Number.isSafeInteger(until)&&after>=0&&until>=0,'Invalid response cursor.');
 requireValue(!match||after<=until,'Invalid response cursor.');
 return {after,until,next:sequence=>`v1:${sequence}:${until}`};
}
