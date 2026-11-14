(function () {
    const TABLES_CONTAINER_ID = "expendituresTables";
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
     * Builds one row for a single component within a single decade. Cells are
     * populated (and highlighted) only for years the component is actually
     * scheduled; all other cells are left blank, since a blank cell here
     * correctly means "no expenditure this year." Scheduling lookups still use
     * the STUDY's full studyStartYear/studyEndYear, not the decade's own
     * window, since a component's schedule doesn't reset per decade.
     */
    function buildComponentRow(component, settings, years) {
        var _a;
        const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
        const studyEndYear = studyStartYear + studyLengthYears - 1;
        const scheduledYears = window.ReservesEngine.getAllScheduledYears(component, studyStartYear, studyEndYear);
        const scheduledYearSet = new Set(scheduledYears);
        const costBaseYear = (_a = settings.unitCostYear) !== null && _a !== void 0 ? _a : studyStartYear;
        const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
        const tr = document.createElement("tr");
        const descriptionCell = document.createElement("th");
        descriptionCell.scope = "row";
        descriptionCell.textContent = component.name;
        tr.appendChild(descriptionCell);
        const currentCost = window.ReservesEngine.getCurrentCost(component);
        const hasKnownCost = currentCost !== null;
        for (const year of years) {
            const td = document.createElement("td");
            if (scheduledYearSet.has(year)) {
                if (hasKnownCost) {
                 const yearsOut = year - costBaseYear;
                const inflatedCost = window.ReservesEngine.inflateCost(
        currentCost, window.ReservesEngine.effectiveInflationRate(component, generalInflationRatePercent), year - costBaseYear
    );
    td.textContent = fmt.format(inflatedCost);  // ← this line is missing
            
                            }
                            
                else {
                    td.textContent = "—"; // scheduled, but not yet priced
                }
                td.classList.add("scheduled-cell");
            }
            tr.appendChild(td);
        }
        return tr;
    }


function buildExpendituresCategorySubtotalRow(category, categoryGroups, settings, years, fmt) {
    const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
    const studyEndYear = studyStartYear + studyLengthYears - 1;
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
            const scheduledYears = window.ReservesEngine.getAllScheduledYears(component, studyStartYear, studyEndYear);  // ← all 3 args
            if (!scheduledYears.includes(year)) return sum;
            return sum + window.ReservesEngine.inflateCost(
                currentCost, generalInflationRatePercent, year - costBaseYear
            );
        }, 0);
        td.textContent = subtotal > 0 ? fmt.format(subtotal) : "";
        tr.appendChild(td);
    });
    return tr;
}
    /**
     * Builds the totals row for ONE decade: for each year in `years`, the sum
     * of every scheduled component's inflated cost that year. This is the
     * same figure as Cash Flow's "Annual Expenditure" column for that year —
     * both call getExpendituresForYear, so the pages can never drift out of
     * sync. studyEndYear passed to getExpendituresForYear is always the
     * STUDY's end year, not the decade's, since scheduling spans the whole
     * study regardless of which decade is currently being rendered.
     */
    function buildTotalsRow(categoryGroups, settings, years) {
        var _a;
        const { studyStartYear, studyLengthYears, generalInflationRatePercent } = settings;
        const studyEndYear = studyStartYear + studyLengthYears - 1;
        const allComponents = categoryGroups.flatMap((group) => group.components);
        const tr = document.createElement("tr");
        tr.className = "totals-row";
        const labelCell = document.createElement("th");
        labelCell.scope = "row";
        labelCell.textContent = "Total";
        tr.appendChild(labelCell);
        const costBaseYear = (_a = settings.unitCostYear) !== null && _a !== void 0 ? _a : studyStartYear;
        for (const year of years) {
            const { total } = window.ReservesEngine.getExpendituresForYear(allComponents, year, studyStartYear, studyEndYear, costBaseYear, generalInflationRatePercent);
            const td = document.createElement("td");
            td.textContent = formatCurrency(total);
            tr.appendChild(td);
        }
        return tr;
    }
    function renderHeading(settings) {
        const heading = document.getElementById(HEADING_ID);
        if (heading && settings.associationName) {
            heading.textContent = `Expenditures — ${settings.associationName}`;
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
            exportRows.push([cg.category]);
for (const component of cg.components) {
    const currentCost = window.ReservesEngine.getCurrentCost(component);
    const hasKnownCost = currentCost !== null;
    const yearValues = allYears.map((year, i) => {
        const isScheduled = window.ReservesEngine.getAllScheduledYears(component, studyStartYear, studyEndYear).includes(year);
        if (!isScheduled || !hasKnownCost) return "";
    const inflatedCost = window.ReservesEngine.inflateCost(
        currentCost, window.ReservesEngine.effectiveInflationRate(component, generalInflationRatePercent), year - costBaseYear
    );

        yearTotals[i] += inflatedCost;
        categoryTotals[i] += inflatedCost;
        return fmt.format(inflatedCost);
    });
    exportRows.push([component.name, ...yearValues]);
}
      exportRows.push([`${cg.category} Subtotal`, ...categoryTotals.map(t => fmt.format(t))]);
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
             tbody.appendChild(buildExpendituresCategorySubtotalRow(categoryGroup.category, categoryGroups, settings, decade.years, fmt));
            }
            tbody.appendChild(buildTotalsRow(categoryGroups, settings, decade.years));
            table.appendChild(tbody);
        }, { captionPrefix: "Projected Expenditures by Component — Years" });
    }
   
    async function init() {
        renderLoadingState("Loading expenditures data…");
        if (typeof window.DecadeTables === "undefined") {
            renderErrorState("Decade table helper failed to load. Check that decadeTables.js is loaded before expenditures.js.");
            return;
        }
        if (typeof window.ReservesEngine === "undefined") {
            renderErrorState("Calculation engine failed to load. Check that reserves-engine.js is loaded before expenditures.js.");
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

