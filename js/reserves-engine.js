/**
 * reserves-engine.js
 *
 * Pure calculation engine for the 30-year HOA reserves study.
 * No DOM access here — this module only takes settings.json + components.json
 * data (already parsed into JS objects) and returns derived numbers.
 * Each page's own script (cashFlow.js, expenditures.js, etc.) is responsible
 * for fetching the JSON and rendering the results returned by this file.
 */

// ---------------------------------------------------------------------------
// Scheduling: which year(s) is a component due for service?
// ---------------------------------------------------------------------------

/**
 * The first scheduled occurrence for any component, adjusted for known
 * real-world history. adjustmentYears applies ONLY to this first occurrence,
 * never to subsequent recurring cycles (see schemaNotes in components.json).
 */

// ---------------------------------------------------------------------------
// Study scope configuration
// ---------------------------------------------------------------------------
// Set to true to calculate Fully Funded accrual over the full component
// life regardless of study length (e.g. a 50-year component accrues from
// year 1, not just the last 30 years). Set to false (default) to cap
// accrual to the study window only.
// Besides the following line, there are two other changes made to reserves-ReservesEngine.adjustmentYears
// before:
// const accrualWindowYears = Math.min(usefulLife, studyLengthYears);

// after (with flag):
// const accrualWindowYears = ACCRUE_BEYOND_STUDY_WINDOW ? usefulLife : Math.min(usefulLife, studyLengthYears);
// and
// before:
// const accrualWindowYears = Math.min(usefulLife, studyLengthYears);

// after (with flag):
// const accrualWindowYears = ACCRUE_BEYOND_STUDY_WINDOW ? usefulLife : Math.min(usefulLife, studyLengthYears);
// for a thirty-year study, set to false
const ACCRUE_BEYOND_STUDY_WINDOW = false;

function getFirstScheduledYear(component) {
  return component.dateInService + component.usefulLifeYears + component.adjustmentYears;
}

/**
 * All scheduled years for a component that fall within the study window.
 * - "one-time" items: at most one year.
 * - "recurring" items: first cycle uses the adjusted year; every cycle after
 *   uses clean usefulLifeYears math with no adjustment carried forward.
 */
function getAllScheduledYears(component, studyStartYear, studyEndYear) {
  const firstYear = getFirstScheduledYear(component);

  if (component.itemType === "one-time") {
    return firstYear >= studyStartYear && firstYear <= studyEndYear ? [firstYear] : [];
  }

  if (component.itemType !== "recurring") {
    console.warn(`Component "${component.id}" has unrecognized itemType "${component.itemType}". Treating as one-time.`);
    return firstYear >= studyStartYear && firstYear <= studyEndYear ? [firstYear] : [];
  }

  if (!component.usefulLifeYears || component.usefulLifeYears <= 0) {
    console.warn(`Recurring component "${component.id}" has invalid usefulLifeYears (${component.usefulLifeYears}). Skipping.`);
    return [];
  }

  const years = [];
  let year = firstYear;
  while (year <= studyEndYear) {
    if (year >= studyStartYear) years.push(year);
    year += component.usefulLifeYears;
  }
  return years;
}

/**
 * Whether a "one-time" component's single scheduled service event has
 * already passed as of targetYear — meaning it has been serviced and
 * there is no further future obligation for it at all. Recurring items
 * are never "discharged" in this sense, since they always have a next
 * cycle ahead. The scheduled year itself does NOT count as discharged
 * (targetYear must be strictly AFTER it) — that year is when the
 * component is actually serviced and should still be fully counted.
 *
 * Used to:
 *   - zero out a one-time item's Fully Funded accrual once it's done,
 *     rather than leaving it permanently pinned at 100% (see
 *     getComponentFullyFundedContribution)
 *   - exclude an already-serviced one-time item from Current Cost totals
 *     (see getCurrentCostTotalForYear)
 *   - let currentCost.js and fullyFunded.js render a dash instead of a
 *     dollar amount for these "nothing left to track" cells
 */
function isOneTimeItemDischarged(component, targetYear) {
  if (component.itemType !== "one-time") return false;
  return targetYear > getFirstScheduledYear(component);
}

