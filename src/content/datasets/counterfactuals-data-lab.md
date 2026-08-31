---
title: "Counterfactuals teaching data lab"
authors: ["Ian Helfrich"]
blurb: "Open, provenance-tracked teaching datasets that readers can filter, plot, inspect, and download while learning where description ends and causal identification begins."
year: 2026
status: released
viewer: "https://helfrich-causal-inference.pr0digal.chatgpt.site/data"
size: "Nine playable datasets in normalized JSON and CSV, with a machine-readable catalogue."
license: "Per dataset; recorded in the public catalogue"
citation: "Helfrich, Ian. Counterfactuals teaching data lab. Living public teaching release, 2026."
tags: ["causal inference", "teaching data", "econometrics", "open data", "interactive"]
---

Each dataset record includes its source identity, SHA-256 evidence, license, normalized columns, row count, and an explicit interpretation boundary. The Berkeley admissions record additionally separates the official R archive hash, exact data-member hash, documentation-member hash, normalized-input hash, and download hashes. The files are public teaching data. They contain no student, client, or private records.

The catalogue is mirrored here so the teaching hub can verify what the live book currently exposes: [machine-readable catalogue](/data/counterfactuals/catalog.json). The [synchronization receipt](/data/counterfactuals/sync.json) records the source catalogue version, dataset count, catalogue hash, and last successful refresh.

The browser lab performs its summaries and filtering locally. Downloaded CSV files remain usable in R, Python, Stata, Julia, spreadsheets, or any other ordinary data tool.

## What it is for

The lab is a place to practice the operation that comes before estimation: inspect the rows, name the unit, identify the comparison, and say what additional design information a causal claim would require.
