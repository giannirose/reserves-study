(function () {
    const TABLES_CONTAINER_ID = "fullyFundedTables";
    const HEADING_ID = "pageHeading";
    const showOutOfScopeAmounts = window.ReservesEngine.SHOW_OUT_OF_SCOPE_AMOUNTS;
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
     * Builds one row for a single component within a single decade, showing
     * its accrued (fully funded) value as of each year in `years`. Years
     * where the component is scheduled for replacement (100% accrued) are
     * highlighted. A discharged one-time item (already serviced) shows a
     * dash instead of $0. Scheduling/discharge lookups still use the
     * STUDY's full studyStartYear/studyEndYear, not the decade's own window,
     * since a component's schedule doesn't reset per decade.
     */
    function buildComponentRow(component, settings, years) {
        var _a;
        const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
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
        const costBaseYear = (_a = settings.unitCostYear) !== null && _a !== void 0 ? _a : studyStartYear;
        for (const year of years) {
            const td = document.createElement("td");
            const isDischarged = window.ReservesEngine.isOneTimeItemDischarged(component, year);
            const isOutOfScope = window.ReservesEngine.isComponentOutOfScope(component, year, studyLengthYears);
            if (isDischarged) {
                td.textContent = "—"; // already serviced — no future obligation remains
            }
            else if (isOutOfScope) {
                td.textContent = "—"; // not yet within the funding horizon for this component's life
            }
            else if (hasKnownCost) {
                const accruedValue = window.ReservesEngine.getComponentFullyFundedContribution(component, year, studyStartYear, studyLengthYears, costBaseYear, generalInflationRatePercent);
                td.textContent = formatCurrency(accruedValue);
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

    function buildFullyFundedCategorySubtotalRow(category, categoryGroups, settings, years, fmt) {
    const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
    const costBaseYear = settings.unitCostYear ?? studyStartYear;
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
            const isOutOfScope = window.ReservesEngine.isComponentOutOfScope(component, year, studyLengthYears);
            if (isDischarged || isOutOfScope) return sum;
            return sum + window.ReservesEngine.getComponentFullyFundedContribution(
                component, year, studyStartYear, studyLengthYears, costBaseYear, generalInflationRatePercent
            );
        }, 0);
        td.textContent = fmt.format(subtotal);
        tr.appendChild(td);
    });
    return tr;
}
    /**
     * Builds the totals row for ONE decade: for each year in `years`, the sum
     * of every component's accrued (fully funded) value that year. This is
     * the same figure as Cash Flow's "Fully Funded" column for that year —
     * both call getFullyFundedBalanceForYear, so the pages can never drift
     * out of sync.
     */
    function buildTotalsRow(categoryGroups, settings, years) {
        var _a;
        const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
        const allComponents = categoryGroups.flatMap((group) => group.components);
        const tr = document.createElement("tr");
        tr.className = "totals-row";
        const labelCell = document.createElement("th");
        labelCell.scope = "row";
        labelCell.textContent = "Total";
        tr.appendChild(labelCell);
        const costBaseYear = (_a = settings.unitCostYear) !== null && _a !== void 0 ? _a : studyStartYear;
        for (const year of years) {
            const total = window.ReservesEngine.getFullyFundedBalanceForYear(allComponents, year, studyStartYear, studyLengthYears, costBaseYear, generalInflationRatePercent);
            const td = document.createElement("td");
            td.textContent = formatCurrency(total);
            tr.appendChild(td);
        }
        return tr;
    }
    function renderHeading(settings) {
        const heading = document.getElementById(HEADING_ID);
        if (heading && settings.associationName) {
            heading.textContent = `Fully Funded — ${settings.associationName}`;
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
        if (!container)
            return;
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
            const isOutOfScope  = window.ReservesEngine.isComponentOutOfScope(component, year, studyLengthYears);
            if (isDischarged || isOutOfScope || !hasKnownCost) return "";
            const val = window.ReservesEngine.getComponentFullyFundedContribution(
                component, year, studyStartYear, studyLengthYears,
                costBaseYear, generalInflationRatePercent
            );
             yearTotals[i] += val;   // ← accumulate raw number
            categoryTotals[i] += val;   // ← this line is missing
            return fmt.format(val);
            });
            exportRows.push([component.name, ...yearValues]);
  }
   exportRows.push([`${cg.category} Subtotal`, ...categoryTotals.map(t => fmt.format(t))]);  // ← add this
}
            exportRows.push(["Total", ...yearTotals.map(t => fmt.format(t))]);
            window._exportData = { rows: exportRows };
       
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
                tbody.appendChild(buildFullyFundedCategorySubtotalRow(categoryGroup.category, categoryGroups, settings, decade.years, fmt));
            }
            tbody.appendChild(buildTotalsRow(categoryGroups, settings, decade.years));
            table.appendChild(tbody);
        }, { captionPrefix: "Fully Funded Balance by Component — Years" });
    }
    async function init() {
        renderLoadingState("Loading fully funded data…");
        if (typeof window.DecadeTables === "undefined") {
            renderErrorState("Decade table helper failed to load. Check that decadeTables.js is loaded before fullyFunded.js.");
            return;
        }
        if (typeof window.ReservesEngine === "undefined") {
            renderErrorState("Calculation engine failed to load. Check that reserves-engine.js is loaded before fullyFunded.js.");
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
