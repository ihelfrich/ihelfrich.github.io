import {query,uuid} from './common.mjs';
export const unscoredReceipt=row=>({eventId:row.event_id,receiptId:row.receipt_id,receipt:row.server_received_at,persisted:true,validity:row.reason,countsTowardResult:false,calibrationEligible:false});
export async function findUnscored(db,participantId,sessionId,eventId,digest){
 return query(db,'SELECT * FROM unscored_submissions WHERE participant_id=? AND session_id=? AND event_id=? AND payload_sha256=?',participantId,sessionId,eventId,digest).first();
}
export async function retainUnscored(db,participantId,sessionId,payload,digest,reason){
 await query(db,`INSERT INTO unscored_submissions (receipt_id,participant_id,session_id,presentation_id,event_id,payload_sha256,payload_json,reason,server_received_at) VALUES (?,?,?,?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(participant_id,session_id,event_id,payload_sha256) DO NOTHING`,uuid(),participantId,sessionId,payload.presentationId,payload.eventId,digest,JSON.stringify(payload),reason).run();
 return unscoredReceipt(await findUnscored(db,participantId,sessionId,payload.eventId,digest));
}