/**
 * Which cycle's end year (scheduled replacement year) is currently
 * relevant for targetYear. For "one-time" items this is always the
 * single firstScheduledYear, regardless of targetYear. For "recurring"
 * items it advances cycle-by-cycle (using usefulLifeYears) until it
 * reaches the first cycle-end at or after targetYear. Shared by
 * getComponentFullyFundedContribution and isComponentOutOfScope so the
 * two can never disagree about which cycle is in play.
 */
function getCurrentCycleEndYear(component, targetYear) {
  const firstScheduledYear = getFirstScheduledYear(component);
  if (component.itemType !== "recurring") {
    return firstScheduledYear; // one-time (or unrecognized, treated as one-time elsewhere)
  }
  let cycleEndYear = firstScheduledYear;
  while (cycleEndYear < targetYear) {
    cycleEndYear += component.usefulLifeYears;
  }
  return cycleEndYear;
}

/**
 * Whether a component currently has NO Fully Funded accrual obligation
 * for targetYear, for a "not relevant yet" reason rather than a "actively
 * accruing from scratch" reason — true before a component is in service,
 * or before it comes within studyLengthYears of its next scheduled
 * replacement (see getComponentFullyFundedContribution's accrualWindowYears
 * cap, for components whose life is longer than the study itself). False
 * for a discharged one-time item — that's a different state (handled by
 * isOneTimeItemDischarged), not "out of scope." Used by fullyFunded.js to
 * render a dash for these years instead of a numerically-correct-but-
 * misleading "$0", since $0 elsewhere on that page means "actively
 * accruing," not "nothing applies yet."
 */
function isComponentOutOfScope(component, targetYear, studyLengthYears) {
  if (targetYear < component.dateInService) return true; // not yet in service

  if (isOneTimeItemDischarged(component, targetYear)) return false; // a different state, handled separately

  const usefulLife = component.usefulLifeYears;
  if (!usefulLife || usefulLife <= 0) return false;

  const cycleEndYear = getCurrentCycleEndYear(component, targetYear);
  // Comment the following line to toggle 30-year max calculation at top of document
  // const accrualWindowYears = Math.min(usefulLife, studyLengthYears);
  const accrualWindowYears = ACCRUE_BEYOND_STUDY_WINDOW ? usefulLife : Math.min(usefulLife, studyLengthYears);
  const cycleStartYear = cycleEndYear - accrualWindowYears;

  return targetYear < cycleStartYear;
}

/**
 * Effective life = usefulLifeYears + adjustmentYears. adjustmentYears can be
 * positive (component ran longer than the standard life table predicted,
 * including the case where a recurring item is currently overdue) or
 * negative (component failed earlier than expected). This effective life is
 * the basis for Remaining Life and Replacement Year, but NOT for Date in
 * Service Cost, which depends only on elapsed time since dateInService.
 */
function getEffectiveLife(component) {
  return component.usefulLifeYears + component.adjustmentYears;
}

/**
 * Years remaining before a component's current scheduled cycle is due,
 * relative to a reference year (use settings.studyStartYear for the
 * Categorized Components page, since it has no specific study-year context).
 * Can be negative if a one-time item is overdue and adjustmentYears has not
 * yet been used to correct for that — for recurring items, the convention
 * established for this study is to fold any overdue gap into adjustmentYears
 * so this value reads 0 rather than negative once corrected.
 */
function getRemainingLife(component, referenceYear) {
  const effectiveLife = getEffectiveLife(component);
  return effectiveLife - (referenceYear - component.dateInService);
}

/**
 * Estimates what a component's current cost would have been back when it
 * was placed in service, by reversing inflation from the cost base year
 * (settings.unitCostYear, i.e. the year unit costs were gathered) back to
 * dateInService. This is a backward discount: currentCost * (1+rate)^-n,
 * where n = costBaseYear - dateInService. Depends only on elapsed time,
 * not on usefulLifeYears or adjustmentYears.
 */
