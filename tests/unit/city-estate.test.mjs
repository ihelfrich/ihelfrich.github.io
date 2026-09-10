import test from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { createEstatePanel } from "../../src/scripts/city/city-estate.mjs";

const columns = [
  "listing_id",
  "address",
  "latitude",
  "longitude",
  "asking_price",
  "status",
  "source",
  "as_of",
  "parcel_id",
];
const record = (patch = {}) => ({
  listing_id: "SYNTHETIC-A",
  address: "1 Fictional Fixture Way",
  latitude: "38.628",
  longitude: "-90.193",
  asking_price: "250000",
  status: "active",
  source: "Synthetic Test Feed",
  as_of: "2026-09-08",
  parcel_id: "FIXTURE-PARCEL-A",
  ...patch,
});
const quote = (value) =>
  /[",\r\n]/.test(String(value))
    ? `"${String(value).replaceAll('"', '""')}"`
    : String(value);
const csv = (rows) =>
  `${columns.join(",")}\r\n${rows.map((r) => columns.map((k) => quote(r[k] ?? "")).join(",")).join("\r\n")}\r\n`;
const assumptions = {
  purchasePrice: 125000,
  rehab: 10000,
  closingCosts: 5000,
  rentMonthly: 1500,
  otherIncomeMonthly: 100,
  vacancyPct: 5,
  operatingExpensesAnnual: 6000,
  capexReserveAnnual: 1200,
  ltvPct: 80,
  interestPct: 6,
  loanYears: 30,
};
const settle = () => new Promise((resolve) => setImmediate(resolve));

function fixture(t) {
  const window = new Window();
  const previousDocument = globalThis.document;
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  const blobs = [],
    markerCalls = [],
    flights = [];
  globalThis.document = window.document;
  URL.createObjectURL = (blob) => {
    blobs.push(blob);
    return `blob:synthetic-estate-${blobs.length}`;
  };
  URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {};
  const root = window.document.createElement("section");
  window.document.body.append(root);
  const city = {
    setListings(records, select) {
      markerCalls.push({ records, select });
    },
    flyTo(...values) {
      flights.push(values);
    },
  };
  const panel = createEstatePanel(root, { getCity: () => city });
  const $ = (id) => root.querySelector(`#estate-${id}`);
  const input = (name, value) => {
    $(name).value = String(value);
    $(name).dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  const fill = (values = assumptions) => {
    for (const [key, value] of Object.entries(values)) input(key, value);
  };
  const submit = () =>
    $("form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
  const importFile = async (text, name = "synthetic-fixture.csv") => {
    const file =
      typeof text === "string"
        ? {
            name,
            size: new TextEncoder().encode(text).length,
            text: async () => text,
          }
        : text;
    Object.defineProperty($("file"), "files", {
      configurable: true,
      value: [file],
    });
    $("file").dispatchEvent(new window.Event("change", { bubbles: true }));
    await settle();
  };
  const download = async () => {
    const button = $("results").querySelector("button");
    assert.ok(button, "A successful scenario must expose an evidence export");
    button.click();
    return JSON.parse(await blobs.at(-1).text());
  };
  t.after(async () => {
    await window.happyDOM.abort();
    globalThis.document = previousDocument;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });
  return {
    window,
    root,
    panel,
    $,
    input,
    fill,
    submit,
    importFile,
    download,
    blobs,
    markerCalls,
    flights,
  };
}

test("UI keeps pending transitions and duplicate identities out of active asking volume", async (t) => {
  const f = fixture(t);
  const rows = [
    record({ as_of: "2026-09-07" }),
    record({ status: "pending", asking_price: "260000" }),
    record({
      listing_id: "SYNTHETIC-B",
      asking_price: "300000",
      parcel_id: "SHARED-PARCEL",
    }),
    record({
      listing_id: "SYNTHETIC-B",
      asking_price: "300000",
      parcel_id: "SHARED-PARCEL",
    }),
    record({
      listing_id: "SYNTHETIC-C",
      asking_price: "350000",
      parcel_id: "SHARED-PARCEL",
    }),
  ];
  await f.importFile(csv(rows));
  assert.match(f.$("feed-label").textContent, /^3 imported records/);
  assert.match(f.$("totals").textContent, /\$650,000/);
  assert.equal(f.markerCalls.at(-1).records.length, 2);
  assert.match(f.$("coverage").textContent, /Repeated parcel IDs/);
  f.input("status", "pending");
  assert.equal(f.markerCalls.at(-1).records.length, 1);
  assert.equal(f.markerCalls.at(-1).records[0].status, "pending");
  assert.match(f.$("totals").textContent, /\$0/);
  assert.doesNotMatch(f.$("coverage").textContent, /Repeated parcel IDs/);
});

test("a unique parcel has no duplicate warning and imported HTML stays literal", async (t) => {
  const f = fixture(t);
  const address = '<img src=x onerror="globalThis.injected=true">';
  await f.importFile(
    csv([record({ address, source: "<script>throw 1</script>" })]),
  );
  assert.doesNotMatch(f.$("coverage").textContent, /Repeated parcel IDs/);
  assert.equal(f.root.querySelector("img"), null);
  assert.equal(f.root.querySelector("script"), null);
  assert.ok(f.$("list").textContent.includes(address));
  f.$("list").querySelector("button").click();
  assert.equal(f.$("selection").textContent, address);
  assert.equal(f.flights.length, 1);
});

test("blank scenario fields are rejected instead of converted to zero", (t) => {
  const f = fixture(t);
  f.$("example").click();
  assert.equal(f.$("results").hidden, false);
  f.input("operatingExpensesAnnual", "");
  f.submit();
  assert.equal(f.$("results").hidden, true);
  assert.match(f.$("error").textContent, /Annual operating costs/);
  assert.equal(f.$("results").querySelector("button"), null);
});

test("illustrative exports explicitly identify invented inputs, including after edits", async (t) => {
  const f = fixture(t);
  f.$("example").click();
  let evidence = await f.download();
  assert.equal(evidence.illustrative, true);
  assert.equal(evidence.scenarioKind, "illustrative");
  assert.equal(evidence.selectedListing, null);
  assert.equal(evidence.selectedMapPoint, null);
  assert.ok(evidence.limitations.some((s) => /invented/.test(s)));
  f.input("rentMonthly", 2800);
  f.submit();
  evidence = await f.download();
  assert.equal(evidence.scenarioKind, "illustrative-modified");
  assert.equal(evidence.illustrative, true);
  assert.equal(evidence.result.assumptions.rentMonthly, 2800);
});

test("new listing, map selection and reset cannot retain a different site scenario", async (t) => {
  const f = fixture(t);
  await f.importFile(
    csv([
      record(),
      record({
        listing_id: "SYNTHETIC-B",
        address: "2 Fictional Fixture Way",
        asking_price: "400000",
        parcel_id: "FIXTURE-PARCEL-B",
      }),
    ]),
  );
  f.$("example").click();
  const staleExport = f.$("results").querySelector("button");
  f.$("list").querySelector("button").click();
  assert.equal(f.$("purchasePrice").value, "250000");
  assert.equal(f.$("rentMonthly").value, "");
  assert.equal(f.$("results").hidden, true);
  staleExport.click();
  assert.equal(f.blobs.length, 0);
  f.fill();
  f.submit();
  const listingEvidence = await f.download();
  assert.equal(listingEvidence.selectedListing.listingId, "SYNTHETIC-A");
  assert.equal(listingEvidence.illustrative, false);
  f.$("list").querySelectorAll("button")[1].click();
  assert.equal(f.$("purchasePrice").value, "400000");
  assert.equal(f.$("rehab").value, "");
  const point = { longitude: -90.21234, latitude: 38.64123, height: 143.75 };
  f.panel.selectPoint(point);
  point.height = 999;
  assert.equal(f.$("purchasePrice").value, "");
  f.fill();
  f.submit();
  const mapEvidence = await f.download();
  assert.deepEqual(mapEvidence.selectedMapPoint, {
    longitude: -90.21234,
    latitude: 38.64123,
    height: 143.75,
  });
  assert.equal(mapEvidence.selectedListing, null);
  assert.equal(mapEvidence.importFile, null);
  assert.equal(mapEvidence.scenarioKind, "map-location");
  f.$("reset").click();
  f.fill();
  f.submit();
  const manualEvidence = await f.download();
  assert.equal(manualEvidence.selectedMapPoint, null);
  assert.equal(manualEvidence.scenarioKind, "manual");
});

test("invalid CSV retains current dataset and scenario; valid replacement clears context", async (t) => {
  const f = fixture(t);
  await f.importFile(csv([record()]), "first.csv");
  f.$("list").querySelector("button").click();
  f.fill();
  f.submit();
  await f.importFile(csv([record({ latitude: "" })]), "bad.csv");
  assert.match(f.$("feed-label").textContent, /first.csv/);
  assert.match(
    f.$("import-status").textContent,
    /previous dataset and scenario are unchanged/,
  );
  assert.equal(f.$("results").hidden, false);
  assert.equal((await f.download()).importFile, "first.csv");
  await f.importFile(
    csv([record({ listing_id: "NEW", asking_price: "500000" })]),
    "new.csv",
  );
  assert.match(f.$("feed-label").textContent, /new.csv/);
  assert.equal(f.$("purchasePrice").value, "");
  assert.equal(f.$("rentMonthly").value, "");
  assert.equal(f.$("results").hidden, true);
});

test("late file reads cannot replace a newer import or restore cleared records", async (t) => {
  const f = fixture(t);
  let finish;
  const slow = {
    name: "slow.csv",
    size: 100,
    text: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  };
  await f.importFile(slow);
  await f.importFile(csv([record({ listing_id: "NEW" })]), "new.csv");
  finish(csv([record({ listing_id: "OLD" })]));
  await settle();
  assert.match(f.$("feed-label").textContent, /new.csv/);
  assert.equal(f.markerCalls.at(-1).records[0].listingId, "NEW");
  await f.importFile(slow);
  f.$("clear").click();
  finish(csv([record({ listing_id: "RESTORED" })]));
  await settle();
  assert.equal(f.$("market").hidden, true);
  assert.equal(f.markerCalls.at(-1).records.length, 0);
});

test("invalid map points do not erase a valid scenario and hemispheres are accurate", async (t) => {
  const f = fixture(t);
  f.$("example").click();
  f.panel.selectPoint({ latitude: "", longitude: 0 });
  assert.equal(f.$("results").hidden, false);
  f.panel.selectPoint({ latitude: -12.3, longitude: 45.6, height: 0 });
  assert.match(
    f.$("selected-source").textContent,
    /12\.30000° S, 45\.60000° E/,
  );
  f.fill();
  f.submit();
  assert.equal((await f.download()).selectedMapPoint.height, 0);
});

test("overflowing import totals retain the previous dataset and computed scenario", async (t) => {
  const f = fixture(t);
  await f.importFile(csv([record()]), "first.csv");
  f.$("list").querySelector("button").click();
  f.fill();
  f.submit();
  await f.importFile(
    csv([
      record({ asking_price: "1e308" }),
      record({
        listing_id: "SYNTHETIC-B",
        asking_price: "1e308",
        parcel_id: "FIXTURE-PARCEL-B",
      }),
    ]),
    "overflow.csv",
  );
  assert.match(f.$("import-status").textContent, /overflows/);
  assert.match(f.$("feed-label").textContent, /first.csv/);
  assert.match(f.$("totals").textContent, /\$250,000/);
  assert.equal((await f.download()).importFile, "first.csv");
});

test("an out-of-range sensitivity case does not prevent the valid base export", async (t) => {
  const f = fixture(t);
  f.fill({
    purchasePrice: 1e307,
    rehab: 0,
    closingCosts: 0,
    rentMonthly: 1.4e307,
    otherIncomeMonthly: 0,
    vacancyPct: 0,
    operatingExpensesAnnual: 0,
    capexReserveAnnual: 0,
    ltvPct: 0,
    interestPct: 0,
    loanYears: 30,
  });
  f.submit();
  assert.equal(f.$("results").hidden, false);
  assert.match(f.$("results").textContent, /Outside numeric range/);
  const evidence = await f.download();
  assert.equal(evidence.result.assumptions.rentMonthly, 1.4e307);
  assert.ok(Number.isFinite(evidence.result.cashFlowAnnual));
});

test('official property evidence preserves entered price and cannot relabel a newer account', async(t)=>{
  const f=fixture(t),point={longitude:-90.2,latitude:38.6,recordKey:'fixture:A'};
  f.panel.selectPoint(point);f.fill();
  const evidence={point,parcels:{status:'found',parcel:{type:'Feature',properties:{recordKey:'fixture:A',parcelId:'A',address:'Synthetic Parcel A',assessedValueUSD:900000},geometry:null},source:{retrievedAt:'2026-09-08T00:00:00Z'}},zoning:{status:'unknown'},inventory:{status:'not-in-public-inventory',listings:[]}};
  assert.equal(f.panel.setPropertyEvidence(evidence),true);
  assert.equal(f.$('purchasePrice').value,String(assumptions.purchasePrice));
  f.submit();const payload=await f.download();
  assert.equal(payload.scenarioKind,'official-parcel');assert.equal(payload.selectedPropertyEvidence.parcel.properties.parcelId,'A');
  f.panel.selectPoint({...point,recordKey:'fixture:B'});
  assert.equal(f.panel.setPropertyEvidence(evidence),false);assert.equal(f.$('selection').textContent,'Selected map location');
  f.$('example').click();assert.equal(f.panel.setPropertyEvidence(evidence),false);
});
