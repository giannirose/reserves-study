/**
 * currentCost.ts
 *
 * Page-specific script for currentCost.html.
 * Renders a series of stacked tables, one per 10-year decade of the study
 * (years 1-10, 11-20, 21-30, in natural sequence), via the shared
 * DecadeTables helper (decadeTables.js). Within each decade table: one row
 * per component (grouped under category heading rows), one column per year
 * in that decade. Each populated cell shows that component's cost inflated
 * to that specific year, but ONLY for years where that figure is still
 * meaningful:
 *   - "not yet priced" components show a dash, since there's no known cost
 *     to inflate.
 *   - "one-time" components whose single scheduled service year has already
 *     passed also show a dash — they've been serviced, so there's no
 *     future replacement cost left to track (see
 *     reserves-engine.js's isOneTimeItemDischarged). These are likewise
 *     excluded from the totals row, and from Cash Flow's "Current Cost"
 *     column (getCurrentCostTotalForYear), so the figure shown here and on
 *     Cash Flow can never drift apart.
 * Scheduled cells (the year a component is actually due) are highlighted
 * via the .scheduled-cell class so a reviewer can scan a row and see at a
 * glance when a component is due.
 *
 * No calculation logic lives here — only fetching and DOM rendering.
 * Decade-splitting/table-scaffolding lives in decadeTables.js, shared with
 * expenditures.js and fullyFunded.js so all three pages split identically.
 */