function getDateInServiceCost(component, costBaseYear, annualInflationRatePercent) {
  const currentCost = getComponentCost(component);
  if (currentCost === null) return null;
  const yearsElapsedSinceInService = costBaseYear - component.dateInService;
  return inflateCost(currentCost, effectiveInflationRate(component, annualInflationRatePercent), -yearsElapsedSinceInService);
}

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

/**
 * Whether a component is funded from reserves. Only funded: false marks a
 * component the association has deliberately chosen not to fund; a missing
 * key (e.g. components.json from xlsx_to_components_json.py) means funded.
 */
function isFunded(component) {
  return component.funded !== false;
}

/**
 * The component's present-day (uninflated) cost, regardless of funding —
 * for display only (e.g. an unfunded item's cost on Categorized Components).
 * quantity defaults to 1, scopeFactor defaults to 1 if missing.
 */
function getComponentCost(component) {
  if (typeof component.unitCost !== "number" || Number.isNaN(component.unitCost)) {
    return null; // unitCost not yet known — e.g. a newly discovered component not yet priced
  }
  const quantity = component.quantity ?? 1;
  const scopeFactor = component.scopeFactor ?? 1;
  return component.unitCost * quantity * scopeFactor;
}

/**
 * The present-day cost the study COUNTS toward reserves. null for a component
 * that is not yet priced, and also for one that is deliberately unfunded, so
 * both are left out of every total (Current Cost, Expenditures, Fully Funded,
 * Cash Flow) through this one function.
 */
function getCurrentCost(component) {
  if (!isFunded(component)) return null; // deliberately unfunded — listed, but never counted
  return getComponentCost(component);
}

/**
 * Inflates a present-day cost forward to a future year using compound
 * inflation. yearsOut should be (targetYear - studyStartYear), i.e. how many
 * years of inflation have elapsed since the study's baseline year.
 */
function effectiveInflationRate(component, globalRatePercent) {
  const rate = (component.inflationRate != null) ? component.inflationRate : globalRatePercent;

  return rate;
}
function inflateCost(currentCost, annualInflationRatePercent, yearsOut) {
  const rate = annualInflationRatePercent / 100;
  return currentCost * Math.pow(1 + rate, yearsOut);
}

// ---------------------------------------------------------------------------
// Percent funded
// ---------------------------------------------------------------------------

/**
 * Rounds to a whole-number percentage. Returns "—" when fullyFundedBalance
 * is 0, since percent funded is not a meaningful question when nothing has
 * accrued yet to measure against. Can return a negative number for shortfall
 * years — this is intentional, not an error condition.
 */
function calculatePercentFunded(endingReserves, fullyFundedBalance) {
  if (fullyFundedBalance === 0) {
    return "—"; // not applicable — nothing accrued yet to measure against
  }
  return Math.round((endingReserves / fullyFundedBalance) * 100); // can be negative
}

// ---------------------------------------------------------------------------
// Fully funded balance (the "what 100% funded should look like" target)
// ---------------------------------------------------------------------------

/**
 * Standard reserve-study fully-funded calculation for a single component in
 * a given year: accrued depreciation = current inflated value * (effective
 * age / accrual window). This is the textbook formula used by reserve
 * study professionals (e.g. CAI / APRA methodology) for the "Fully Funded
 * Balance" — WITH one deliberate adjustment from the strict textbook
 * version: a component whose life is LONGER than the study's own horizon
 * (studyLengthYears) is treated as "out of scope" — contributing 0 —
 * until it comes within studyLengthYears of its next scheduled
 * replacement (see accrualWindowYears below). This avoids asking
 * residents to fund, e.g., a 50-year roof starting on day one of a
 * 30-year study. For any component whose life is studyLengthYears or
 * shorter, accrualWindowYears === usefulLife and this matches the strict
 * textbook formula exactly, with no change in behavior.
 *
 * effectiveAge = years elapsed since the start of the relevant accrual
 * window, capped at that window's length (can't be "more than 100%
 * accrued").
 *
 * costBaseYear = settings.unitCostYear (the year unit costs were gathered,
 * typically the planning year before studyStartYear). Inflation is applied
 * from this year forward, so costs entered in 2025 planning-year dollars
 * correctly reflect one year of inflation in 2026, two in 2027, etc.
 */
