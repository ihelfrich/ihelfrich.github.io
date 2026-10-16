# Deployment security and reliability review

Reviewed 2026-10-13. Read-only runtime review of `services/econ-response/worker.mjs`, actual server identity implementation `auth.mjs`, `session-models.mjs`, `assignments.mjs`, and browser identity/offline/session paths. Only this audit file was written. All execution used in-memory local SQLite, synthetic identities, and direct module calls; no production or Google network calls.

## Confirmed deployment blocker

### P1: Lost anonymous-link response strands the browser with a revoked credential

Locations: `services/econ-response/auth.mjs:44–55`; `src/scripts/econ-identity.mjs:6–9,20–22`; startup recovery in `src/scripts/econ-practice.mjs`.

Trigger: an anonymous user explicitly links history while signing in. The server commits the history transfer, revokes every anonymous credential, and disables the old participant. The browser loses the response before `setProfile(signed)` runs. A server failure between the committed link and credential delivery has the same shape.

The browser still stores `identityKind: anonymous` and the revoked token. `/profile` returns 401. `refresh()` sets `needsReauthentication` only for account profiles; it throws for this anonymous profile. Clicking sign-in again neither creates a replacement anonymous profile nor reaches Google: `ensureProfile()` sees an existing profile, then `/auth/challenge` returns 401. Reloading retains the same broken profile. Starting practice also reuses the invalid profile. With queued answers, the preceding flush can fail even earlier.

**Proven impact:** the normal browser UI cannot resume practice, sign in, or recover the linked session without out-of-band intervention such as selectively changing local storage. This is an availability/recovery defect, not a proven disclosure or permanent server-side data loss: the reproduction verifies that the session was correctly transferred. Do not recommend clearing all browser data; that can destroy unsent answers.

**Fix direction:** persist a recoverable sign-in transition and support invalid anonymous credentials after an ambiguous link outcome. Recovery must preserve the outbox and session and authenticate the actual destination account before flushing. Do not blindly bind queued submissions to whichever account signs in next. Add a lost-response regression with pending answers, reload, same-account recovery, and rejection of a different account. Simply widening the existing account branch is insufficient if it uses the old anonymous participant ID as `expectedParticipantId`.

### Executed reproduction

From the repository root, run the following. It uses real server migrations and identity/browser modules. The injected verifier replaces external Google validation solely to isolate the post-verification transaction; the existing JWT tests separately exercise verification. No credentials are printed.

```sh
timeout 30 node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createLocalDB} from './services/econ-response/local-db.mjs';
import {createChallenge,finishSignIn} from './services/econ-response/auth.mjs';
import worker,{CONSENT_VERSION} from './services/econ-response/worker.mjs';
import {setupIdentity} from './src/scripts/econ-identity.mjs';
const DB=createLocalDB();
for(const name of readdirSync('services/econ-response/migrations')
  .filter(x=>x.endsWith('.sql')).sort())
  DB.exec(readFileSync('services/econ-response/migrations/'+name,'utf8'));
const env={DB,GOOGLE_CLIENT_ID:'local-test'};
let profile=null;
async function request(path,data){
  const r=await worker.fetch(new Request('https://local.test'+path,{
    method:data?'POST':'GET',
    headers:{'Content-Type':'application/json',
      ...(profile?{Authorization:'Bearer '+profile.token}:{})},
    ...(data?{body:JSON.stringify(data)}:{})}),env);
  const b=await r.json();
  if(!r.ok){const e=new Error(b.error);e.status=r.status;throw e;}
  return b;
}
profile={...await request('/profiles',{
  accepted:true,consentVersion:CONSENT_VERSION})};
const session=await request('/sessions',{course:'ap-micro',mode:'practice'});
const p=await DB.prepare('SELECT * FROM participants WHERE id=?')
  .bind(profile.participantId).first();
const c=await createChallenge(env,p);
// Successful server commit; deliberately do not deliver signed to the browser.
const signed=await finishSignIn(env,p,{
  challengeId:c.challengeId,credential:'synthetic',accepted:true,
  consentVersion:CONSENT_VERSION,linkAnonymous:true},
  async()=>({subjectHash:'synthetic-subject',email:'synthetic@example.test'}));
assert.equal((await DB.prepare('SELECT participant_id FROM sessions WHERE id=?')
  .bind(session.sessionId).first()).participant_id,signed.participantId);
const nodes=new Map();
globalThis.document={getElementById(id){
  if(!nodes.has(id))nodes.set(id,{checked:true,handlers:{},
    addEventListener(k,f){this.handlers[k]=f;},closest(){return this;}});
  return nodes.get(id);
}};
let flushCalls=0;
const ui=setupIdentity({request,flush:async()=>{flushCalls++;},
  getProfile:()=>profile,setProfile:p=>profile=p,getSession:()=>session,
  setSession:()=>{},beginSession:async()=>{},ready:()=>{},show:()=>{},save:()=>{}});
await assert.rejects(ui.refresh(),e=>e.status===401);
assert.equal(profile.needsReauthentication,undefined);
await nodes.get('prepare-signin').handlers.click();
assert.equal(profile.identityKind,'anonymous');
assert.match(nodes.get('identity-error').textContent,/expired or is invalid/);
console.log(JSON.stringify({serverHistoryTransferred:true,refreshStatus:401,
  recoveryFlagSet:false,prepareSignInCreatesReplacement:false,
  challengeRejected:true,flushCalls}));
DB.close();
JS
```