// ---------------------------------------------------------------------------
// Page script
// ---------------------------------------------------------------------------
(function () {
    const TABLES_CONTAINER_ID = "currentCostTables";
    const HEADING_ID = "pageHeading";
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    });
    function formatCurrency(value) {
        return currencyFormatter.format(value);
    }
    function renderLoadingState(message) {
        const el = document.getElementById(TABLES_CONTAINER_ID);
        if (!el)
            return;
        el.innerHTML = `<p>${message}</p>`;
    }
    function renderErrorState(message) {
        const el = document.getElementById(TABLES_CONTAINER_ID);
        if (!el)
            return;
        el.innerHTML = `<p class="error">${message}</p>`;
    }
    function buildHeaderRow(years) {
        const tr = document.createElement("tr");
        const descTh = document.createElement("th");
        descTh.scope = "col";
        descTh.textContent = "Description";
        tr.appendChild(descTh);
        for (const year of years) {
            const th = document.createElement("th");
            th.scope = "col";
            th.textContent = String(year);
            tr.appendChild(th);
        }
        return tr;
    }
    function buildCategoryHeadingRow(categoryName, columnCount) {
        const tr = document.createElement("tr");
        const th = document.createElement("th");
        th.scope = "colgroup";
        th.colSpan = columnCount;
        th.className = "category-heading-row";
        th.textContent = categoryName;
        tr.appendChild(th);
        return tr;
    }
    /**
     * Builds one row for a single component within a single decade. Unlike
     * the Expenditures page (which will show only the years money actually
     * moves), Current Cost populates every NON-discharged year with what that
     * component would cost if replaced in that specific year — i.e. its full
     * inflation trajectory. A discharged one-time item (already serviced)
     * shows a dash instead, same as an unpriced component, since there's
     * nothing left to project for it.
     */
    function buildComponentRow(component, settings, years) {
        var _a;
        const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
        const costBaseYear = (_a = settings.unitCostYear) !== null && _a !== void 0 ? _a : studyStartYear;
        const studyEndYear = studyStartYear + studyLengthYears - 1;
        const scheduledYears = window.ReservesEngine.getAllScheduledYears(component, studyStartYear, studyEndYear);
        const scheduledYearSet = new Set(scheduledYears);
        const tr = document.createElement("tr");
        const descriptionCell = document.createElement("th");
        descriptionCell.scope = "row";
        descriptionCell.textContent = component.name;
        tr.appendChild(descriptionCell);
        const currentCost = window.ReservesEngine.getCurrentCost(component);
        const hasKnownCost = currentCost !== null;
        for (const year of years) {
            const td = document.createElement("td");
            const isDischarged = window.ReservesEngine.isOneTimeItemDischarged(component, year);
            if (isDischarged) {
                td.textContent = "—"; // already serviced — no longer tracked
            }
            else if (hasKnownCost) {
                const yearsOut = year - costBaseYear; // inflate from the year costs were gathered
                // const inflatedCost = window.ReservesEngine.inflateCost(currentCost, generalInflationRatePercent, yearsOut);
                const inflatedCost = window.ReservesEngine.inflateCost(
                    currentCost, effectiveInflationRate(component, generalInflationRatePercent), yearsOut);
                td.textContent = formatCurrency(inflatedCost);  
            }
            else {
                td.textContent = "—"; // not yet priced
            }
            if (scheduledYearSet.has(year)) {
                td.classList.add("scheduled-cell");
            }
            tr.appendChild(td);
        }
        return tr;
    }

    function buildCategorySubtotalRow(category, categoryGroups, settings, years, fmt) {
    const { generalInflationRatePercent } = settings;
    const costBaseYear = settings.unitCostYear ?? settings.studyStartYear;
    const tr = document.createElement("tr");
    tr.className = "category-subtotal-row";

    const th = document.createElement("th");
    th.scope = "row";
    th.textContent = `${category} Subtotal`;
    tr.appendChild(th);

    const cg = categoryGroups.find(g => g.category === category);
    years.forEach(year => {
        const td = document.createElement("td");
        const subtotal = cg.components.reduce((sum, component) => {
            const currentCost = window.ReservesEngine.getCurrentCost(component);
            if (currentCost === null) return sum;
            const isDischarged = window.ReservesEngine.isOneTimeItemDischarged(component, year);
            if (isDischarged) return sum;
            return sum + window.ReservesEngine.inflateCost(
                currentCost, generalInflationRatePercent, year - costBaseYear
            );
        }, 0);
        td.textContent = fmt.format(subtotal);
        tr.appendChild(td);
    });
    return tr;
}
    /**
     * Builds the totals row for ONE decade: for each year in `years`, the sum
     * of every component's inflated cost for that year. Delegates entirely to
     * getCurrentCostTotalForYear — the same function Cash Flow's "Current
     * Cost" column calls — so the two pages can never drift out of sync, and
     * so the unpriced/discharged exclusion rules only ever live in one place.
     */
    function buildTotalsRow(categoryGroups, settings, years) {
        var _a;
        const { studyStartYear, generalInflationRatePercent } = settings;
        const costBaseYear = (_a = settings.unitCostYear) !== null && _a !== void 0 ? _a : studyStartYear;
        const allComponents = categoryGroups.flatMap((group) => group.components);
        const tr = document.createElement("tr");
        tr.className = "totals-row";
        const labelCell = document.createElement("th");
        labelCell.scope = "row";
        labelCell.textContent = "Total";
        tr.appendChild(labelCell);
        for (const year of years) {
            const total = window.ReservesEngine.getCurrentCostTotalForYear(allComponents, year, costBaseYear, generalInflationRatePercent);
            const td = document.createElement("td");
            td.textContent = formatCurrency(total);
            tr.appendChild(td);
        }
        return tr;
    }
    function renderHeading(settings) {
        const heading = document.getElementById(HEADING_ID);
        if (heading && settings.associationName) {
            heading.textContent = `Current Cost — ${settings.associationName}`;
        }
    }
    async function fetchJson(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
function renderTables(categoryGroups, settings) {
    const container = document.getElementById(TABLES_CONTAINER_ID);
    if (!container) return;
    if (categoryGroups.length === 0) {
        renderErrorState("No component data available.");
        return;
    }
    const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
    const costBaseYear = settings.unitCostYear ?? studyStartYear;
    const studyEndYear = studyStartYear + studyLengthYears - 1;
    const allYears = [];
    for (let y = studyStartYear; y <= studyEndYear; y++) allYears.push(y);

    const fmt = new Intl.NumberFormat("en-US", {
        style: "currency", currency: "USD", maximumFractionDigits: 0
    });

    const yearTotals = new Array(allYears.length).fill(0);
    const exportRows = [["Component", ...allYears.map(String)]];

    for (const cg of categoryGroups) {
        const categoryTotals = new Array(allYears.length).fill(0);
        exportRows.push([cg.category, ...new Array(allYears.length).fill("")]);

        for (const component of cg.components) {
            const currentCost = window.ReservesEngine.getCurrentCost(component);
            const hasKnownCost = currentCost !== null;
            const yearValues = allYears.map((year, i) => {
                const isDischarged = window.ReservesEngine.isOneTimeItemDischarged(component, year);
                if (isDischarged || !hasKnownCost) return "—";
                const inflatedCost = window.ReservesEngine.inflateCost(
                    currentCost, generalInflationRatePercent, year - costBaseYear
                );
                yearTotals[i] += inflatedCost;
                categoryTotals[i] += inflatedCost;
                return fmt.format(inflatedCost);
            });
            exportRows.push([component.name, ...yearValues]);  // ← was inside map(), now after it
        }

        exportRows.push([`${cg.category} Subtotal`, ...categoryTotals.map(t => fmt.format(t))]);
    }
    exportRows.push(["Total", ...yearTotals.map(t => fmt.format(t))]);

    window._exportData = { rows: exportRows };
    // ... rest of renderTables (DecadeTables call etc.)

window.DecadeTables.renderDecadeTables(container, settings.studyStartYear, settings.studyLengthYears, (decade, table) => {
    const thead = document.createElement("thead");
    thead.appendChild(buildHeaderRow(decade.years));
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const categoryGroup of categoryGroups) {
        tbody.appendChild(buildCategoryHeadingRow(categoryGroup.category, decade.years.length + 1));
        for (const component of categoryGroup.components) {
            tbody.appendChild(buildComponentRow(component, settings, decade.years));
        }
        tbody.appendChild(buildCategorySubtotalRow(categoryGroup.category, categoryGroups, settings, decade.years, fmt));
    }                                                          // ← closes for loop
    tbody.appendChild(buildTotalsRow(categoryGroups, settings, decade.years));
    table.appendChild(tbody);
}, { captionPrefix: "Projected Cost by Component — Years" });
}  // ← renderTables closes HERE
       async function init() { 
        renderLoadingState("Loading current cost data…");
        if (typeof window.DecadeTables === "undefined") {
            renderErrorState("Decade table helper failed to load. Check that decadeTables.js is loaded before currentCost.js.");
            return;
        }
        if (typeof window.ReservesEngine === "undefined") {
            renderErrorState("Calculation engine failed to load. Check that reserves-engine.js is loaded before currentCost.js.");
            return;
        }
        let settings;
        let componentsData;
        try {
            [settings, componentsData] = await Promise.all([
                fetchJson("./settings.json"),
                fetchJson("./components.json"),
            ]);
        }
        catch (err) {
            console.error(err);
            renderErrorState("Could not load settings.json or components.json. Check the file paths and that the JSON is valid.");
            return;
        }
        renderHeading(settings);
        let categoryGroups;
        try {
            // Unfunded components are listed on Categorized Components and at the end of the report, not here
            categoryGroups = window.ReservesEngine.groupComponentsByCategory(componentsData.components.filter(window.ReservesEngine.isFunded));
        }
        catch (err) {
            console.error(err);
            renderErrorState("An error occurred while grouping components by category.");
            return;
        }
        renderTables(categoryGroups, settings);
    }
    document.addEventListener("DOMContentLoaded", init);
})();