function getComponentFullyFundedContribution(component, targetYear, studyStartYear, studyLengthYears, costBaseYear, annualInflationRatePercent) {
  const usefulLife = component.usefulLifeYears;
  if (!usefulLife || usefulLife <= 0) return 0;

  if (targetYear < component.dateInService) return 0; // not yet in service

  // One-time items have exactly one scheduled service event and no future
  // cycle after it. Once that event has passed, there is nothing left to
  // accrue toward — the contribution drops to 0 rather than staying
  // pinned at 100% (fully accrued) for the rest of the study, which would
  // otherwise permanently and incorrectly inflate the Fully Funded
  // Balance target — and therefore understate Percent Funded — for every
  // year after the component was actually serviced. The scheduled year
  // itself is still correctly 100% accrued; only years AFTER it return 0.
  if (isOneTimeItemDischarged(component, targetYear)) return 0;

  // The scheduled year at or after targetYear is when the current cycle's
  // component is due (100% accrued); targetYear === that year correctly
  // yields 100% accrued (matching Current Cost for that year), not 0% as
  // if a fresh cycle had just begun.
  const cycleEndYear = getCurrentCycleEndYear(component, targetYear);

  // Out-of-scope cap (see function comment above): only the trailing
  // studyLengthYears leading up to cycleEndYear count toward accrual when
  // usefulLife exceeds the study's own length.
  // Toggle at top of doc
  // Comment out the following and replace
  // const accrualWindowYears = Math.min(usefulLife, studyLengthYears);
  const accrualWindowYears = ACCRUE_BEYOND_STUDY_WINDOW ? usefulLife : Math.min(usefulLife, studyLengthYears);
  const cycleStartYear = cycleEndYear - accrualWindowYears;
  const effectiveAge = Math.min(targetYear - cycleStartYear, accrualWindowYears);
  if (effectiveAge < 0) return 0; // out of scope — before this cycle's accrual window begins

  const currentCost = getCurrentCost(component);
  if (currentCost === null) return 0; // unpriced component contributes nothing to the funding target yet
  const yearsOut = targetYear - costBaseYear; // inflate from the year costs were gathered
// After:
  const inflatedCost = inflateCost(currentCost, effectiveInflationRate(component, annualInflationRatePercent), yearsOut);
  return inflatedCost * (effectiveAge / accrualWindowYears);
}

/**
 * Sum of every component's accrued depreciation for a given year —
 * the "Fully Funded Balance" target for that year.
 */
function getFullyFundedBalanceForYear(components, targetYear, studyStartYear, studyLengthYears, costBaseYear, annualInflationRatePercent) {
  return components.reduce((total, component) => {
    return total + getComponentFullyFundedContribution(component, targetYear, studyStartYear, studyLengthYears, costBaseYear, annualInflationRatePercent);
  }, 0);
}

// ---------------------------------------------------------------------------
// Current cost totals (per study year)
// ---------------------------------------------------------------------------

/**
 * Sum of every component's cost inflated out to a specific target year —
 * i.e. "what would it cost to replace everything, today's components, if
 * priced at that year's inflation level." This is the same per-year total
 * shown in currentCost.js's bottom totals row, and is what the Cash Flow
 * page's "Current Cost" column shows for each year. Components with an
 * unknown unitCost (null) are excluded, consistent with getCurrentCost's
 * treatment of unpriced components everywhere else. A "one-time" component
 * whose single scheduled service year has already passed is also excluded
 * — it's been serviced, so there's nothing left to track a replacement
 * cost for (see isOneTimeItemDischarged).
 *
 * costBaseYear = settings.unitCostYear (the year unit costs were gathered).
 * Inflation is applied from this year forward so planning-year-dollar costs
 * are correctly escalated across the full study period.
 */
