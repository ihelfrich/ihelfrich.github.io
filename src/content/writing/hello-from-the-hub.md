---
title: "Rebuilding the research site"
summary: "How Astro and Pagefind connect my research, datasets, and teaching sites."
date: 2026-05-11
tags: ["meta", "tooling"]
---

My papers, datasets, and teaching materials were spread across several repositories. Some used Quarto, others Cesium or Jekyll. Someone arriving at one project had little help finding the others, and search stopped at each site's boundary.

I built this site in Astro to provide a common index. Research, project, dataset, and writing entries live in versioned content files. [Pagefind](https://pagefind.app) searches the published pages, including indexed copies of the linked teaching sites. The RSS feed collects updates from this site.

The individual projects keep the software they need. Quarto supports longer teaching material with executable analysis; Cesium supports spatial visualization. Moving them all to Astro would add maintenance work without improving those capabilities.

The source is edited in a text editor and committed to Git. There is no separate content-management system. Papers, data releases, software, and teaching materials each have their own entry and release status.

*Originally published May 2026; revised September 2026.*
