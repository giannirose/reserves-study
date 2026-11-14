/**
 * upload.js — the upload page.
 *
 * ACTUAL version.
 * 1. Reads the uploaded workbook (Settings, Components, Dues Contribution,
 *    Force Interest tabs) in the browser with convertStudyWorkbook.js
 *    (nothing is sent to a server).
 * 2. Holds the result as window.__reservesStudyData = { settings, components,
 *    duesContribution, forceInterest } — the same shapes as the JSON files.
 * 3. Shows each existing study page in a tab (an <iframe>). Each page loads
 *    js/studyData.js, which answers its fetch("./settings.json") etc. from
 *    that data, so the pages' own scripts run unchanged.
 * 4. Builds the combined Excel workbook and the printable PDF report from the
 *    rendered pages, so every output shows exactly what the pages show.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "reservesStudy.actual.v1";   // must match js/studyData.js
  const EXAMPLE_WORKBOOK = "templates/Reserve_Study_Example_Filled.xlsx";
  const PAGES = [
    { id: "cashFlow", file: "cashFlow.html", title: "Cash Flow" },
    { id: "categorizedComponents", file: "categorizedComponents.html", title: "Categorized Components" },
    { id: "currentCost", file: "currentCost.html", title: "Current Cost" },
    { id: "expenditures", file: "expenditures.html", title: "Expenditures" },
    { id: "fullyFunded", file: "fullyFunded.html", title: "Fully Funded" },
  ];
  const SETTING_LABELS = [
    ["studyName", "Study Name"],
    ["associationName", "Association Name"],
    ["unitCostYear", "Study Planning Year"],
    ["studyStartYear", "Study Start Year"],
    ["studyLengthYears", "Study Length (Years)"],
    ["startingReserveBalance", "Starting Reserve Balance ($)"],
    ["startingAnnualContribution", "Starting Annual Contribution ($)"],
    ["generalInflationRatePercent", "General Inflation Rate (%)"],
    ["interestEarnedRatePercent", "Interest Earned Rate (%)"],
    ["interestTaxRatePercent", "Interest Tax Rate (%)"],
    ["fundingGoalType", "Funding Goal Type"],
    ["fullyFundedTargetPercent", "Fully Funded Target (%)"],
    ["currency", "Currency"],
    ["fiscalYearStartMonth", "Fiscal Year Start Month"],
    ["specialAssessmentAllowed", "Special Assessment Allowed"],
    ["loanAllowed", "Loan Allowed"],
    ["notes", "Notes"],
  ];

  const $ = (id) => document.getElementById(id);
  const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let study = null;
  let frames = {};
  let activePage = PAGES[0].id;

  // ---------------------------------------------------------------------------
  // Upload
  // ---------------------------------------------------------------------------
  function loadWorkbook(arrayBuffer, label) {
    $("fileName").textContent = label;
    $("results").hidden = true;
    let result;
    try {
      result = convertStudyWorkbook(new Uint8Array(arrayBuffer), XLSX, { type: "array" });
    } catch (err) {
      console.error(err);
      showMessages({ errors: ["This file could not be read as an Excel workbook. Save it as .xlsx and try again."] });
      return;
    }
    if (!result.ok) {
      showMessages({ errors: result.errors, warnings: result.warnings });
      return;
    }
    study = {
      settings: result.settings,
      components: result.components,
      duesContribution: result.duesContribution,
      forceInterest: result.forceInterest,
    };
    window.__reservesStudyData = study;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(study)); } catch (e) { /* only needed for "open in new tab" */ }
    showMessages({ warnings: result.warnings, notices: result.notices });
    renderSummary();
    renderJsonLinks();
    renderPages();
  }

  function readFile(file) {
    if (!file) return;
    if (!/\.xlsx?$/i.test(file.name)) {
      $("fileName").textContent = file.name;
      showMessages({ errors: ["Please upload an Excel workbook (.xlsx)."] });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => loadWorkbook(reader.result, file.name);
    reader.onerror = () => showMessages({ errors: ["The file could not be read."] });
    reader.readAsArrayBuffer(file);
  }

  async function loadExample() {
    try {
      const res = await fetch(EXAMPLE_WORKBOOK, { cache: "no-store" });   // always the file as saved now
      if (!res.ok) throw new Error(res.statusText);
      loadWorkbook(await res.arrayBuffer(), "Reserve_Study_Example_Filled.xlsx (example)");
    } catch (err) {
      showMessages({ errors: [`The example workbook could not be loaded (${err.message}).`] });
    }
  }

  // ---------------------------------------------------------------------------
  // Messages and summary
  // ---------------------------------------------------------------------------
  function showMessages({ errors = [], warnings = [], notices = [] }) {
    const box = $("messages");
    // Escape the text first, then turn the converter's name marks into italics
    const show = (m) => esc(m).replace(/\u0001/g, "<em>").replace(/\u0002/g, "</em>");
    const block = (cls, title, items) => items.length
      ? `<div class="message ${cls}"><h3>${title}</h3><ul>${items.map((m) => `<li>${show(m)}</li>`).join("")}</ul></div>`
      : "";
    box.innerHTML =
      block("error", "The workbook needs a few fixes. Correct these and upload it again:", errors) +
      block("warning", "Please check:", warnings) +
      block("notice", "For your information:", notices);
    box.hidden = !box.innerHTML;
  }

  function renderSummary() {
    const s = study.settings;
    const list = study.components.components;
    const categories = new Set(list.map((c) => c.category)).size;
    const items = [
      ["Components", `${list.length} in ${categories} ${categories === 1 ? "category" : "categories"}`],
      ["Unit costs priced in", s.unitCostYear],
      ["Study years", `${s.studyStartYear}–${s.studyStartYear + s.studyLengthYears - 1}`],
      ["Starting reserve balance", money.format(s.startingReserveBalance)],
      ["Starting annual contribution", money.format(s.startingAnnualContribution)],
      ["Inflation", `${s.generalInflationRatePercent}%`],
      ["Interest earned", `${s.interestEarnedRatePercent}% (taxed at ${s.interestTaxRatePercent}%)`],
      ["Forced contribution years", overrideSummary(study.duesContribution)],
      ["Forced interest years", overrideSummary(study.forceInterest)],
      ["Unfunded components", String(unfundedComponents().length || "None")],
    ];
    $("studySummary").innerHTML = items
      .map(([k, v]) => `<div class="item"><span class="label">${esc(k)}</span><span class="value">${esc(v)}</span></div>`)
      .join("");
  }

  function overrideSummary(file) {
    const years = Object.keys((file && file.overrides) || {});
    return years.length ? years.join(", ") : "None";
  }

  /** Links to save the four JSON files, e.g. to drop into a project folder. */
  function renderJsonLinks() {
    const box = $("jsonLinks");
    if (!box) return;
    box.querySelectorAll("a").forEach((a) => URL.revokeObjectURL(a.href));
    box.innerHTML = "<span>Save the study's data files:</span>";
    for (const name of ["settings", "components", "duesContribution", "forceInterest"]) {
      const blob = new Blob([JSON.stringify(study[name], null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.json`;
      a.textContent = `${name}.json`;
      box.appendChild(a);
    }
  }

  // ---------------------------------------------------------------------------
  // Page tabs
  // ---------------------------------------------------------------------------
  function renderPages() {
    const tabs = $("tabs");
    const host = $("frames");
    tabs.innerHTML = "";
    host.innerHTML = "";
    frames = {};

    for (const page of PAGES) {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.role = "tab";
      tab.id = `tab-${page.id}`;
      tab.textContent = page.title;
      tab.setAttribute("aria-controls", `frame-${page.id}`);
      tab.addEventListener("click", () => activate(page.id));
      tabs.appendChild(tab);

      const frame = document.createElement("iframe");
      frame.id = `frame-${page.id}`;
      frame.className = "page-frame";
      frame.title = page.title;
      frame.dataset.title = page.title;
      frame.src = page.file;            // loads js/studyData.js, which reads window.parent.__reservesStudyData
      frame.hidden = true;
      frame.addEventListener("load", () => {
        if (page.id === activePage) waitForPage(frame).then(() => fitFrame(frame)).catch(() => {});
      });
      host.appendChild(frame);
      frames[page.id] = frame;
    }
    $("results").hidden = false;
    activate(activePage);
  }

  function activate(pageId) {
    activePage = pageId;
    for (const page of PAGES) {
      const on = page.id === pageId;
      $(`tab-${page.id}`).setAttribute("aria-selected", String(on));
      frames[page.id].hidden = !on;
    }
    const page = PAGES.find((p) => p.id === pageId);
    $("openTab").href = `${page.file}?source=upload`;
    waitForPage(frames[pageId]).then(() => fitFrame(frames[pageId])).catch(() => {});
  }

  function fitFrame(frame) {
    const doc = frame.contentDocument;
    if (!doc || frame.hidden) return;
    frame.style.height = `${doc.documentElement.scrollHeight + 16}px`;
  }

  /** Resolves with the page's document once its tables have rendered. */
  function waitForPage(frame, timeoutMs = 15000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
      (function check() {
        let doc = null;
        try { doc = frame.contentDocument; } catch (e) { /* not ready */ }
        if (doc && doc.readyState === "complete" && doc.body && doc.location.href !== "about:blank") {
          const error = doc.querySelector(".error");
          if (error) return reject(new Error(`${frame.dataset.title}: ${error.textContent.trim()}`));
          const loading = /Loading/.test(doc.body.textContent.slice(0, 4000));
          if (doc.querySelector("table tbody tr") && !loading) return resolve(doc);
        }
        if (Date.now() - started > timeoutMs) return reject(new Error(`${frame.dataset.title} did not finish loading.`));
        setTimeout(check, 100);
      })();
    });
  }

  function allPagesReady() {
    return Promise.all(PAGES.map(async (p) => ({ page: p, doc: await waitForPage(frames[p.id]), win: frames[p.id].contentWindow })));
  }

  // ---------------------------------------------------------------------------
  // Excel: one workbook, a sheet per page plus the inputs
  // ---------------------------------------------------------------------------
  /** Turns a displayed value ("$1,234", "-$5", "210%", "3.00%", "2027") back into a typed Excel cell. */
  function toCell(raw) {
    if (raw === null || raw === undefined) return { v: null };
    if (typeof raw === "number") return { v: raw };
    const s = String(raw).replace(/\s+/g, " ").trim();
    if (!s) return { v: null };
    let m = s.match(/^(-?)\$([\d,]+(?:\.\d+)?)$/);
    if (m) {
      const n = Number(m[2].replace(/,/g, "")) * (m[1] ? -1 : 1);
      return { v: n, z: m[2].includes(".") ? '"$"#,##0.00' : '"$"#,##0;-"$"#,##0' };
    }
    m = s.match(/^(-?[\d,]*\.?\d+)%$/);
    if (m) return { v: Number(m[1].replace(/,/g, "")) / 100, z: m[1].includes(".") ? "0.00%" : "0%" };
    if (/^-?\d+$/.test(s)) return { v: Number(s) };
    if (/^-?[\d,]+(\.\d+)?$/.test(s)) return { v: Number(s.replace(/,/g, "")), z: s.includes(".") ? "#,##0.00" : "#,##0" };
    return { v: s };
  }

  /** Reads a rendered table into rows of text, spreading colspan cells across columns. */
  function tableRows(table) {
    const rows = [];
    table.querySelectorAll("thead tr, tbody tr").forEach((tr) => {
      const row = [];
      tr.querySelectorAll("th, td").forEach((cell) => {
        row.push(cell.textContent.replace(/\s+/g, " ").trim());
        for (let i = 1; i < (cell.colSpan || 1); i++) row.push("");
      });
      rows.push(row);
    });
    return rows;
  }

  function addSheet(wb, name, rows, firstColWidth = 38) {
    const width = Math.max(...rows.map((r) => r.length));
    const values = [];
    const formats = [];
    rows.forEach((r, ri) => {
      const vr = [];
      const fr = [];
      for (let ci = 0; ci < width; ci++) {
        const cell = ri === 0 ? { v: r[ci] === "" || r[ci] === undefined ? null : r[ci] } : toCell(r[ci]);
        vr.push(cell.v);
        fr.push(cell.z);
      }
      values.push(vr);
      formats.push(fr);
    });
    const ws = XLSX.utils.aoa_to_sheet(values);
    formats.forEach((fr, ri) => fr.forEach((z, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
      if (z && ws[addr]) ws[addr].z = z;
    }));
    ws["!cols"] = [{ wch: firstColWidth }, ...Array(Math.max(width - 1, 0)).fill({ wch: 14 })];
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  function settingsRows() {
    return [["Setting", "Value", "JSON Key"],
      ...SETTING_LABELS.map(([key, label]) => [label, study.settings[key], key])];
  }

  function componentRows() {
    const cols = typeof STUDY_COLUMNS !== "undefined" ? STUDY_COLUMNS : [];
    // Funding sits before Notes, as on the workbook's Components tab
    const labels = cols.map(([label]) => label);
    const at = labels.indexOf("Notes");
    const row = (c) => cols.map(([, key]) => c[key] ?? "");
    const funding = (c) => (c.funded === false ? "Unfunded" : "Funded");
    const insert = (arr, v) => (at === -1 ? [...arr, v] : [...arr.slice(0, at), v, ...arr.slice(at)]);
    return [insert(labels, "Funding"), ...study.components.components.map((c) => insert(row(c), funding(c)))];
  }

  function overrideRows(file, label) {
    return [["Year", label], ...Object.entries((file && file.overrides) || {}).map(([year, v]) =>
      [year, typeof v === "number" ? `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : v])];
  }

  function fileBase() {
    const s = study.settings;
    return `Reserve Study - ${s.associationName} - ${s.studyStartYear}`.replace(/[\\/:*?"<>|]/g, "");
  }

  async function exportExcel() {
    const wb = XLSX.utils.book_new();
    for (const { page, doc, win } of await allPagesReady()) {
      const rows = win._exportData && win._exportData.rows
        ? win._exportData.rows                       // decade pages: all study years in one table
        : tableRows(doc.querySelector("table"));
      addSheet(wb, page.title, rows);
    }
    addSheet(wb, "Settings", settingsRows(), 34);
    addSheet(wb, "Dues Contribution", overrideRows(study.duesContribution, "Forced Annual Contribution"), 14);
    addSheet(wb, "Force Interest", overrideRows(study.forceInterest, "Forced Interest Amount"), 14);
    const comp = componentRows();
    addSheet(wb, "Components", comp, 14);
    // Unit Cost keeps its cents
    const ws = wb.Sheets.Components;
    const costCol = comp[0].indexOf("Unit Cost ($)");
    for (let r = 1; r < comp.length && costCol >= 0; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: costCol })];
      if (cell) cell.z = '"$"#,##0.00';
    }
    XLSX.writeFile(wb, `${fileBase()}.xlsx`);
  }

  // ---------------------------------------------------------------------------
  // PDF: one printable report built from the rendered pages
  // ---------------------------------------------------------------------------

  function coverHtml() {
    const s = study.settings;
    const list = study.components.components;
    const rows = [
      ["Association", s.associationName],
      ["Study", s.studyName],
      ["Unit costs priced in (Study Planning Year)", s.unitCostYear],
      ["Study years", `${s.studyStartYear}–${s.studyStartYear + s.studyLengthYears - 1} (${s.studyLengthYears} years)`],
      ["Starting reserve balance", money.format(s.startingReserveBalance)],
      ["Starting annual contribution", money.format(s.startingAnnualContribution)],
      ["General inflation rate", `${s.generalInflationRatePercent}%`],
      ["Interest earned rate", `${s.interestEarnedRatePercent}%`],
      ["Interest tax rate", `${s.interestTaxRatePercent}%`],
      ["Components", `${list.length} in ${new Set(list.map((c) => c.category)).size} categories`],
      ["Forced contribution years", overrideSummary(study.duesContribution)],
      ["Forced interest years", overrideSummary(study.forceInterest)],
      ["Unfunded components", unfundedComponents().length ? `${unfundedComponents().length} (listed at the end)` : "None"],
    ];
    return `<section class="report-section report-cover">
      <h1>Reserve Study — ${esc(s.associationName)}</h1>
      <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="contents"><strong>Contents:</strong> ${[...PAGES.map((p) => p.title), ...(unfundedComponents().length ? ["Unfunded Components"] : [])].map(esc).join(" · ")}</div>
      <p class="fine">Prepared ${esc(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}
        from an uploaded study workbook. Inflation and interest rates are planning
        assumptions, not guarantees.</p>
    </section>`;
  }

  /** Unfunded components, grouped by category in the same order as Categorized Components. */
  function unfundedComponents() {
    return ((study && study.components && study.components.components) || []).filter((c) => c.funded === false);
  }

  function unfundedSectionHtml() {
    const list = unfundedComponents();
    if (!list.length) return "";
    const order = [...new Set(study.components.components.map((c) => c.category || "Uncategorized"))];
    const cost = (c) => (typeof c.unitCost === "number"
      ? money.format(c.unitCost * (c.quantity ?? 1) * (c.scopeFactor ?? 1)) : "Not priced");
    const rows = order.flatMap((cat) => {
      const items = list.filter((c) => (c.category || "Uncategorized") === cat);
      if (!items.length) return [];
      return [`<tr><th colspan="2" class="category-heading-row">${esc(cat)}</th></tr>`,
        ...items.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(cost(c))}</td></tr>`)];
    });
    return `<section class="report-section unfunded-section">
      <header><h1>Unfunded Components — ${esc(study.settings.associationName)}</h1></header>
      <p>These components are part of the association's property, but the association has chosen not to fund them
        from reserves. They are listed on Categorized Components for reference and are not included in Current Cost,
        Expenditures, Fully Funded or Cash Flow.</p>
      <table class="unfunded-table">
        <thead><tr><th scope="col">Name</th><th scope="col">Current Cost (${esc(study.settings.unitCostYear)} dollars)</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </section>`;
  }

async function buildReportHtml() {
    const pages = await allPagesReady();
    let printCss = "";
    try { printCss = await (await fetch("css/print.css")).text(); } catch (e) { }
    const sections = pages.map(({ doc }) => {
        const body = doc.body.cloneNode(true);
        body.querySelectorAll("script, .export-buttons, style, link[rel='stylesheet']").forEach((el) => el.remove());
        body.querySelectorAll("th, td").forEach(el => el.removeAttribute("style"));
        console.log("styles in cloned page:", body.querySelectorAll("style, link[rel='stylesheet']").length);
        return `<section class="report-section ${esc(doc.body.className)}">${body.innerHTML}</section>`;
    });
return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>${esc(fileBase())}</title>
  <style>${printCss}</style>
  <style>
    @page {
      @bottom-left {
        content: "Reserve Study — ${esc(study.settings.associationName)}";
      }
    }
  </style>
  </head>
  <body>${coverHtml()}${sections.join("")}${unfundedSectionHtml()}</body></html>`;
}

  async function printReport() {
    const html = await buildReportHtml();
    document.querySelectorAll(".print-frame").forEach((f) => f.remove());
    const frame = document.createElement("iframe");
    frame.className = "print-frame";
    frame.title = "Printable report";
    document.body.appendChild(frame);
    await new Promise((resolve) => {
      frame.onload = resolve;
      frame.srcdoc = html;
    });
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }

  // ---------------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------------
  async function runAction(button, label, fn) {
    const status = $("actionStatus");
    button.disabled = true;
    status.textContent = label;
    try {
      await fn();
      status.textContent = "";
    } catch (err) {
      console.error(err);
      status.textContent = `Could not finish: ${err.message}`;
    } finally {
      button.disabled = false;
    }
  }

  function init() {
    $("fileInput").addEventListener("change", (e) => { readFile(e.target.files[0]); e.target.value = ""; });
    $("exampleBtn").addEventListener("click", loadExample);
    $("excelBtn").addEventListener("click", (e) => runAction(e.currentTarget, "Building Excel workbook…", exportExcel));
    $("pdfBtn").addEventListener("click", (e) => runAction(e.currentTarget, "Preparing report…", printReport));

    const zone = $("dropZone");
    ["dragenter", "dragover"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.add("dragging"); }));
    ["dragleave", "drop"].forEach((t) => zone.addEventListener(t, (e) => { e.preventDefault(); zone.classList.remove("dragging"); }));
    zone.addEventListener("drop", (e) => readFile(e.dataTransfer.files[0]));
    window.addEventListener("resize", () => frames[activePage] && fitFrame(frames[activePage]));
  }

  // Exposed for testing and for later pages (e.g. a server-side PDF step)
  window.ReserveUpload = { loadWorkbook, buildReportHtml, exportExcel, waitForPage: (id) => waitForPage(frames[id]) };
  document.addEventListener("DOMContentLoaded", init);
})();
