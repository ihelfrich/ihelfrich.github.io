# Market Design draft review

Author-reviewed draft, 60 original constructed questions in six units of ten. Question and outline metadata remain draft; no runtime activation, commits or shared-log edits. Questions use the existing schema with standalone contexts, full-string distractor arrays, explanations, method hints, source URLs and constructed-scenario labels.

## Verified sources and curriculum scope

Verified October 13, 2026:

- MIT Fall 2026 economics catalog, the curriculum-plan source for 14.125: https://student.mit.edu/catalog/m14a.html.
- MIT Matching Theory lecture slides, Mihai Manea, 2016: https://ocw.mit.edu/courses/14-16-strategy-and-information-spring-2016/53dbe8d681978367f9c04182aa3c9b97_MIT14_16S16_Matching.pdf. Official lecture material covers matching institutions and theory.
- Stanford ECON 136 official course description: https://publicpolicy.stanford.edu/courses/market-design/1. Provides matching, auction and platform coverage; the page describes its 2023 offering rather than a claimed current enrollment schedule.
- Stanford Market Design 285, 2012 syllabus: https://web.stanford.edu/~niederle/marketdesign2012.htm. Verified topics include stable matching, couples, generalized matching, school choice, kidney exchange, congestion and unraveling.

MIT and Stanford are separate R1 source institutions. Course descriptions guide coverage; none of the hypothetical examples or numerical questions are copied assessments or institutional empirical findings. Summaries here are brief, and no institutional endorsement is implied.

Inspected existing game-theory auction items. Avoided repeating independent uniform first-price bidding, single-object truthful bidding, expected second-price revenue, reserve calculations and winner’s-curse exercises. This auction unit instead treats package feasibility, externality payments, multiple seats, exposure, demand reduction, budget constraints, procurement and transfer balance. Matching-with-contracts items focus on choice functions and feasible contractual allocations rather than repeating the separate contract-theory screening course.

Prerequisites and advanced extensions are explicit in the outline. The course includes one prediction-contract payoff question and implementation evidence but does not claim comprehensive financial-market microstructure coverage. Kidney-exchange compatibility and execution rules are supplied as mathematical assumptions; no clinical advice or actual patient data are involved.

## Executed verification and correction

Enumerated every feasible complete and partial matching in the two-worker/two-firm example and found exactly the two stated stable matchings. Independently implemented the three-student DA rejection sequence, yielding 1–B,2–A,3–C. Enumerated the alternating graph cycles for the housing TTC example, finding the 1/2 trade and 3’s self-cycle.

Enumerated all disjoint assignments of the two licenses, including leaving items unallocated: optimal total value is 13, with A to bidder 2 and B to bidder 3. Removing each winner gives pivot payments 6 and 5. Enumerated all subsets of the three exchange two-cycles: cardinality optimum is the disjoint end cycles with four transplants, while score optimum is the middle cycle with score 15 and two transplants. Independently recomputed expected successful transplants as 2187/1000, review backlog 40, delayed net match value 9, prediction-contract expected net payoff 1/10, procurement profit 2 and stipulated mechanism deficit 6.

During self-review, changed 1.9 from asking an apparent attainable maximum proposal count to asking the number of possible worker-firm proposal pairs. The answer 12 is a simple counting upper bound and is not asserted to be a tight attainable DA run length. This avoids conflating a finite bound with a sharp worst-case result.

Parent review also identified that “at least 20” was logically true whenever “at least 40” held in 6.2. The revised prompt explicitly asks for the strongest guaranteed lower bound, making 40 the uniquely correct listed bound while preserving the possibility of unused processing capacity.

Final saved-file validation checks 60 unique IDs/topics, six units of ten, exactly three distractors and four distinct choices for every question, nonempty required text and source fields, draft/constructed labels, and exact outline-topic alignment. No rendered-page check was performed within this content-only task.

## Item-by-item self-review

