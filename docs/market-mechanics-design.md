# Market Mechanics Lab: approved public release

Public route /teaching/market-mechanics/. Public teaching catalogue record links to the full-screen standalone lab. No student names or source-client context. Existing local standalone remains intact.

Visual direction: local Geist and Newsreader, the site's six canonical colors, wide graph-led composition with a compact control dock. Labels connect prices and quantity directly to the graph. Neutral surfaces and subtle functional depth, not decorative effects. Small-site navigation returns to Teaching.

Interactions: continuous requestAnimationFrame transitions, reduced-motion handling, frozen comparison, pauseable scrubber replay from a captured market to current market, answer hiding, native keyboard controls, hash-encoded scenarios with strict validation, downloadable SVG.

Correctness: preserve competitive linear model and explicit rationing assumptions. Every animation frame solves the interpolated market rather than interpolating welfare totals. Mode changes pass through an unregulated market. Tax shutdown has no unique transaction prices. Replay is descriptive comparative statics, not adjustment dynamics.

Plan: test new transition/hash boundaries first; implement public HTML and catalogue record; run existing 972 economic scenarios plus transition and serialization tests; browser-test keyboard controls, replay/pause, mobile, share restore and reduced motion; build/check site; publish only new files based on origin/main and verify deployed route.
