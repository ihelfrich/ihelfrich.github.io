import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const upstream = process.env.COUNTERFACTUALS_CATALOG_URL || "https://helfrich-causal-inference.pr0digal.chatgpt.site/data/lab/catalog.json";
const targetDir = path.resolve("public/data/counterfactuals");
const target = path.join(targetDir, "catalog.json");
const response = await fetch(upstream, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`Counterfactuals catalogue returned ${response.status}`);
const catalogue = await response.json();
if (catalogue?.title !== "Counterfactuals teaching data catalogue" || !Array.isArray(catalogue.datasets) || catalogue.datasets.length < 1) throw new Error("Counterfactuals catalogue has an invalid shape");

const writeIfChanged = async (file, content) => {
  const current = await readFile(file, "utf8").catch(() => "");
  if (current === content) return false;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
  return true;
};

let changed = 0;
const mirrored = [];
for (const dataset of catalogue.datasets) {
  for (const field of ["id", "title", "row_count", "json_url", "csv_url", "source_sha256", "license", "interpretation_boundary"]) {
    if (dataset[field] == null || dataset[field] === "") throw new Error(`Dataset ${dataset.id || "unknown"} lacks ${field}`);
  }

  const jsonSource = new URL(dataset.json_url, upstream);
  const csvSource = new URL(dataset.csv_url, upstream);
  const [jsonResponse, csvResponse] = await Promise.all([
    fetch(jsonSource, { headers: { accept: "application/json" } }),
    fetch(csvSource, { headers: { accept: "text/csv" } }),
  ]);
  if (!jsonResponse.ok) throw new Error(`Dataset ${dataset.id} JSON returned ${jsonResponse.status}`);
  if (!csvResponse.ok) throw new Error(`Dataset ${dataset.id} CSV returned ${csvResponse.status}`);

  const jsonText = await jsonResponse.text();
  const csvText = await csvResponse.text();
  const payload = JSON.parse(jsonText);
  if (payload.id !== dataset.id || !Array.isArray(payload.rows) || payload.rows.length !== dataset.row_count) {
    throw new Error(`Dataset ${dataset.id} member disagrees with the catalogue`);
  }
  if (!csvText.trim() || csvText.trimEnd().split("\n").length !== dataset.row_count + 1) {
    throw new Error(`Dataset ${dataset.id} CSV row count disagrees with the catalogue`);
  }

  changed += Number(await writeIfChanged(path.join(targetDir, `${dataset.id}.json`), jsonText.endsWith("\n") ? jsonText : jsonText + "\n"));
  changed += Number(await writeIfChanged(path.join(targetDir, `${dataset.id}.csv`), csvText.endsWith("\n") ? csvText : csvText + "\n"));
  mirrored.push({
    ...dataset,
    json_url: `/data/counterfactuals/${dataset.id}.json`,
    csv_url: `/data/counterfactuals/${dataset.id}.csv`,
  });
}

const next = JSON.stringify({ ...catalogue, datasets: mirrored }, null, 2) + "\n";
changed += Number(await writeIfChanged(target, next));
console.log(changed
  ? `Updated ${changed} Counterfactuals mirror files for ${mirrored.length} datasets`
  : `Counterfactuals mirror is current (${mirrored.length} datasets)`);
