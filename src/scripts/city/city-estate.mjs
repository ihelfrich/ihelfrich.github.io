import {
  calculateProForma,
  parseListingsCsv,
  filterListings,
  summarizeListings,
  MAX_CSV_BYTES,
} from "../../lib/estate-analysis.mjs";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const pct = (value) => (value === null ? "—" : `${value.toFixed(2)}%`);
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const fields = [
  ["purchasePrice", "Purchase price · $"],
  ["rehab", "Initial rehab · $"],
  ["closingCosts", "Closing costs · $"],
  ["rentMonthly", "Monthly rent · $"],
  ["otherIncomeMonthly", "Other monthly income · $"],
  ["vacancyPct", "Vacancy · %"],
  ["operatingExpensesAnnual", "Annual operating costs · $"],
  ["capexReserveAnnual", "Annual replacement reserve · $"],
  ["ltvPct", "Loan / purchase price · %"],
  ["interestPct", "Annual interest · %"],
  ["loanYears", "Loan term · years"],
];

export function createEstatePanel(
  root,
  { getCity = () => null, onOpen = () => {}, notice = () => {} } = {},
) {
  let listings = [],
    visible = [],
    selected = null,
    selectedMapPoint = null;
  let result = null,
    inputName = "",
    importIssues = [],
    scenarioKind = "manual",
    importGeneration = 0;
  root.innerHTML = `
    <h2>Place meets possibility.</h2><p class="panel-intro">Explore listings. Test the assumptions.</p>
    <div class="estate-source"><span class="eyebrow">YOUR MARKET DATA</span><strong id="estate-feed-label">No listing feed connected</strong><p>Import a CSV you have permission to use. It stays in this page; nothing is uploaded.</p>
    <div class="button-row"><label class="primary-button upload-button">Import listings<input id="estate-file" type="file" accept=".csv,text/csv" /></label><a class="secondary-button" href="/st-louis/listing-import-template.csv" download>CSV template ↓</a></div>
    <p class="small-note">Up to 5 MB / 5,000 rows. Source, status, coordinates and as_of are required. Each import replaces this page’s dataset.</p></div>
    <div id="estate-import-status" class="small-note" role="status"></div>
    <div id="estate-market" hidden>
      <div class="estate-filters"><label>Listing status<select id="estate-status"><option value="active">Active</option><option value="pending">Pending</option><option value="sold">Sold</option><option value="withdrawn">Withdrawn</option><option value="all">All statuses</option></select></label><label>Address or source<input id="estate-query" type="search" placeholder="Filter imported listings" /></label></div>
      <div class="estate-metrics" id="estate-totals"></div><p id="estate-coverage" class="small-note"></p>
      <div id="estate-list" class="estate-list"></div><button id="estate-clear" class="text-button">Clear imported data</button>
    </div>
    <div class="estate-scenario"><span class="eyebrow">RENTAL SCENARIO</span><h3 id="estate-selection">Start with your assumptions.</h3><p id="estate-selected-source" class="small-note">Select an imported listing, or enter a purchase price below.</p>
    <div class="button-row"><button id="estate-example" class="secondary-button">Try illustrative numbers</button><button id="estate-reset" class="text-button">Reset</button></div>
    <form id="estate-form"><div id="estate-fields" class="estate-fields"></div><p class="small-note">Operating costs should include taxes, insurance, maintenance, management and other expenses. Exclude the separate reserve and debt payment. Enter 0 explicitly where appropriate.</p><button class="primary-button wide" type="submit">Calculate scenario</button></form>
    <p id="estate-error" class="estate-error" role="status"></p><div id="estate-results" hidden></div>
    <p class="small-note">Stabilized annual scenario, in USD. No rent forecast, tax model, exit value or verified valuation is implied.</p></div>`;
  const $ = (id) => root.querySelector(`#${id}`);
  for (const [key, title] of fields) {
    const label = el("label", title),
      input = el("input");
    input.type = "number";
    input.name = key;
    input.id = `estate-${key}`;
    input.required = true;
    input.min = key === "loanYears" ? String(1 / 12) : "0";
    input.step = "any";
    if (key.endsWith("Pct")) input.max = "100";
    label.htmlFor = input.id;
    label.append(input);
    $("estate-fields").append(label);
  }
  const inputs = () =>
    Object.fromEntries(
      fields.map(([key]) => [
        key,
        $(`estate-${key}`).value.trim() === ""
          ? NaN
          : Number($(`estate-${key}`).value),
      ]),
    );
  const invalidate = () => {
    result = null;
    $("estate-results").hidden = true;
    $("estate-results").replaceChildren();
    $("estate-error").textContent = "";
  };
  $("estate-form").addEventListener("input", () => {
    invalidate();
    if (scenarioKind === "illustrative") scenarioKind = "illustrative-modified";
  });
  function choose(listing, fly = true) {
    if (selected?.id !== listing.id) reset();
    else invalidate();
    selected = listing;
    selectedMapPoint = null;
    scenarioKind = "listing";
    onOpen();
    $("estate-selection").textContent =
      listing.address || `Listing ${listing.listingId}`;
    $("estate-selected-source").textContent =
      `${listing.status} · ${listing.source} · as of ${listing.asOf} · ${listing.parcelId ? `supplied parcel ${listing.parcelId}` : "parcel not supplied"}. Enter your other assumptions for this listing.`;
    $(`estate-purchasePrice`).value = listing.askingPrice;
    if (fly) {
      const x =
        (listing.longitude + 90.193) *
        111195 *
        Math.cos((38.628 * Math.PI) / 180);
      const z = -(listing.latitude - 38.628) * 111195;
      getCity()?.flyTo(x, z, 3);
    }
  }
  function renderListings() {
    const status = $("estate-status").value;
    visible = filterListings(listings, {
      statuses:
        status === "all"
          ? ["active", "pending", "sold", "withdrawn"]
          : [status],
      query: $("estate-query").value,
    });
    const summary = summarizeListings(visible),
      totals = $("estate-totals");
    totals.replaceChildren();
    for (const [value, label] of [
      [String(visible.length), "Matching records"],
      [usd.format(summary.activeAskingVolumeUSD), "Active asking volume"],
    ]) {
      const card = el("div");
      card.append(el("strong", value), el("span", label));
      totals.append(card);
    }
    $("estate-coverage").textContent =
      `Imported records only. ${summary.activeListingCount} active; ${summary.uniqueIdentifiedActiveParcels} distinct supplied active parcel IDs; ${summary.activeListingsWithoutParcelId} active without a parcel ID. Availability is as reported on each source date. Citywide coverage and share for sale are unknown.${summary.possibleDuplicateParcelGroups.length > 0 ? " Repeated parcel IDs may double-count asking volume." : ""}`;
    const list = $("estate-list");
    list.replaceChildren();
    for (const listing of visible.slice(0, 100)) {
      const button = el("button", undefined, "estate-listing");
      const row = el("span");
      row.append(
        el("strong", usd.format(listing.askingPrice)),
        el("small", listing.status),
      );
      button.append(
        row,
        el("span", listing.address || listing.listingId),
        el("small", `${listing.source} · ${listing.asOf}`),
      );
      button.addEventListener("click", () => choose(listing));
      list.append(button);
    }
    if (visible.length > 100)
      list.append(
        el(
          "p",
          "Showing the first 100 matching records. All matching locations are mapped.",
          "small-note",
        ),
      );
    if (!visible.length)
      list.append(
        el("p", "No imported records match these filters.", "small-note"),
      );
    refreshMarkers();
  }
  function refreshMarkers() {
    getCity()?.setListings?.(visible, (listing) => choose(listing, false));
  }
  for (const id of ["estate-status", "estate-query"])
    $(id).addEventListener("input", renderListings);
  $("estate-file").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const generation = ++importGeneration;
    try {
      if (file.size > MAX_CSV_BYTES)
        throw new Error("Choose a CSV smaller than 5 MB.");
      const parsed = parseListingsCsv(await file.text());
      if (generation !== importGeneration) return;
      if (!parsed.listings.length) {
        const issues = [...parsed.errors, ...parsed.warnings];
        $("estate-import-status").textContent =
          (issues
            .slice(0, 3)
            .map((e) => `Row ${e.row || "header"}: ${e.message}`)
            .join(" ") ||
            "This CSV has no listing records. Add your records below the template header.") +
          (listings.length
            ? " The previous dataset and scenario are unchanged."
            : "");
        return;
      }
      // Validate aggregate arithmetic before replacing the current data or scenario.
      summarizeListings(parsed.listings);
      listings = parsed.listings;
      inputName = file.name;
      reset();
      $("estate-selected-source").textContent =
        "Select a listing from the new import. Previous scenario assumptions were cleared.";
      importIssues = [...parsed.errors, ...parsed.warnings];
      $("estate-feed-label").textContent =
        `${listings.length.toLocaleString()} imported records · ${file.name}`;
      $("estate-market").hidden = false;
      $("estate-import-status").textContent =
        `${parsed.errors.length} rejected records / issues; ${parsed.warnings.length} warnings. ${importIssues
          .slice(0, 3)
          .map((i) => i.message || String(i))
          .join(" ")}`;
      renderListings();
      notice("Listings imported into this page. Source dates remain visible.");
    } catch (error) {
      if (generation === importGeneration)
        $("estate-import-status").textContent =
          (error.message || "The CSV could not be read.") +
          (listings.length
            ? " The previous dataset and scenario are unchanged."
            : "");
    } finally {
      if (generation === importGeneration) event.target.value = "";
    }
  });
  $("estate-clear").addEventListener("click", () => {
    importGeneration++;
    listings = [];
    visible = [];
    inputName = "";
    importIssues = [];
    selected = null;
    refreshMarkers();
    $("estate-market").hidden = true;
    $("estate-feed-label").textContent = "No listing feed connected";
    $("estate-import-status").textContent =
      "Imported records cleared from this page.";
    reset();
  });
  function reset() {
    selected = null;
    selectedMapPoint = null;
    scenarioKind = "manual";
    $("estate-form").reset();
    invalidate();
    $("estate-selection").textContent = "Start with your assumptions.";
    $("estate-selected-source").textContent =
      "Select an imported listing, or enter a purchase price below.";
  }
  $("estate-reset").addEventListener("click", reset);
  $("estate-example").addEventListener("click", () => {
    reset();
    scenarioKind = "illustrative";
    $("estate-selection").textContent = "Illustrative scenario";
    $("estate-selected-source").textContent =
      "Made-up inputs for exploring the calculator. These do not describe an actual property or current market terms.";
    const example = {
      purchasePrice: 250000,
      rehab: 20000,
      closingCosts: 7500,
      rentMonthly: 2500,
      otherIncomeMonthly: 0,
      vacancyPct: 5,
      operatingExpensesAnnual: 9000,
      capexReserveAnnual: 1500,
      ltvPct: 75,
      interestPct: 6.5,
      loanYears: 30,
    };
    for (const [key, value] of Object.entries(example))
      $(`estate-${key}`).value = value;
    calculate();
  });
  function calculate() {
    invalidate();
    try {
      result = calculateProForma(inputs());
    } catch (error) {
      $("estate-error").textContent =
        error.errors
          ?.map(
            (e) =>
              `${fields.find((f) => f[0] === e.field)?.[1] || e.field}: ${e.message}`,
          )
          .join(" ") || "Check the entered assumptions.";
      return;
    }
    const r = result,
      output = $("estate-results");
    output.replaceChildren();
    output.hidden = false;
    const headline = el("div", undefined, "estate-cashflow");
    headline.dataset.negative = String(r.cashFlowAnnual < 0);
    headline.append(
      el("span", "Annual cash flow after reserve & debt"),
      el("strong", usd.format(r.cashFlowAnnual)),
    );
    output.append(headline);
    const dl = el("dl", undefined, "estate-ledger");
    for (const [label, value] of [
      ["Effective gross income", usd.format(r.effectiveGrossIncomeAnnual)],
      ["Operating expenses", usd.format(r.operatingExpensesAnnual)],
      ["Net operating income", usd.format(r.noiAnnual)],
      ["Replacement reserve", usd.format(r.reservesAnnual)],
      ["Debt service · principal + interest", usd.format(r.debtServiceAnnual)],
      ["Initial equity required", usd.format(r.equityRequired)],
      ["Cap rate · NOI / price", pct(r.capRate)],
      ["Cash-on-cash", pct(r.cashOnCash)],
      [
        "DSCR · NOI / debt service",
        r.dscr === null ? "—" : `${r.dscr.toFixed(2)}×`,
      ],
      ["Break-even occupancy", pct(r.breakEvenOccupancy)],
    ]) {
      const row = el("div");
      row.append(el("dt", label), el("dd", value));
      dl.append(row);
    }
    output.append(dl);
    const sensitivity = el("div", undefined, "estate-sensitivity");
    sensitivity.append(
      el("h4", "Rent sensitivity"),
      el("p", "All other assumptions held fixed.", "small-note"),
    );
    const grid = el("div", undefined, "estate-sensitivity-grid");
    for (const multiplier of [0.9, 1, 1.1]) {
      const card = el("div");
      card.append(
        el(
          "span",
          `${multiplier === 1 ? "Base" : multiplier < 1 ? "−10%" : "+10%"} rent`,
        ),
      );
      try {
        const scenario =
          multiplier === 1
            ? r
            : calculateProForma({
                ...r.assumptions,
                rentMonthly: r.assumptions.rentMonthly * multiplier,
              });
        card.append(
          el("strong", usd.format(scenario.cashFlowAnnual)),
          el("small", "annual cash flow"),
        );
      } catch {
        card.append(
          el("strong", "Unavailable"),
          el("small", "Outside numeric range"),
        );
      }
      grid.append(card);
    }
    sensitivity.append(grid);
    output.append(sensitivity);
    const evidence = {
      label: $("estate-selection").textContent,
      scenarioKind,
      illustrative: scenarioKind.startsWith("illustrative"),
      selectedListing: selected ? structuredClone(selected) : null,
      selectedMapPoint: selectedMapPoint ? { ...selectedMapPoint } : null,
      importFile: selected ? inputName || null : null,
      importIssues: selected ? structuredClone(importIssues) : [],
      result: r,
      limitations: [
        "Imported source dates do not establish current availability.",
        "No complete citywide listing inventory or coverage percentage.",
        "OSM footprints are not verified legal parcels.",
        "A selected map coordinate is a location, not a verified parcel or listing.",
        "Scenario arithmetic is not a forecast or appraisal.",
        ...(scenarioKind.startsWith("illustrative")
          ? [
              "Illustrative inputs are invented for demonstrating arithmetic and do not describe a real property or market terms.",
            ]
          : []),
      ],
    };
    const exportButton = el(
      "button",
      "Download scenario & evidence ↓",
      "secondary-button wide",
    );
    exportButton.type = "button";
    exportButton.addEventListener("click", () => {
      if (result !== r) return;
      const payload = {
        schema: "st-louis-rental-scenario-v1",
        exportedAt: new Date().toISOString(),
        ...evidence,
      };
      const url = URL.createObjectURL(
          new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
          }),
        ),
        a = el("a");
      a.href = url;
      a.download = "st-louis-property-scenario.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    output.append(exportButton);
  }
  $("estate-form").addEventListener("submit", (event) => {
    event.preventDefault();
    calculate();
  });
  return {
    refreshMarkers,
    selectPoint(point) {
      if (
        !point ||
        !Number.isFinite(point.latitude) ||
        !Number.isFinite(point.longitude) ||
        Math.abs(point.latitude) > 90 ||
        Math.abs(point.longitude) > 180
      )
        return;
      reset();
      selectedMapPoint = {
        longitude: point.longitude,
        latitude: point.latitude,
      };
      if (Number.isFinite(point.height)) selectedMapPoint.height = point.height;
      scenarioKind = "map-location";
      onOpen();
      $("estate-selection").textContent = "Selected map location";
      $("estate-selected-source").textContent =
        `${Math.abs(point.latitude).toFixed(5)}° ${point.latitude < 0 ? "S" : "N"}, ${Math.abs(point.longitude).toFixed(5)}° ${point.longitude < 0 ? "W" : "E"}. Location only; no parcel, availability or value has been verified.`;
    },
  };
}
