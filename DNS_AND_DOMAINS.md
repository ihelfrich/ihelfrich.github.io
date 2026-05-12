# DNS playbook: making ianhelfrich.com point at this hub

This hub deploys to **https://ihelfrich.github.io/**. You have three ways to map your custom domain (or a subdomain) onto it, depending on how much of the existing WordPress site you want to keep.

## Current state

- `ianhelfrich.com` → DreamHost WordPress (single-page intro, last updated who knows when)
- `ihelfrich.github.io` → this Astro hub (live)
- `ihelfrich.github.io/inference-lab/` → Inference Lab Quarto book (live)
- `ihelfrich.github.io/macroprep/` → Macro Prep Quarto book (live)

## Option A: subdomain (recommended first move, zero risk)

Use `lab.ianhelfrich.com` (or `hub.`, `home.`, `research.` — whatever you like) for the new hub. Apex stays WordPress.

**DreamHost steps:**

1. Log into the DreamHost panel.
2. Go to *Manage Domains* → *DNS* for `ianhelfrich.com`.
3. Add a new record:
   - **Name:** `lab` (or your chosen subdomain)
   - **Type:** `CNAME`
   - **Value:** `ihelfrich.github.io`
   - **TTL:** default (300 sec is fine)
4. Save. Propagation typically takes 5-30 minutes.

**GitHub steps:**

1. In the `ihelfrich/ihelfrich.github.io` repo settings → Pages, set *Custom domain* to `lab.ianhelfrich.com`.
2. Wait for the green "DNS check successful" badge.
3. Check "Enforce HTTPS" once the badge appears.

That's it. `lab.ianhelfrich.com` serves the hub; `ianhelfrich.com` keeps the WordPress page.

## Option B: apex takeover (when you're ready to retire WordPress)

Use `ianhelfrich.com` itself for the hub. WordPress goes dark.

**Before flipping:** export anything you want to keep from WordPress. The cleanest way is the built-in *Tools → Export* in the WordPress admin, which writes an XML dump of posts, pages, and media. You can convert that to Markdown with `wordpress-export-to-markdown` (an npm tool) and move it into the `src/content/writing/` collection here.

**DreamHost steps:**

1. *Manage Domains* → *DNS* for `ianhelfrich.com`.
2. Delete existing A records (or note them somewhere first in case you need to roll back).
3. Add four A records (one per IP):
   - **Name:** `@`
   - **Type:** `A`
   - **Values (one record per IP):**
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
4. Add an AAAA record set for IPv6 (optional but recommended):
   - **Name:** `@`
   - **Type:** `AAAA`
   - **Values:**
     - `2606:50c0:8000::153`
     - `2606:50c0:8001::153`
     - `2606:50c0:8002::153`
     - `2606:50c0:8003::153`
5. Add a CNAME for `www`:
   - **Name:** `www`
   - **Type:** `CNAME`
   - **Value:** `ihelfrich.github.io`
6. Save. Wait ~30 min for global propagation.

**GitHub steps:**

1. In the repo settings → Pages, set *Custom domain* to `ianhelfrich.com`.
2. Wait for DNS check green badge.
3. Enable "Enforce HTTPS".

A `CNAME` file with content `ianhelfrich.com` will be auto-created in the repo. Make sure it's preserved in the workflow output — Astro's `dist/` should include it. (If not, drop `public/CNAME` with the single line `ianhelfrich.com` and re-deploy.)

**WordPress steps:**

- Once DNS has propagated and the hub is live at `ianhelfrich.com`, the WordPress site is unreachable. You can either:
  - Leave the DreamHost hosting running (in case you need to roll back)
  - Cancel the DreamHost hosting plan (keep the domain registration if you want)

## Option C: keep both, use a subdomain forever

If you decide WordPress on apex is fine and you don't want the apex risk, just stay on Option A indefinitely. The hub at `lab.ianhelfrich.com` is just as functional as it would be at the apex; the only cost is one extra word in the URL.

## What about the existing spoke sites?

`ihelfrich.github.io/inference-lab/` and `ihelfrich.github.io/macroprep/` already work. After an apex takeover (Option B), they continue to work — but only at their full URLs (`https://ianhelfrich.com/inference-lab/`? **No**, they remain at `https://ihelfrich.github.io/inference-lab/` because GitHub Pages doesn't share custom domains across project repos).

If you want the spokes to also live at `ianhelfrich.com/inference-lab/`, you'd need to either:
- Move each spoke's content into the hub repo (loses per-spoke independence), or
- Use a reverse-proxy / Cloudflare Workers setup (over-engineered for now)

Recommendation: leave the spokes at `ihelfrich.github.io/inference-lab/`. The hub links to them. Search results link to them. The URLs are stable and the brand is consistent (both are GitHub Pages under your handle).

## A note on email

If `ianhelfrich.com` currently has MX records routing to a mailbox somewhere (DreamHost-hosted email?), make sure to **preserve those MX records when you delete the A records in Option B**. Only the A and AAAA (and the `www` CNAME) change. MX records control email and have nothing to do with web routing.

If you don't have email on the domain, ignore this paragraph.

## Quick reference

| Want | Do |
|---|---|
| Subdomain `lab.ianhelfrich.com` for hub | Add `lab CNAME ihelfrich.github.io` in DreamHost |
| Apex `ianhelfrich.com` for hub | Replace A records with 4 GitHub IPs + CNAME `www → ihelfrich.github.io` |
| Keep WordPress, hub stays at `ihelfrich.github.io` | Do nothing |
| Roll back from apex takeover | Restore old DreamHost A records |
