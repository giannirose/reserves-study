// ---------------------------------------------------------------------------
// Page script
// ---------------------------------------------------------------------------
(function () {
    const TABLE_BODY_ID = "cashFlowBody";
    const HEADING_ID = "pageHeading";
    const COLUMN_COUNT = 11;
    const currencyFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    });
    function formatCurrency(value) {
        return currencyFormatter.format(value);
    }
    function formatPercentFunded(percentFunded) {
        if (percentFunded === "—") {
            return { text: "—", isNegative: false };
        }
        return {
            text: `${percentFunded}%`,
            isNegative: percentFunded < 0,
        };
    }
    function formatPercentChange(contributionPercentChange) {
        if (contributionPercentChange === null) {
            return { text: "", isNegative: false };
        }
        return {
            text: `${contributionPercentChange.toFixed(2)}%`,
            isNegative: contributionPercentChange < 0,
        };
    }
    function formatContributionOverride(row) {
        if (row.forcedAnnualContribution !== null) {
            return { text: formatCurrency(row.forcedAnnualContribution), isPercent: false };
        }
        if (row.forcedContributionPercent !== null) {
            return { text: `${row.forcedContributionPercent.toFixed(2)}%`, isPercent: true };
        }
        return { text: "", isPercent: false };
    }
    function formatForcedInterest(row) {
        if (row.forcedAnnualInterest !== null) {
            return formatCurrency(row.forcedAnnualInterest);
        }
        return "";
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
    function renderBaselineRow(settings) {
        const tbody = document.getElementById(TABLE_BODY_ID);
        if (!tbody)
            return;
        const baselineYear = settings.studyStartYear - 1;
        const tr = document.createElement("tr");
        tr.className = "baseline-row";
        tr.innerHTML = `
      <td>${baselineYear}</td>
      <td></td>
      <td></td>
      <td>${formatCurrency(settings.startingAnnualContribution)}</td>
      <td></td>
      <td></td>
      <td>${formatCurrency(settings.startingReserveBalance)}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    `;
        tbody.appendChild(tr);
    }
    function renderRows(rows, settings) {
        const tbody = document.getElementById(TABLE_BODY_ID);
        if (!tbody)
            return;
        tbody.innerHTML = "";
        if (rows.length === 0) {
            renderErrorState("No cash flow data available for the selected study period.");
            return;
        }
        renderBaselineRow(settings);
        const fragment = document.createDocumentFragment();
        for (const row of rows) {
            const tr = document.createElement("tr");
            const { text: percentFundedText, isNegative: percentFundedNegative } = formatPercentFunded(row.percentFunded);
            const { text: percentChangeText, isNegative: percentChangeNegative } = formatPercentChange(row.contributionPercentChange);
            const { text: overrideText, isPercent: overrideIsPercent } = formatContributionOverride(row);
            const forcedInterestText = formatForcedInterest(row);
            tr.innerHTML = `
        <td>${row.year}</td>
        <td>${formatCurrency(row.currentCost)}</td>
        <td>${formatCurrency(row.fullyFunded)}</td>
        <td>${formatCurrency(row.annualContribution)}</td>
        <td>${formatCurrency(row.annualExpenditure)}</td>
        <td>${formatCurrency(row.annualInterest)}</td>
        <td>${formatCurrency(row.endingReserves)}</td>
        <td class="${percentFundedNegative ? "negative" : ""}">${percentFundedText}</td>
        <td class="${percentChangeNegative ? "negative" : ""}">${percentChangeText}</td>
        <td class="${overrideIsPercent ? "override-percent" : ""}">${overrideText}</td>
        <td>${forcedInterestText}</td>
      `;
            fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
    }
    function renderHeading(settings) {
        const heading = document.getElementById(HEADING_ID);
        if (heading && settings.associationName) {
            heading.textContent = `Cash Flow — ${settings.associationName}`;
        }
    }
    async function fetchJson(path) {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
        }
        return response.json();
    }
    async function fetchDuesContribution() {
        try {
            return await fetchJson("./duesContribution.json");
        }
        catch (err) {
            console.warn("duesContribution.json not found or invalid — proceeding without contribution overrides.", err);
            return {};
        }
    }
    async function fetchForceInterest() {
        try {
            return await fetchJson("./forceInterest.json");
        }
        catch (err) {
            console.warn("forceInterest.json not found or invalid — proceeding without forced interest overrides.", err);
            return {};
        }
    }
    async function init() {
        renderLoadingState("Loading cash flow data…");
        if (typeof window.ReservesEngine === "undefined") {
            renderErrorState("Calculation engine failed to load. Check that reserves-engine.js is loaded before cashFlow.js.");
            return;
        }
        let settings;
        let componentsData;
        let duesContribution;
        let forceInterest;
        try {
            const [rawSettings, rawComponents, rawDuesContribution, rawInterest] = await Promise.all([
                fetchJson("./settings.json"),
                fetchJson("./components.json"),
                fetchDuesContribution(),
                fetchForceInterest(),
            ]);
            settings = rawSettings;
            componentsData = rawComponents;
            duesContribution = rawDuesContribution;
            forceInterest = rawInterest;
        }
        catch (err) {
            console.error(err);
            renderErrorState(err instanceof Error ? err.message : "Could not load data files.");
            return;
        }
        renderHeading(settings);
        let rows;
        try {
            rows = window.ReservesEngine.buildCashFlowProjection(componentsData.components, settings, duesContribution, forceInterest);
        }
        catch (err) {
            console.error(err);
            renderErrorState("An error occurred while calculating the cash flow projection.");
            return;
        }
        renderRows(rows, settings);
    }
    document.addEventListener("DOMContentLoaded", init);
})();

