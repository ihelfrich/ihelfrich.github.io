// After a deploy: is the public site serving the STATAverse commit that
// config/stataverse.json pins? It compares the live release file's commit
// with the pin, and the live Console's ?v= stamp with the stamp in that
// commit's Console/index.html. The CDN can serve the previous release for a
// few minutes, so a mismatch is retried before it is reported.
//
//   node scripts/check-stataverse-live.mjs [--tries 10] [--wait 30]
//
// Exit 0 when both match, 1 when they still differ after the last try, 2
// when a page could not be read at all.
import fs from "node:fs/promises";

const SITE = "https://ihelfrich.github.io";
const argument = (name, fallback) => {
  const k = process.argv.indexOf(name);
  return k > 0 ? Number(process.argv[k + 1]) : fallback;
};
const tries = argument("--tries", 10),
  wait = argument("--wait", 30);

const pin = JSON.parse(
  await fs.readFile(new URL("../config/stataverse.json", import.meta.url)),
);
const base = pin.base.replace(/\/$/, "");
const stampOf = (html) => /console\.js\?v=([a-z0-9]+)/.exec(html)?.[1] ?? null;

async function text(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

let expectedStamp;
try {
  expectedStamp = stampOf(
    await text(
      `https://raw.githubusercontent.com/${pin.repository}/${pin.commit}/Console/index.html`,
    ),
  );
} catch (error) {
  console.error(`Could not read the pinned commit's Console: ${error.message}`);
  process.exit(2);
}
if (!expectedStamp) {
  console.error("The pinned commit's Console/index.html carries no ?v= stamp.");
  process.exit(2);
}

for (let attempt = 1; attempt <= tries; attempt++) {
  // A query string that changes each time keeps caches between here and the
  // CDN out of the answer; the CDN itself may still be behind.
  const bust = `?check=${Date.now()}`;
  let release, stamp;
  try {
    release = JSON.parse(await text(`${SITE}${base}/site-release.json${bust}`));
    stamp = stampOf(await text(`${SITE}${base}/Console/${bust}`));
  } catch (error) {
    console.error(`Could not read the live site: ${error.message}`);
    process.exit(2);
  }
  const commitOk = release.commit === pin.commit,
    stampOk = stamp === expectedStamp;
  console.log(
    `try ${attempt}: release ${release.commit?.slice(0, 7)} (pin ${pin.commit.slice(0, 7)}) ${commitOk ? "ok" : "differs"}; Console stamp ${stamp} (expected ${expectedStamp}) ${stampOk ? "ok" : "differs"}`,
  );
  if (commitOk && stampOk) {
    console.log("The live site serves the pinned STATAverse release.");
    process.exit(0);
  }
  if (attempt < tries)
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
}
console.error(
  `After ${tries} tries the live site does not serve the pinned STATAverse release.`,
);
process.exit(1);