| Topic | Check performed |
|---|---|
| 1.1 | Both unmatched pairs mutually prefer deviation; key names both blockers. |
| 1.2 | Assigned job below unmatched violates IR independently of capacities. |
| 1.3 | Responsive preferences and acceptable vacancy make (c,H) block. |
| 1.4 | Enumerated partial and complete matchings; exactly two stable outcomes. |
| 1.5 | Worker first proposals go to distinct firms; a–X,b–Y. |
| 1.6 | Firm first proposals go to distinct workers; a–Y,b–X. |
| 1.7 | Proposer-optimal result explicitly restricted to stable matchings and the strict one-to-one domain. |
| 1.8 | Blocking uses ordinal comparisons; no interpersonal utility sum inferred. |
| 1.9 | Corrected to simple pair-count bound 4×3=12; no claim of tightness. |
| 1.10 | Couples induce interdependent choices; does not assert every coupled instance lacks stability. |
| 2.1 | Independently ran DA; rejection chain ends at 1–B,2–A,3–C. |
| 2.2 | Priorities are institutional admission orders rather than student preferences or necessarily school welfare. |
| 2.3 | Preference for A plus priority over its occupant establishes justified envy. |
| 2.4 | Student strategy-proofness states fixed capacities/priorities, unit demand and unrestricted lists. |
| 2.5 | One-choice cap changes reporting domain; B strictly dominates an infeasible A application. |
| 2.6 | Immediate acceptances final, DA acceptances tentative; no false stability guarantee. |
| 2.7 | Executed graph cycle check: 1 and 2 trade, 3 keeps h3. |
| 2.8 | Housing IR compares with own endowment, not global top choice. |
| 2.9 | Fair lottery fixes strict order; equal chances limited to isolated two-student/one-seat case. |
| 2.10 | Explicit soft-reserve release rule admits both noneligible applicants. |
| 3.1 | Enumerated disjoint allocations; singleton bids sum to 13>12. |
| 3.2 | Bidder 2 externality is 12−6=6. |
| 3.3 | Bidder 3 externality is 12−7=5. |
| 3.4 | Each winner displaces the value-4 bidder; both pivot payments 4. |
| 3.5 | Complementary bundle with zero singleton value creates exposure to positive singleton payment. |
| 3.6 | Fixed-rival demand-reduction calculation gives utilities 3 versus 10; no equilibrium claim. |
| 3.7 | Hard budget restricts transfers independently of valuation. |
| 3.8 | Reverse procurement winner cost 3, payment 5, profit 2. |
| 3.9 | Received 4 minus paid 10 gives net revenue −6 under stipulated transfers. |
| 3.10 | Payment rule changes strategic reporting even with unchanged feasible allocations. |
| 4.1 | Terms enter contract object; pair identity alone is incomplete. |
| 4.2 | Two employment contracts violate explicit worker unit demand despite hospital room. |
| 4.3 | Top-two available applicants are b,c; unavailable a cannot be chosen. |
| 4.4 | Definition explicitly supplied; choice from pair but rejection from singleton violates substitutes. |
| 4.5 | Clinic’s all-or-nothing pair demand exhibits the same complementarity concretely. |
| 4.6 | Firm profit rises 4→5 and unmatched worker obtains 5; feasible replacement blocks. |
| 4.7 | Removing unchosen c preserves top-two set under this fixed rule. |
| 4.8 | Rural-hospitals invariants stated only in strict, responsive, fixed-capacity domain. |
| 4.9 | Student preference strategy-proofness does not imply school capacity-report strategy-proofness. |
| 4.10 | Four hires satisfy local capacities but violate aggregate regional cap three. |
| 5.1 | Directed edge interpreted as donor of source pair to patient of destination pair. |
| 5.2 | Only directed three-cycle exists and is allowed; three recipients. |
| 5.3 | Same graph with two-cycle bound has zero feasible closed exchanges. |
| 5.4 | Enumerated packings; disjoint end cycles cover four vertices. |
| 5.5 | Enumerated weighted packings; middle cycle score 15 beats disjoint total 10. |
| 5.6 | Altruist is not a recipient; path reaches three patient vertices. |
| 5.7 | Pair a overlaps across components, violating explicit participation constraint. |
| 5.8 | Independence plus all-or-nothing execution gives 3×0.9³=2.187. |
| 5.9 | Two-cycle alone fits two recipient slots; three-cycle splitting explicitly forbidden. |
| 5.10 | Maximizing given reports does not guarantee institution submission incentives. |
| 6.1 | Thickness can coexist with evaluation congestion. |
| 6.2 | Corrected prompt asks strongest guaranteed lower bound: 40; weaker bound 20 is not the requested strongest bound. |
| 6.3 | Earlier decisions can use less information; no unconditional welfare claim. |
| 6.4 | Offer deadline precedes alternative information; neither quality nor acceptance guaranteed. |
| 6.5 | Expected delayed benefit 11 minus cost 2 beats immediate 8 under explicit exclusions. |
| 6.6 | Randomization of independent markets identifies total mechanism-assignment effect, including behavior. |
| 6.7 | Recession and rule adoption confounded in raw before-after difference. |
| 6.8 | Stability audit needs preferences, priorities and capacities, not assignment labels alone. |
| 6.9 | Belief-weighted payout 0.7 minus price 0.6 is 0.1; no inference that belief is true. |
| 6.10 | Equal totals do not establish distributional equivalence or individual Pareto dominance. |

## Remaining gate

Drafts await parent integration and release review. The bounded exercises do not claim full treatment of every market-design theorem, clinical exchange constraint or empirical implementation problem.