function getCurrentCostTotalForYear(components, targetYear, costBaseYear, annualInflationRatePercent) {
  const yearsOut = targetYear - costBaseYear; // inflate from the year costs were gathered
  return components.reduce((sum, component) => {
    if (isOneTimeItemDischarged(component, targetYear)) return sum; // already serviced — no longer tracked
    const currentCost = getCurrentCost(component);
    if (currentCost === null) return sum; // unpriced — excluded, per established convention
      return sum + inflateCost(currentCost, effectiveInflationRate(component, annualInflationRatePercent), yearsOut);
  }, 0);
}

// ---------------------------------------------------------------------------
// Expenditures for a given year
// ---------------------------------------------------------------------------

/**
 * Total inflated expenditure across all components scheduled for a specific
 * year, plus a breakdown per component (useful for the "Expenditures" and
 * "Categorized Components" pages).
 *
 * costBaseYear = settings.unitCostYear (the year unit costs were gathered).
 * Inflation is applied from this year forward, consistent with every other
 * cost calculation in the engine.
 */
function getExpendituresForYear(components, targetYear, studyStartYear, studyEndYear, costBaseYear, annualInflationRatePercent) {
  const lineItems = [];
  let total = 0;

  for (const component of components) {
    const scheduledYears = getAllScheduledYears(component, studyStartYear, studyEndYear);
    if (scheduledYears.includes(targetYear)) {
      const currentCost = getCurrentCost(component);
      if (currentCost === null) continue; // can't project an expenditure for an unpriced component
      const yearsOut = targetYear - costBaseYear; // inflate from the year costs were gathered
      const inflatedCost = inflateCost(currentCost, effectiveInflationRate(component, annualInflationRatePercent), yearsOut);

      lineItems.push({
        id: component.id,
        category: component.category,
        name: component.name,
        currentCost,
        inflatedCost,
      });
      total += inflatedCost;
    }
  }

  return { total, lineItems };
}

// ---------------------------------------------------------------------------
// Full 30-year cash flow projection
// ---------------------------------------------------------------------------

/**
 * Builds the complete year-by-year cash flow projection used by the Cash
 * Flow page (and feeds the other pages too). Returns an array of row
 * objects, one per study year, with every column the cashFlow.html table
 * needs.
 *
 * settings.startingAnnualContribution is the ACTUAL contribution amount
 * for the year immediately before studyStartYear — a known historical
 * fact, the same category of baseline assumption as
 * settings.startingReserveBalance. The first study year grows from this
 * figure by generalInflationRatePercent, exactly like every later year
 * grows from the year before it (see the main loop below).
 *
 * duesContribution (optional) is the parsed contents of duesContribution.json:
 *   {
 *     overrides: {
 *       "<year>": <number>,   // force to exact dollar amount
 *       "<year>": "15%",      // force by a specific percent change instead of generalInflationRatePercent
 *     }
 *   }
 * duesContribution.json is now ENTIRELY OPTIONAL and may be omitted for
 * any study with no forced years — it carries nothing but the sparse
 * override map. (It previously also carried previousYearContribution,
 * which has moved to settings.startingAnnualContribution — see the
 * Methodology Notes / changelog for why.)
 *
 * Overrides are sticky: once a year's contribution is forced (whether by
 * dollar amount or by percent), that actual contribution amount becomes
 * the new growth baseline for every subsequent non-overridden year — it
 * does NOT snap back to the inflation-only track.
 *
 * Note: when there's no override, the contribution grows year-to-year by
 * generalInflationRatePercent (not contributionAnnualIncreasePercent).
 */
