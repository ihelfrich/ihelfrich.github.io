import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.COUNTERFACTUALS_CATALOG_URL || "https://helfrich-causal-inference.pr0digal.chatgpt.site/data/lab/catalog.json";
const target = path.resolve("public/data/counterfactuals/catalog.json");
const response = await fetch(url, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`Counterfactuals catalogue returned ${response.status}`);
const catalogue = await response.json();
if (catalogue?.title !== "Counterfactuals teaching data catalogue" || !Array.isArray(catalogue.datasets) || catalogue.datasets.length < 1) throw new Error("Counterfactuals catalogue has an invalid shape");
for (const dataset of catalogue.datasets) {
  for (const field of ["id", "title", "row_count", "csv_url", "source_sha256", "license", "interpretation_boundary"]) {
    if (dataset[field] == null || dataset[field] === "") throw new Error(`Dataset ${dataset.id || "unknown"} lacks ${field}`);
  }
}
const next = JSON.stringify(catalogue, null, 2) + "\n";
const current = await readFile(target, "utf8").catch(() => "");
if (current !== next) {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, next);
  console.log(`Updated ${target} with ${catalogue.datasets.length} datasets`);
} else console.log(`Counterfactuals catalogue is current (${catalogue.datasets.length} datasets)`);
