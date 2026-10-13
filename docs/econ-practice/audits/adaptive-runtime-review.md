# Adaptive runtime review

Reviewed 2026-10-13. Read-only audit; no runtime, tests, calibration releases, or activation changes. Scope: live service delivery, response scoring, immutable model pins, posterior replay, exposure and coverage rules, stopping, and long histories. Findings below distinguish a reproduced correctness defect from incomplete adaptive-testing features and scaling risks.

## P1: Receipt ordering can erase valid first-presentation assessment evidence

`services/econ-response/worker.mjs:208` assigns first-family exposure at presentation. Lines 175–177 persist `calibration_eligible` from that exposure and response validity. However, `services/econ-response/history.mjs:22–26` replays in receipt ledger order and `src/lib/econ-practice/adaptive.mjs:27–30` adds a second first-exposure check based on previously received answers. These definitions disagree.

Concrete reachable sequence: assessment A presents family F first; another concurrent practice session presents F later and answers it; A's response then arrives. A is durably calibration eligible, but replay encounters practice first and suppresses A's posterior update. The assessment need not have received feedback before answering: its answer can already be queued while the practice receipt arrives first. Thus changing receipt order alone changes a session estimate.

Executed reproduction through `replayHistory`, supplying the same two persisted rows with only their ledger ordering changed:

```
assessment-first: assessment psychometricEligible=true; posterior dimensions=1
practice-first:   assessment psychometricEligible=false; posterior dimensions=0
```

Minimal fix: distinguish persisted presentation eligibility from locally inferred exposure. Replay should honor the durable first-presentation and validity decision, with explicit validation of its provenance, rather than recomputing that decision from answer arrival order. Preserve conservative inference for local callers lacking durable presentation evidence. Add a regression with two sessions, same family, reversed receipt order and identical assessment posterior. Do not simply remove all first-exposure protection.

## P2: Precision stopping exists only as an unused helper

`src/lib/econ-practice/irt.mjs:48–52` implements minimum length, distinct-family, calibration, SD, boundary-mass, and coverage checks. A source search over `src` and `services` found its definition and no callers. The actual next-item route, `services/econ-response/worker.mjs:203–206`, stops at `target_count` or bank exhaustion. Self-directed assessment target is at most 36 (`worker.mjs:140`); assignments have an explicit 6–48 item count (`assignments.mjs:12`).

This is a feature gap, not evidence that current reports falsely claim precision: delivery is fixed-length content-adaptive sampling. Approving models will not activate precision stopping automatically. Minimal fix if precision termination is intended: add an explicit session-pinned stopping policy, call it in the server delivery path, and persist the terminal reason. Since posteriors are unit-specific, define required unit-wise precision and eligible response counts; do not pass a pooled course SD or raw presentation count to the helper. Keep fixed-length assignments fixed unless their author explicitly selects an adaptive policy. Test maximum length, uncovered units, provisional dimensions, insufficient eligible responses, and boundary concentration.

## P2: Lifetime replay grows without a request-work bound

`worker.mjs:24` reconstructs the entire participant state. Every new item invokes it (`:206`), as does a session report (`:153`). `history.mjs:18–31` correctly pages by 500 and captures a high-water mark, but it retains every replayed answer and performs all pages within one request. It includes other courses and old occasions even when only one course/session is requested.

Executed mock-database replay of 50,001 valid first-attempt rows: 50,001 retained history entries and 101 page queries, plus the initial high-water query. Local pure replay took approximately 71 ms; this excludes database/network latency and is not a production capacity benchmark. The existing 10,005-row test also passed. There is no silent 10,000-row truncation. The concern is monotonically increasing request cost and eventual platform budget failure, not an observed deployed outage.

Minimal fix: retain the immutable event ledger but maintain reconstructible, versioned summaries/checkpoints for lifetime exposure/topic aggregates and session posteriors, then replay only the delta to a captured cursor. Alternatively scope retrieval to the relevant course and occasion with separately indexed lifetime exposure. Verify exact equivalence with full replay, account linking, delayed receipts and historical parameter snapshots before replacing replay. Never truncate history to improve latency.

## Coverage and exposure limits

`adaptive.mjs:75` enforces one visit to each available unit for an unfiltered assessment. Thereafter unit deficits are a soft utility term (`:82–88`); they are not guaranteed final blueprint counts. Within-unit topic coverage is not a hard constraint. This is consistent with its current content-balanced sampling description but insufficient for a claim of guaranteed topic or weight-proportional coverage. If such a blueprint is required, pin integer per-unit/topic targets and reserve remaining slots before information sampling.

Fresh families are preferred after the uncovered-unit constraint (`:75–80`). Consequently an exposed question from an uncovered unit can outrank a fresh question from an already covered unit. When all eligible families were previously exposed, delivery deliberately continues with nonmeasurement evidence. The returned selection exposure status distinguishes this case; eligibility excludes these responses. There is no population-wide item exposure cap. These are explicit design limits, not additional reproduced defects.

## Checks that held

Scoring keeps multipart rubric credit out of dichotomous IRT updates; choices require a valid integer index; numeric responses require finite nonblank input. Hint-assisted and repeated family responses do not become ordinary independent measurement evidence. Rapid, late and post-completion handling is differentiated at storage/replay. Session posteriors are separated by course, unit and occasion; incompatible model changes fail. Session pins use immutable package IDs and archived bank versions, parameter snapshots are validated during replay, and session creation atomically compares its release snapshot. Existing tests for these paths passed.

Executed five targeted test files (history, occasions, unit models, scoring, practice): 33/34 passed. The one failure was the content generator-index heuristic matching legitimate mathematical prose in `mathematical-economics-u6-01` (`01`), not an adaptive runtime assertion. Reported it to the parent; no test was weakened. Registry and calibration suites: 22/22 passed. Overall selected suites: 55/56 passed. No claim is made about production latency, empirical item calibration quality, model fit, fairness, or test-retest validity from these code checks.

## Receipt-order reproduction

Run from the repository root with Node; this uses the production replay function and a read-only database stub.

```js
import {replayHistory} from './services/econ-response/history.mjs';
import {buildBank} from './src/lib/econ-practice/index.mjs';
const q=buildBank().find(q=>q.format==='numeric');
const base={item_snapshot_json:JSON.stringify(q),measurement_parameters_json:null,
 model_version:'author-seeded-rasch-v1',raw_answer_json:JSON.stringify(q.answer),
 server_received_at:'2026-10-12T00:00:00Z',hints_used:0,validity:'valid'};
for(const order of ['assessment-first','practice-first']){
 const events=[{...base,mode:'assessment',event_id:'a',session_id:'assessment',calibration_eligible:1},
 {...base,mode:'practice',event_id:'p',session_id:'practice',calibration_eligible:0}];
 if(order==='practice-first')events.reverse();
 events.forEach((r,i)=>r.ledger_sequence=i+1);
 const DB={prepare(){return {bind(){return {
 first:async()=>({last:2}),all:async()=>({results:events})};}};}};
 const s=await replayHistory({DB},'owner');
 console.log(order,s.history.find(h=>h.eventId==='a').psychometricEligible,Object.keys(s.posteriors).length);
}
```