function buildCashFlowProjection(components, settings, duesContribution = {}, forceInterest = {}) {
  const {
    studyStartYear,
    studyLengthYears,
    startingReserveBalance,
    startingAnnualContribution,
    generalInflationRatePercent,
    interestEarnedRatePercent,
    interestTaxRatePercent,
  } = settings;

  // costBaseYear is the year unit costs in components.json were gathered —
  // typically the planning year before studyStartYear. Defaults to
  // studyStartYear for backward compatibility with any settings.json that
  // doesn't yet have this field, preserving the old behaviour exactly.
  const costBaseYear = settings.unitCostYear ?? studyStartYear;

  const studyEndYear = studyStartYear + studyLengthYears - 1;
  const rows = [];

  const overrides = duesContribution.overrides ?? {};
  const growthRate = 1 + generalInflationRatePercent / 100;

  // The baseline year's known, actual contribution amount — the figure
  // every later year (including the first study year) grows from, unless
  // a specific year is forced via duesContribution.overrides.
  let previousContribution = startingAnnualContribution;

  let endingReserves = startingReserveBalance;

  for (let year = studyStartYear; year <= studyEndYear; year++) {
    // Current Cost: every component's cost inflated out to THIS year from
    // costBaseYear (the planning year unit costs were gathered).
    const currentCostTotal = getCurrentCostTotalForYear(
      components,
      year,
      costBaseYear,
      generalInflationRatePercent
    );

    // Fully Funded: the target reserve balance for this year per standard methodology.
    const fullyFundedBalance = getFullyFundedBalanceForYear(
      components,
      year,
      studyStartYear,
      studyLengthYears,
      costBaseYear,
      generalInflationRatePercent
    );

    // Annual Contribution: parse the override for this year (if any), which
    // may be either a dollar amount (number) or a percent change (string
    // ending in "%", e.g. "15%"). If no override, grow by generalInflationRatePercent.
    const rawOverride = Object.prototype.hasOwnProperty.call(overrides, year)
      ? overrides[year]
      : null;

    let forcedAnnualContribution = null;  // non-null only for dollar-amount overrides
    let forcedContributionPercent = null; // non-null only for percent-change overrides
    let annualContributionThisYear;

    if (rawOverride !== null) {
      if (typeof rawOverride === "string" && rawOverride.trim().endsWith("%")) {
        // Percent override: grow by this specific percent rather than generalInflationRatePercent.
        const pct = parseFloat(rawOverride);
        forcedContributionPercent = pct;
        annualContributionThisYear = previousContribution * (1 + pct / 100);
      } else {
        // Dollar override: force to exact amount.
        forcedAnnualContribution = Number(rawOverride);
        annualContributionThisYear = forcedAnnualContribution;
      }
    } else {
      annualContributionThisYear = previousContribution * growthRate;
    }

    // Contribution % Change: this year's actual contribution vs. last
    // year's actual contribution (forced or not).
    const contributionPercentChange =
      previousContribution !== 0
        ? (annualContributionThisYear / previousContribution - 1) * 100
        : null;

    // Annual Expenditure: inflated cost of every component scheduled this year.
    const { total: annualExpenditure } = getExpendituresForYear(
      components,
      year,
      studyStartYear,
      studyEndYear,
      costBaseYear,
      generalInflationRatePercent
    );

// Annual Interest: use forced amount if override exists for this year,
// otherwise use the average-balance approximation.
// const startingReservesThisYear = endingReserves;
// const netActivity = annualContributionThisYear - annualExpenditure;
// const averageBalance = startingReservesThisYear + netActivity / 2;

const startingReservesThisYear = endingReserves;
const postTransactionBalance = startingReservesThisYear
  + annualContributionThisYear
  - annualExpenditure;


const interestOverrides = forceInterest?.overrides ?? {};
const rawInterestOverride = Object.prototype.hasOwnProperty.call(interestOverrides, String(year))
  ? interestOverrides[String(year)]
  : null;


let forcedAnnualInterest = null; // non-null only when a specific amount was forced
let annualInterest;

if (rawInterestOverride !== null) {
  // Dollar override: force to exact amount, floored at 0.
  forcedAnnualInterest = Math.max(Number(rawInterestOverride), 0);
  annualInterest = forcedAnnualInterest;
} else {
  const taxRate = (interestTaxRatePercent ?? 0) / 100;
  annualInterest = Math.max(postTransactionBalance, 0)
    * (interestEarnedRatePercent / 100)
    * (1 - taxRate);
}  
  
  // {
  // Formula: interest on average balance, floored at 0.
//   annualInterest = Math.max(averageBalance, 0) * (interestEarnedRatePercent / 100);
// }
  
// To summarize what makes this study's interest calculation work:

// Rate: 4% gross (interestEarnedRatePercent: 4.0)
// Tax reduction: 21% (interestTaxRatePercent: 21.0)
// Effective rate: 3.16%
// Base: post-transaction balance (starting reserves + contribution - expenditure)
// Formula: postTransactionBalance × 4% × (1 - 21%)
  
//  The original method was the average-balance approximation:

// javascript
// const netActivity = annualContributionThisYear - annualExpenditure;
// const averageBalance = startingReservesThisYear + netActivity / 2;
// const annualInterest = Math.max(averageBalance, 0) * (interestEarnedRatePercent / 100); 
  




    // Projected Ending Reserves: roll forward.
    endingReserves = startingReservesThisYear + annualContributionThisYear - annualExpenditure + annualInterest;

    // Percent Funded: ending reserves vs. this year's fully funded target.
    const percentFunded = calculatePercentFunded(endingReserves, fullyFundedBalance);

    rows.push({
      year,
      currentCost: currentCostTotal,
      fullyFunded: fullyFundedBalance,
      annualContribution: annualContributionThisYear,
      annualExpenditure,
      annualInterest,
      endingReserves,
      percentFunded,
      contributionPercentChange,
      forcedAnnualContribution,   // non-null when a specific dollar amount was forced
      forcedContributionPercent,  // non-null when a specific percent change was forced
      forcedAnnualInterest,
    });

    previousContribution = annualContributionThisYear;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Categorized components view
// ---------------------------------------------------------------------------

/**
 * Groups components by category with summary totals — used by the
 * "Categorized Components" page.
 */
// function groupComponentsByCategory(components) {
//   const categories = {};

//   for (const component of components) {
//     const key = component.category || "Uncategorized";
//     if (!categories[key]) {
//       categories[key] = { category: key, components: [], totalCurrentCost: 0 };
//     }
//     const currentCost = getCurrentCost(component);
//     categories[key].components.push({ ...component, currentCost });
//     if (currentCost !== null) {
//       categories[key].totalCurrentCost += currentCost;
//     }
//   }

//   return Object.values(categories);
// }

function groupComponentsByCategory(components) {
  const funded = components.filter(c => c.funded !== false);
  const unfunded = components.filter(c => c.funded === false);

  const categories = {};

  for (const component of funded) {
    const key = component.category || "Uncategorized";
    if (!categories[key]) {
      categories[key] = { category: key, components: [], totalCurrentCost: 0 };
    }
    const currentCost = getCurrentCost(component);
    categories[key].components.push({ ...component, currentCost });
    if (currentCost !== null) {
      categories[key].totalCurrentCost += currentCost;
    }
  }

  const result = Object.values(categories);

  if (unfunded.length) {
    const unfundedGroup = { category: "Unfunded Components", components: [], totalCurrentCost: 0, isUnfundedGroup: true };
    for (const component of unfunded) {
      const currentCost = getCurrentCost(component);
      unfundedGroup.components.push({ ...component, currentCost });
      if (currentCost !== null) {
        unfundedGroup.totalCurrentCost += currentCost;
      }
    }
    result.push(unfundedGroup);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
// Supports both browser <script> usage (functions attach to window) and
// future Node-based tooling (e.g. an Excel/PDF export script run via CLI).


const ReservesEngine = {
  getFirstScheduledYear,
  getAllScheduledYears,
  getCurrentCycleEndYear,
  isOneTimeItemDischarged,
  isComponentOutOfScope,
  getCurrentCost,
  getComponentCost,
  isFunded,
  inflateCost,
  effectiveInflationRate,
  getEffectiveLife,
  getRemainingLife,
  getDateInServiceCost,
  calculatePercentFunded,
  getComponentFullyFundedContribution,
  getFullyFundedBalanceForYear,
  getCurrentCostTotalForYear,
  getExpendituresForYear,
  buildCashFlowProjection,
  groupComponentsByCategory,
  ACCRUE_BEYOND_STUDY_WINDOW,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ReservesEngine;
}
if (typeof window !== "undefined") {
  window.ReservesEngine = ReservesEngine;
}



