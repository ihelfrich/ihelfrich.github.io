---
title: "Why a hub, and not another framework"
summary: "Notes from the rebuild. Why I picked Astro + Pagefind over Docusaurus, what the hub is for, and what comes next."
date: 2026-05-11
tags: ["meta", "tooling"]
---

A research career produces a lot of artifacts. Papers, datasets, viewers, teaching sites, blog posts, conference talks, fieldwork notes. Most of them deserve their own home with the right tool. None of them deserve to live alone.

The problem I kept running into is that my work sat in five different repositories under five different rendering pipelines (Quarto book here, Cesium app there, a half-finished Jekyll site somewhere else) and nothing tied it together. Visitors who found one thing had no path to the rest. Search worked inside a site but never across them. The hub fixes that.

## What the hub is

A single front page that links out to the spokes. Each spoke is whatever tool was right for the job. The Inference Lab is a Quarto book because Quarto is the right tool for long-form methods writing with R/Stata code. The NMTC viewer is a Cesium app because Cesium is the right tool for 3D spatial exploration. The hub is Astro because Astro is the right tool for content collections + cross-site search.

The hub does four things the spokes can't do for themselves:

- It introduces me, briefly. One paragraph, no preamble.
- It surfaces what's new across all the spokes.
- It runs cross-site search via [Pagefind](https://pagefind.app).
- It produces a single RSS feed so people who care can subscribe.

It's deliberately not a portfolio. Portfolios are for jobs. This is a working surface for ongoing research.

## What I didn't build

I didn't build a CMS. Markdown files in `src/content/` committed via Git is the authoring interface. If I want to write a blog post, I open a text editor.

I didn't build particle effects, animated heroes, or carousels. A serious research site doesn't need them. The Atul Gawandes and Adam Toozes of the world have austere sites, because their substance is what's interesting.

I didn't migrate off Quarto. Migrating four working sites to a unified framework is a tax I'm not willing to pay, and the visitor-facing benefit is small. Better to let each tool be the best version of itself, and add the connective tissue here.

## What comes next

In rough order: real blog content (not this meta post), a `/chat` page that hits the Anthropic API with the Pagefind index as the retrieval layer, a `dataset/` collection for the EffDist V2026 release, and a dark mode that respects the system preference. The chat layer is the one I'm most curious about. Search is useful but answers are better.

For now the hub is live, the search works across the three spokes I already have, and the rest is incremental.
