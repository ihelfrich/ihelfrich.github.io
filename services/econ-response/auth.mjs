import {createRemoteJWKSet,jwtVerify} from 'jose';
import {iso,uuid,secret,hash,query,requireValue,HttpError,CONSENT_VERSION} from './common.mjs';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export async function verifyGoogleToken(token,env,nonce,keys=googleKeys){
 requireValue(typeof token==='string'&&token.length<16000,'Invalid sign-in token.');
 let payload;try{({payload}=await jwtVerify(token,keys,{issuer:['https://accounts.google.com','accounts.google.com'],audience:env.GOOGLE_CLIENT_ID,algorithms:['RS256'],maxTokenAge:'15 minutes'}));}catch{throw new HttpError(401,'Google sign-in could not be verified. Please try again.');}
 requireValue(typeof payload.sub==='string'&&payload.sub.length>0&&payload.nonce===nonce&&payload.email_verified===true&&typeof payload.email==='string','Sign-in claims are incomplete or do not match this browser.',401);
 return {subjectHash:await hash(`https://accounts.google.com:${payload.sub}`),email:payload.email};
}
export async function issueCredential(env,id,identityKind){
 const token=secret(),at=iso(),expiresAt=new Date(Date.now()+(identityKind==='account'?12*3600000:180*86400000)).toISOString();
 await query(env.DB,'INSERT INTO credentials (token_hash,participant_id,created_at,expires_at) VALUES (?,?,?,?)',await hash(token),id,at,expiresAt).run();return {token,expiresAt};
}
export function bearer(request){return request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];}
export async function participant(request,env){
 const token=bearer(request);requireValue(token,'Sign in or start an anonymous profile.',401);
 const p=await query(env.DB,`SELECT p.* FROM participants p JOIN credentials c ON c.participant_id=p.id WHERE c.token_hash=? AND c.revoked_at IS NULL AND c.expires_at>? AND p.disabled_at IS NULL`,await hash(token),iso()).first();
 requireValue(p,'Your profile credential has expired or is invalid. Sign in again.',401);return p;
}
export function isInstructor(p,env){return p.identity_kind==='account'&&(env.INSTRUCTOR_SUBJECT_HASHES??'').split(',').filter(Boolean).includes(p.identity_subject_hash);}
export async function requireInstructor(request,env){
 // Bootstrap token is only enabled by an explicit local-development setting.
 if(env.ALLOW_BOOTSTRAP_ADMIN==='true'&&env.ADMIN_TOKEN&&request.headers.get('Authorization')===`Bearer ${env.ADMIN_TOKEN}`)return {id:'local-bootstrap'};
 const p=await participant(request,env);requireValue(isInstructor(p,env),'Instructor access required.',403);return p;
}
export async function createChallenge(env,p){
 requireValue(env.GOOGLE_CLIENT_ID,'Sign-in has not been configured.',503);
 const id=uuid(),nonce=secret(),at=iso();await query(env.DB,'INSERT INTO auth_challenges (id,participant_id,nonce,created_at,expires_at) VALUES (?,?,?,?,?)',id,p.id,nonce,at,new Date(Date.now()+10*60000).toISOString()).run();return {challengeId:id,nonce,clientId:env.GOOGLE_CLIENT_ID};
}
export async function finishSignIn(env,p,b,verify=verifyGoogleToken){
 requireValue(b.accepted===true&&b.consentVersion===CONSENT_VERSION,'Accept the current response-collection notice.');
 requireValue(typeof b.linkAnonymous==='boolean','Choose whether to link this browser’s anonymous history.');
 const challenge=await query(env.DB,'SELECT * FROM auth_challenges WHERE id=? AND participant_id=? AND consumed_at IS NULL AND expires_at>?',b.challengeId,p.id,iso()).first();requireValue(challenge,'Sign-in challenge expired or already used.',401);
 const identity=await verify(b.credential,env,challenge.nonce);
 const consumed=await query(env.DB,'UPDATE auth_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL RETURNING id',iso(),challenge.id).first();requireValue(consumed,'Sign-in challenge already used.',409);
 let account=await query(env.DB,'SELECT * FROM participants WHERE identity_subject_hash=? AND disabled_at IS NULL',identity.subjectHash).first();
 if(b.expectedParticipantId!==undefined)requireValue(typeof b.expectedParticipantId==='string'&&account?.id===b.expectedParticipantId,'Sign in with the same account to recover these queued answers.',409);
 if(!account){
  const id=uuid(),at=iso();
  await query(env.DB,'INSERT INTO participants (id,created_at,identity_kind,identity_subject_hash,consent_version,consent_at,verified_email) VALUES (?,?,?,?,?,?,?) ON CONFLICT(identity_subject_hash) DO NOTHING',id,at,'account',identity.subjectHash,CONSENT_VERSION,at,identity.email).run();
  account=await query(env.DB,'SELECT * FROM participants WHERE identity_subject_hash=? AND disabled_at IS NULL',identity.subjectHash).first();requireValue(account,'This account is unavailable.',403);
 }
 requireValue(p.identity_kind==='anonymous'||p.id===account.id,'Sign out before switching to a different account.',409);
 if(b.linkAnonymous&&p.identity_kind==='anonymous'){
  await env.DB.batch([
   query(env.DB,'UPDATE responses SET participant_id=? WHERE participant_id=?',account.id,p.id),
   query(env.DB,'UPDATE sessions SET participant_id=? WHERE participant_id=?',account.id,p.id),
   query(env.DB,'UPDATE credentials SET revoked_at=? WHERE participant_id=?',iso(),p.id),
   query(env.DB,'UPDATE participants SET disabled_at=? WHERE id=?',iso(),p.id),
   query(env.DB,'INSERT INTO audit_log VALUES (?,?,?,?,?,?)',uuid(),iso(),account.id,'explicit-anonymous-link',p.id,JSON.stringify({destination:account.id}))
  ]);
 }
 await query(env.DB,'UPDATE participants SET verified_email=?,consent_version=?,consent_at=? WHERE id=?',identity.email,CONSENT_VERSION,iso(),account.id).run();
 return {participantId:account.id,identityKind:'account',email:identity.email,isInstructor:isInstructor(account,env),...await issueCredential(env,account.id,'account')};
}
