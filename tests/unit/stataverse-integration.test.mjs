import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  integrateHtml,
  validatePackage,
} from "../../scripts/prepare-stataverse.mjs";
import {
  PRIMARY,
  BOOK,
  CONTACT,
  GO_RECORDS,
  withSlash,
} from "../../src/data/navigation.mjs";
import { ROUTES } from "../../src/data/field-topics.mjs";
const release = JSON.parse(await fs.readFile("config/stataverse.json", "utf8"));
async function fixture(run) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stata-site-"));
  const files = [];
  for (const name of [
    "index.html",
    "Learn/index.html",
    "Labs/index.html",
    "Labs/Inference/index.html",
    "Labs/Data/index.html",
    "service-worker.js",
  ]) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true });
    const bytes = Buffer.from(name);
    await fs.writeFile(path.join(dir, name), bytes);
    files.push({
      path: name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  const manifest = {
    version: 1,
    sourceCommit: release.commit,
    dirty: false,
    files,
  };
  const save = () =>
    fs.writeFile(path.join(dir, "site-package.json"), JSON.stringify(manifest));
  try {
    await save();
    await run(dir, manifest, save);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
test("integrated pages preserve the skip link, local assets and query/hash routes with shared site destinations", () => {
  const html = integrateHtml(
    '<html><head></head><body><a class="skip-link" href="#main">Skip</a><main><a href="../../Learn/#regression">Practice</a><a href="../../ScriptLibrary/script.html?id=regress&amp;x=1">Code</a><img src="../../assets/x.svg"></main></body></html>',
    "Labs/Data/index.html",
  );
  assert.ok(
    html.indexOf('class="skip-link"') < html.indexOf('class="sv-site-nav"'),
  );
  assert.match(
    html,
    /canonical" href="https:\/\/ihelfrich.github.io\/learn\/stata\/Labs\/Data\//,
  );
  assert.match(html, /href="\/learn\/stata\/Learn\/#regression"/);
  assert.match(
    html,
    /href="\/learn\/stata\/ScriptLibrary\/script.html\?id=regress&amp;x=1"/,
  );
  assert.match(html, /src="\.\.\/\.\.\/assets\/x.svg"/);
  for (const item of [...PRIMARY, BOOK, CONTACT])
    assert.ok(html.includes(`href="${withSlash(item.href)}"`));
  assert.doesNotMatch(html, /<iframe|<script/);
});
test("STATAverse belongs to global discovery and the student route", async () => {
  assert.ok(GO_RECORDS.some((r) => r.href === "/learn/stata"));
  assert.ok(ROUTES.Student.steps.some(([r]) => r === "/learn/stata/"));
  for (const file of [
    "src/pages/teaching/index.astro",
    "src/pages/lab.astro",
    "src/content/teaching/stataverse.md",
    "src/content/projects/stataverse.md",
  ])
    assert.ok(
      (await fs.readFile(file, "utf8")).includes("/learn/stata/"),
      file,
    );
});
test("release package rejects wrong commits, changed bytes, duplicates, traversal and incomplete builds", async () => {
  await fixture(async (dir, m, save) => {
    assert.equal(
      (await validatePackage({ packageDir: dir })).verified.length,
      6,
    );
    m.sourceCommit = "a".repeat(40);
    await save();
    await assert.rejects(validatePackage({ packageDir: dir }), /pinned/);
    m.sourceCommit = release.commit;
    m.files[0].sha256 = "0".repeat(64);
    await save();
    await assert.rejects(validatePackage({ packageDir: dir }), /integrity/);
    m.files[0].sha256 = createHash("sha256").update("index.html").digest("hex");
    m.files.push(m.files[0]);
    await save();
    await assert.rejects(validatePackage({ packageDir: dir }), /repeated/);
    m.files.pop();
    m.files[0].path = "../index.html";
    await save();
    await assert.rejects(validatePackage({ packageDir: dir }), /Unsafe/);
    m.files.shift();
    await save();
    await assert.rejects(validatePackage({ packageDir: dir }), /incomplete/);
  });
});
test("a dirty development package cannot enter a release or CI build", async () => {
  await fixture(async (dir, m, save) => {
    m.dirty = true;
    await save();
    await assert.rejects(validatePackage({ packageDir: dir }), /clean/);
    const previous = process.env.CI;
    process.env.CI = "true";
    try {
      await assert.rejects(
        validatePackage({ packageDir: dir, allowDirty: true }),
        /clean/,
      );
    } finally {
      if (previous === undefined) delete process.env.CI;
      else process.env.CI = previous;
    }
  });
});
test("package symlinks cannot expose files outside the package", async () => {
  await fixture(async (dir) => {
    await fs.rm(path.join(dir, "index.html"));
    await fs.symlink(
      path.resolve("package.json"),
      path.join(dir, "index.html"),
    );
    await assert.rejects(validatePackage({ packageDir: dir }), /escapes/);
  });
});

test("the CI source pin is emitted as one complete GitHub output line", async () => {
  const { default: yaml } = await import("js-yaml");
  const { execFileSync } = await import("node:child_process");
  const workflow = yaml.load(
    await fs.readFile(".github/workflows/deploy.yml", "utf8"),
  );
  const command = workflow.jobs.build.steps.find(
    (step) => step.id === "stata",
  ).run;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stata-pin-"));
  try {
    const output = path.join(dir, "output");
    execFileSync("/bin/sh", ["-c", command], {
      env: { ...process.env, GITHUB_OUTPUT: output },
      timeout: 10000,
    });
    assert.equal(
      await fs.readFile(output, "utf8"),
      `commit=${release.commit}\n`,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