Observed output:

```json
{"serverHistoryTransferred":true,"refreshStatus":401,"recoveryFlagSet":false,"prepareSignInCreatesReplacement":false,"challengeRejected":true,"flushCalls":1}
```

## Existing coverage actually executed

These commands exited successfully:

```sh
timeout 60 node --test tests/unit/econ-auth.test.mjs tests/unit/econ-response.test.mjs tests/unit/econ-outbox.test.mjs tests/unit/econ-session-actions.test.mjs tests/unit/econ-model-release.test.mjs
timeout 60 node --test tests/unit/econ-unit-models.test.mjs
```

Existing tests cover JWT claim/signature rejection; nonce replay; anonymous linking and nonlinking; credential revocation; same-account recovery; assignment membership, opening windows, idempotent starts and concurrent attempt limits; response ownership; duplicate receipts/conflicts; late/post-completion retention; concurrent response writes; linking during answer insertion; outbox per-event preservation; matching acknowledgements; malformed legacy queue preservation; navigation locking; and unit-model scope errors. Model-release UI tests pass, but are not a full distributed database certification. No test was changed or added.

## Other reviewed paths and limits

No additional authorization bypass or destructive replay defect was proven in this bounded review. Session reads scope ownership, answer/unscored inserts recheck ownership at write time, assignment slot uniqueness serializes competing attempt claims, and session/model pinning is included in the creation batch. Model pin consistency uses a transactional release-map comparison rather than a stale application-only check. These observations are code-level evidence, not a claim that every deployment failure is excluded.

Cross-tab profile changes remain a risk area: the outbox is global while each tab keeps an in-memory profile. Existing tests establish per-event storage preservation, not every identity-switch recovery sequence. This was not promoted to a second proven blocker. Live Google key retrieval, Cloudflare D1 behavior, production configuration, browser storage eviction and actual network delivery were outside the review; no production readiness claim is made for those untested surfaces.

## Reviewed source fingerprints

- `services/econ-response/worker.mjs`: `5accba01dc24a92fd0092aafece42182588378bdf8041347f594409e25ca2aac`
- `services/econ-response/auth.mjs`: `b2776a2e43cc82b55f5d706e744f561a3fe8a540d7426b5c4fdb4e52bbe5476d`
- `services/econ-response/session-models.mjs`: `1e72f64dce362cd482f94f540ebdec28086ba92acd98ac37be880985d7bcdb56`
- `services/econ-response/assignments.mjs`: `7d42ba03f33cf2c0925e7cae44463a468d72f0d3daba7e87203b982cde293bff`
- `src/scripts/econ-practice.mjs`: `ffee6639ac270a32d3cba2f821fcf50e1133c38c9c591486c15acf441999b9be`
- `src/scripts/econ-identity.mjs`: `760b06f21707cfe5a8818915e1efc252552028fa487989aa167eba1b93e8ffa0`
- `src/scripts/econ-outbox.mjs`: `d2dc828393d55ada23f38db851d0600caa66989090868aa1cc7e3ac02edef2b0`
