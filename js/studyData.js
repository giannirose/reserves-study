/**
 * studyData.js
 *
 * Lets the existing pages (cashFlow, categorizedComponents, currentCost,
 * expenditures, fullyFunded) show a study that was uploaded as a workbook,
 * with no change to those pages' own scripts. Load it in each page's <head>,
 * before any other script.
 *
 * Each page fetches ./settings.json, ./components.json and (Cash Flow only)
 * ./duesContribution.json and ./forceInterest.json. When uploaded study data
 * is available, those four requests are answered from it; every other
 * request goes to the network as usual.
 *
 * Where the uploaded data comes from, in order:
 *   1. The upload page that embeds this page (window.parent.__reservesStudyData)
 *   2. localStorage, but ONLY when the URL has ?source=upload — so a stale
 *      upload can never replace a real study's JSON files on the same site.
 * With neither, the page reads the real JSON files exactly as before.
 */
(function () {
  const STORAGE_KEY = "reservesStudy.actual.v1";
  const FILE_TO_KEY = {
    "settings.json": "settings",
    "components.json": "components",
    "duesContribution.json": "duesContribution",
    "forceInterest.json": "forceInterest",
  };

  function findStudy() {
    try {
      if (window.parent !== window && window.parent.__reservesStudyData) {
        return window.parent.__reservesStudyData;
      }
    } catch (e) { /* parent on another origin — ignore */ }
    if (new URLSearchParams(location.search).get("source") === "upload") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* storage blocked or unreadable */ }
    }
    return null;
  }

  const study = findStudy();
  window.ReservesStudyData = { STORAGE_KEY, study };
  if (!study) return;

  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    const file = url.split(/[?#]/)[0].split("/").pop();
    const key = FILE_TO_KEY[file];
    if (key && study[key] !== undefined && study[key] !== null) {
      return Promise.resolve(new Response(JSON.stringify(study[key]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }
    return realFetch(input, init);
  };
})();
