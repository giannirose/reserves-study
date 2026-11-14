(function () {
    const TABLE_BODY_ID = "categorizedComponentsBody";
    const HEADING_ID = "pageHeading";
    const COLUMN_COUNT = 12; // Name, Item Type, Date in Service, Date in Service Cost, Useful Life,
    // Adjustment, Remaining Life, Replacement Year, Scope Factor, Quantity,
    // Unit Cost, Current Cost
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    });
    // Unit cost can include cents (e.g. pavement priced per sq-ft), so format
    // it with up to 2 decimal places rather than rounding to whole dollars.
    const unitCostFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    function formatCurrency(value) {
        return currencyFormatter.format(value);
    }
    function formatUnitCost(value) {
        if (value === null)
            return "—";
        return unitCostFormatter.format(value);
    }
    function formatItemType(itemType) {
        if (itemType === "one-time")
            return "One-Time";
        if (itemType === "recurring")
            return "Recurring";
        return itemType || "—";
    }
    function formatUsefulLife(component) {
        const years = component.usefulLifeYears;
        if (years === null)
            return "—";
        return `${years} yr${years === 1 ? "" : "s"}`;
    }
    function formatAdjustmentYears(adjustmentYears) {
        if (adjustmentYears === undefined || adjustmentYears === null)
            return "0 yrs";
        if (adjustmentYears > 0)
            return `+${adjustmentYears} yrs`;
        return `${adjustmentYears} yrs`;
    }
    function formatScopeFactor(scopeFactor) {
        const value = scopeFactor !== null && scopeFactor !== void 0 ? scopeFactor : 1;
        // Show as a plain decimal (e.g. 0.06), not a percent, since that's how
        // the source data and components.json schema represent it.
        return value.toString();
    }
    function formatQuantity(component) {
        var _a;
        const quantity = (_a = component.quantity) !== null && _a !== void 0 ? _a : 1;
        const unit = component.quantityUnit;
        return unit ? `${quantity.toLocaleString()} ${unit}` : quantity.toLocaleString();
    }
    /**
     * Negative Remaining Life is NOT clamped to 0. It is a deliberate signal
     * that a recurring component is overdue and its adjustmentYears has not
     * yet been corrected to absorb the gap (see components.json schemaNotes).
     * Rather than hiding this, it's flagged with the .negative class so it's
     * visible as a punch-list item — once adjustmentYears is corrected for
     * that component, Remaining Life will read 0 and the flag disappears.
     */
    function formatRemainingLifeWithWarning(remainingLife) {
        const text = `${remainingLife} yr${Math.abs(remainingLife) === 1 ? "" : "s"}`;
        return { text, isNegative: remainingLife < 0 };
    }
    /**
     * unitCost may be unknown for a newly discovered component that hasn't
     * been priced yet (e.g. a sump pump just found in the foundation). Guard
     * against NaN/$0 misrepresenting "we don't know yet" as "this costs zero."
     */
    function formatCurrencyOrUnknown(value) {
        if (value === undefined || value === null || Number.isNaN(value))
            return "—";
        return formatCurrency(value);
    }
    function formatUnitCostOrUnknown(value) {
        if (value === undefined || value === null || Number.isNaN(value))
            return "—";
        return formatUnitCost(value);
    }
    function renderLoadingState(message) {
        const tbody = document.getElementById(TABLE_BODY_ID);
        if (!tbody)
            return;
        tbody.innerHTML = `<tr><td colspan="${COLUMN_COUNT}">${message}</td></tr>`;
    }
    function renderErrorState(message) {
        const tbody = document.getElementById(TABLE_BODY_ID);
        if (!tbody)
            return;
        tbody.innerHTML = `<tr><td colspan="${COLUMN_COUNT}" class="error">${message}</td></tr>`;
    }
    function buildCategoryHeadingRow(categoryName) {
        const tr = document.createElement("tr");
        tr.className = "category-heading-row";
        tr.innerHTML = `<th colspan="${COLUMN_COUNT}" scope="colgroup">${categoryName}</th>`;
        return tr;
    }
    function buildComponentRow(component, settings) {
        const { studyStartYear, generalInflationRatePercent } = settings;
        const costBaseYear = settings.unitCostYear ?? studyStartYear; // year unit costs were priced in
        const hasKnownUnitCost = typeof component.unitCost === "number" && !Number.isNaN(component.unitCost);
        const dateInServiceCost = hasKnownUnitCost
            ? window.ReservesEngine.getDateInServiceCost(component, costBaseYear, generalInflationRatePercent)
            : null;
        const currentCost = hasKnownUnitCost ? component.currentCost : null;
        const funded = window.ReservesEngine.isFunded(component);
        // Unfunded: show its cost for reference, marked, and left out of the subtotal
        const unfundedCost = window.ReservesEngine.getComponentCost(component);
        const costCell = funded
            ? `<td>${formatCurrencyOrUnknown(currentCost)}</td>`
            : `<td class="unfunded">${unfundedCost === null ? "Unfunded" : `${formatCurrency(unfundedCost)} (Unfunded)`}</td>`;
        const remainingLife = window.ReservesEngine.getRemainingLife(component, studyStartYear);
        const replacementYear = window.ReservesEngine.getFirstScheduledYear(component);
        const { text: remainingLifeText, isNegative } = formatRemainingLifeWithWarning(remainingLife);
        const tr = document.createElement("tr");
        if (component.funded === false) {
        tr.classList.add("unfunded");
        }
        tr.innerHTML = `
    <td>${component.name}</td>
    <td>${formatItemType(component.itemType)}</td>
    <td>${component.dateInService}</td>
    <td>${formatCurrencyOrUnknown(dateInServiceCost)}</td>
    <td>${formatUsefulLife(component)}</td>
    <td>${formatAdjustmentYears(component.adjustmentYears)}</td>
    <td class="${isNegative ? "negative" : ""}">${remainingLifeText}</td>
    <td>${replacementYear}</td>
    <td>${formatScopeFactor(component.scopeFactor)}</td>
    <td>${formatQuantity(component)}</td>
    <td>${formatUnitCostOrUnknown(component.unitCost)}</td>
    ${costCell}
    <td>${component.inflationRate != null ? component.inflationRate + "%" : "—"}</td>
  `;
        return tr;
    }
    function buildSubtotalRow(categoryGroup) {
        const tr = document.createElement("tr");
        tr.className = "category-subtotal-row";
        tr.innerHTML = `
      <td colspan="${COLUMN_COUNT - 1}">${categoryGroup.category} Subtotal</td>
      <td>${formatCurrency(categoryGroup.totalCurrentCost)}</td>
    `;
        return tr;
    }
    function buildGrandTotalRow(grandTotal) {
        const tr = document.createElement("tr");
        tr.className = "grand-total-row";
        tr.innerHTML = `
    <td colspan="${COLUMN_COUNT - 1}">Grand Total</td>
    <td>${formatCurrency(grandTotal)}</td>
  `;
        return tr;
    }
    function renderCategorizedTable(categoryGroups, settings) {
        const tbody = document.getElementById(TABLE_BODY_ID);
        if (!tbody)
            return;
        tbody.innerHTML = ""; // clear loading state
        if (categoryGroups.length === 0) {
            renderErrorState("No component data available.");
            return;
        }
        const fragment = document.createDocumentFragment();
        let grandTotal = 0;
        for (const categoryGroup of categoryGroups) {
            fragment.appendChild(buildCategoryHeadingRow(categoryGroup.category));
            for (const component of categoryGroup.components) {
                fragment.appendChild(buildComponentRow(component, settings));
            }
            fragment.appendChild(buildSubtotalRow(categoryGroup));
            grandTotal += categoryGroup.totalCurrentCost;
        }
        fragment.appendChild(buildGrandTotalRow(grandTotal));
        tbody.appendChild(fragment);
    }
    function renderHeading(settings) {
        const heading = document.getElementById(HEADING_ID);
        if (heading && settings.associationName) {
            heading.textContent = `Categorized Components — ${settings.associationName}`;
        }
    }
    async function fetchJson(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async function init() {
        renderLoadingState("Loading component data…");
        if (typeof window.ReservesEngine === "undefined") {
            renderErrorState("Calculation engine failed to load. Check that reserves-engine.js is loaded before categorizedComponents.js.");
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
            categoryGroups = window.ReservesEngine.groupComponentsByCategory(componentsData.components);
        }
        catch (err) {
            console.error(err);
            renderErrorState("An error occurred while grouping components by category.");
            return;
        }
        renderCategorizedTable(categoryGroups, settings);
    }
    document.addEventListener("DOMContentLoaded", init);
})();
export {};
