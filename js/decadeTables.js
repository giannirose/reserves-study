/**
 * decadeTables.js
 *
 * Shared helper for splitting a "one column per study year" table into
 * stacked tables of decadeSize years each, in natural sequence (years 1-10,
 * 11-20, 21-30, ...). Used by currentCost.js, expenditures.js, and
 * fullyFunded.js so all three pages split decades identically and only need
 * to supply their own per-row rendering logic.
 *
 * No calculation logic and no knowledge of components/categories/totals
 * lives here — purely DOM scaffolding, loaded before each page's own script.
 */

(function () {
  const DEFAULT_DECADE_SIZE = 10;

  /**
   * Splits [studyStartYear, studyStartYear + studyLengthYears - 1] into
   * consecutive chunks of decadeSize years (the last chunk may be shorter
   * if studyLengthYears isn't an exact multiple of decadeSize). Returns an
   * array of { startYear, endYear, years: number[] }, in natural order.
   */
  function splitIntoDecades(studyStartYear, studyLengthYears, decadeSize = DEFAULT_DECADE_SIZE) {
    const decades = [];
    for (let offset = 0; offset < studyLengthYears; offset += decadeSize) {
      const startYear = studyStartYear + offset;
      const count = Math.min(decadeSize, studyLengthYears - offset);
      const years = Array.from({ length: count }, (_, i) => startYear + i);
      decades.push({ startYear, endYear: startYear + count - 1, years });
    }
    return decades;
  }

  /**
   * Renders one <table class="decade-table"> per decade into `container`
   * (clearing any existing content first), in natural sequence. For each
   * decade, calls buildBody(decade, table) — the caller is responsible for
   * appending its own <thead>/<tbody> into that table using decade.years.
   * This keeps ALL calculation/category-grouping/totals logic in the
   * calling page's own script; this module only owns the decade-splitting
   * and per-decade <table>/<caption> scaffolding, identically across pages.
   */
  function renderDecadeTables(container, studyStartYear, studyLengthYears, buildBody, options = {}) {
    const decadeSize = options.decadeSize ?? DEFAULT_DECADE_SIZE;
    const captionPrefix = options.captionPrefix ?? "Years";

    container.innerHTML = "";
    const decades = splitIntoDecades(studyStartYear, studyLengthYears, decadeSize);

    for (const decade of decades) {
      const table = document.createElement("table");
      table.className = "decade-table";

      const caption = document.createElement("caption");
      caption.textContent = `${captionPrefix} ${decade.startYear}\u2013${decade.endYear}`;
      table.appendChild(caption);

      buildBody(decade, table);
      container.appendChild(table);
    }

    return decades;
  }

  window.DecadeTables = { splitIntoDecades, renderDecadeTables };
})();