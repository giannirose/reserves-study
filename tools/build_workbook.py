"""
Builds the input workbook for the ACTUAL reserve study version:
  Reserve_Study_Template.xlsx      blank, ready to fill in
  Reserve_Study_Example_Full.xlsx  filled with the model study's data

Tabs: Instructions | Settings | Components | Dues Contribution | Force Interest
Settings, Components, Dues Contribution and Force Interest use the same layout
as the existing settings/components/duesContribution/forceInterest templates,
so the existing xlsx_to_*_json.py scripts can read this same workbook.
"""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, Protection
from openpyxl.worksheet.datavalidation import DataValidation

ARIAL = "Arial"
F = Font(name=ARIAL, size=10)
BOLD = Font(name=ARIAL, size=10, bold=True)
HEAD = Font(name=ARIAL, size=10, bold=True, color="FFFFFF")
HEAD_FILL = PatternFill("solid", fgColor="1F3A5F")
INPUT = PatternFill("solid", fgColor="FFF8D6")
LOCKED = PatternFill("solid", fgColor="E7E9EC")
THIN = Side(style="thin", color="C9CDD3")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
PCT = '0.0"%"'          # stores 3 (not 0.03) and shows 3.0%, matching settings.json

COMPONENT_ROWS = 100     # pre-formatted rows; more can be added below

# ---------------------------------------------------------------------------
# Settings: (key, label, type, example value, number format, notes)
# Example values are the example version's presets; blank cells fall back to them.
# ---------------------------------------------------------------------------
SETTINGS = [
    ("studyName", "Study Name", "string", None, None,
     "Internal name for this study. Not shown to residents. Blank: 'Reserve Study'."),
    ("associationName", "Association Name", "string", None, None,
     "Shown in every page heading, e.g. 'Cash Flow — <name>'. Blank: 'Example Association'."),
    ("unitCostYear", "Study Planning Year", "integer", None, "0",
     "The year the Unit Costs on the Components tab are priced in. All costs inflate forward from this year. "
     "Typically the year before Study Start Year. Blank: this year."),
    ("studyStartYear", "Study Start Year", "integer", None, "0",
     "First year of the projection (4-digit year). Typically Study Planning Year + 1. Blank: Study Planning Year + 1."),
    ("studyLengthYears", "Study Length (Years)", "integer", 30, "0",
     "Number of years projected. Typical: 30."),
    ("startingReserveBalance", "Starting Reserve Balance ($)", "integer", 100000, '"$"#,##0',
     "Reserve fund balance at the end of the year before Study Start Year. Example: $100,000."),
    ("startingAnnualContribution", "Starting Annual Contribution ($)", "integer", 50000, '"$"#,##0',
     "The ACTUAL contribution for the year before Study Start Year. The first study year grows from this by the "
     "General Inflation Rate, unless the Dues Contribution tab forces that year. Example: $50,000."),
    ("generalInflationRatePercent", "General Inflation Rate (%)", "float", 3.0, PCT,
     "Annual inflation applied to costs and to contribution growth. Enter 3 for 3%. Typical: 2.5 to 4. Example: 3."),
    ("interestEarnedRatePercent", "Interest Earned Rate (%)", "float", 2.0, PCT,
     "Annual rate earned on reserves. Enter 2 for 2%. Typical: 1 to 5, depending on where reserves are held. Example: 2."),
    ("interestTaxRatePercent", "Interest Tax Rate (%)", "float", 21.0, PCT,
     "Reduces interest earned: interest = (starting reserves + contribution - expenditure) x rate x (1 - tax rate). "
     "Enter 0 if no tax applies; confirm the rate with the association's tax preparer. Example: 21."),
    ("fundingGoalType", "Funding Goal Type", "string", "fully_funded", None,
     "Recorded with the study; not used in calculations yet. Example: fully_funded."),
    ("fullyFundedTargetPercent", "Fully Funded Target (%)", "integer", 100, '0"%"',
     "Recorded with the study; not used in calculations yet. Typical: 100."),
    ("currency", "Currency", "string", "USD", None, "ISO currency code. Pages currently display US dollars."),
    ("fiscalYearStartMonth", "Fiscal Year Start Month", "integer", 1, "0",
     "1-12, where 1 = January. Recorded with the study; not used in calculations yet."),
    ("specialAssessmentAllowed", "Special Assessment Allowed", "boolean", True, None,
     "TRUE or FALSE: whether the governing documents permit special assessments. Not modeled in the cash flow."),
    ("loanAllowed", "Loan Allowed", "boolean", False, None,
     "TRUE or FALSE: whether the governing documents permit borrowing. Not modeled in the cash flow."),
    ("notes", "Notes", "string",
     "Inflation and interest rates are planning assumptions, not guarantees, and should be reviewed annually.", None,
     "Free-text notes about this study."),
]

COMPONENT_HEADERS = ["Component ID", "Category", "Name", "Item Type", "Date In Service",
                     "Useful Life (Years)", "Adjustment (Years)", "Scope Factor", "Quantity",
                     "Quantity Unit", "Unit Cost ($)", "Funding", "Notes"]
COMPONENT_WIDTHS = [14, 14, 42, 12, 15, 18, 18, 13, 11, 14, 14, 12, 60]
COMPONENT_FORMATS = {5: "0", 6: "0", 7: "0", 8: "0.00", 9: "#,##0.##", 11: '"$"#,##0.00'}

DUES_SCHEMA = ("Sparse override map. Only include years where the Annual Contribution should be forced instead "
               "of growing by generalInflationRatePercent. A value is either an exact dollar amount, or a percent "
               "change from the previous year written like \"10%\". A forced year becomes the base that later years grow from.")
INTEREST_SCHEMA = ("Sparse override map. Only include years where the Interest should be forced to a specific dollar "
                   "amount instead of the standard formula in reserves-engine.js. Negative forced amounts are floored at $0 by the engine.")

# ---------------------------------------------------------------------------
# Filled example: the model study (settings.json + components.json)
# ---------------------------------------------------------------------------
FULL_SETTINGS = {
    "studyName": "Composing a Reserves Study - Model Workbook",
    "associationName": "Model Association",
    "unitCostYear": 2025,
    "studyStartYear": 2026,
    "studyLengthYears": 30,
    "startingReserveBalance": 250000,
    "startingAnnualContribution": 56178,
}
FULL_COMPONENTS = [
    ["elec-001", "Electrical", "Electrical System Maintenance", "recurring", 2025, 10, 0, 1, 1, None, 50000, ""],
    ["elec-002", "Electrical", "Electrical Main Panel - Replace", "one-time", 2025, 50, 0, 1, 1, None, 21396, ""],
    ["elec-003", "Electrical", "Electrical System Sub-Panels - Replace (1)", "one-time", 2025, 50, 0, 1, 1, None, 15000, ""],
    ["elec-004", "Electrical", "Electrical System Sub-Panels - Replace (2)", "one-time", 2025, 50, 0, 1, 1, None, 64200, ""],
    ["elec-005", "Electrical", "Lighting - Exterior - Garage", "one-time", 2016, 20, 0, 1, 1, None, 5000, ""],
    ["elec-006", "Electrical", "Lighting - Exterior - Pole-Mounted", "one-time", 2016, 25, 0, 1, 1, None, 2500, ""],
    ["elec-007", "Electrical", "Lighting - Interior - 2nd-13th Floors", "one-time", 2017, 15, 0, 1, 1, None, 12528, ""],
    ["pave-001", "Pavement", "Asphalt Pavement - Clean and Seal", "recurring", 2021, 3, 0, 1, 3660, "sq-ft", 0.54, ""],
    ["pave-002", "Pavement", "Asphalt Pavement - Resurface", "recurring", 1966, 40, 20, 1, 3660, "sq-ft", 3.50,
     "Adjustment of 20 reflects observed history: the first scheduled cycle is 2026 (1966+40+20), not 2006. "
     "Applies only to the first cycle; later cycles run every 40 years from 2026."],
    ["pave-003", "Pavement", "Concrete Pavement - Repair Allowance", "recurring", 1966, 10, 0, 0.06, 3380, "sq-ft", 12.50,
     "Scope factor 0.06 = about 6% of the area repaired each cycle."],
    ["pave-004", "Pavement", "Concrete Sidewalks - Replacement Allowance", "recurring", 1966, 40, 0, 1, 3380, "sq-ft", 12.00, ""],
    ["plumb-001", "Plumbing", "Sump Pump - Foundation", "recurring", 2000, 20, 6, 1, 1, None, 8000,
     "Adjustment of 6 reflects observed history: the first scheduled cycle is 2026 (2000+20+6). "
     "After servicing, set Date In Service to that year and Adjustment to 0."],
]
# One component marked Unfunded in the filled example, to show how it is handled
UNFUNDED_EXAMPLE = {
    "elec-006": "Example of a deliberately unfunded component: the board chose to pay for this "
                "from the operating budget, so it is listed but left out of reserve totals.",
}
FULL_DUES = [(2028, "10%", "Board approved a 10% increase for 2028 (example of a percent override)."),
             (2032, 80000, "Contribution set to exactly $80,000 (example of a dollar override).")]
FULL_INTEREST = [(2029, 6000, "Matches the interest figure in the study being mirrored (example).")]


def with_funding(row):
    """Example rows are written without Funding; insert it before Notes."""
    *rest, notes = row
    funding = "Unfunded" if row[0] in UNFUNDED_EXAMPLE else "Funded"
    note = UNFUNDED_EXAMPLE.get(row[0], notes)
    return [*rest, funding, note]


def header_row(ws, row, labels, widths=None):
    for c, label in enumerate(labels, start=1):
        cell = ws.cell(row=row, column=c, value=label)
        cell.font, cell.fill, cell.border = HEAD, HEAD_FILL, BOX
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        if widths:
            ws.column_dimensions[cell.column_letter].width = widths[c - 1]


def style_cell(cell, editable, fmt=None, wrap=False):
    cell.font, cell.border = F, BOX
    cell.alignment = WRAP if wrap else Alignment(vertical="top")
    cell.fill = INPUT if editable else LOCKED
    cell.protection = Protection(locked=not editable)
    if fmt:
        cell.number_format = fmt


def protect(ws):
    ws.protection.sheet = True
    ws.protection.formatColumns = False
    ws.protection.formatRows = False
    ws.protection.insertRows = False


def build_settings(wb, filled):
    ws = wb.create_sheet("Settings")
    header_row(ws, 1, ["JSON Key", "Setting", "Type", "Value", "Notes"], [28, 32, 10, 30, 90])
    ws.freeze_panes = "A2"
    bool_dv = DataValidation(type="list", formula1='"TRUE,FALSE"', allow_blank=True)
    year_dv = DataValidation(type="whole", operator="between", formula1="1900", formula2="2200", allow_blank=True,
                             showErrorMessage=True, error="Enter a 4-digit year.")
    num_dv = DataValidation(type="decimal", operator="between", formula1="-100", formula2="1000000000", allow_blank=True,
                            showErrorMessage=True, error="Enter a number.")
    for dv in (bool_dv, year_dv, num_dv):
        ws.add_data_validation(dv)
    for r, (key, label, ftype, example, fmt, notes) in enumerate(SETTINGS, start=2):
        value = filled.get(key, example) if filled is not None else example
        for c, v in enumerate([key, label, ftype, value, notes], start=1):
            cell = ws.cell(row=r, column=c, value=v)
            style_cell(cell, editable=(c == 4), fmt=fmt if c == 4 else None, wrap=(c in (4, 5)))
        addr = f"D{r}"
        if ftype == "boolean":
            bool_dv.add(addr)
        elif key in ("unitCostYear", "studyStartYear"):
            year_dv.add(addr)
        elif ftype in ("integer", "float"):
            num_dv.add(addr)
    protect(ws)


def build_components(wb, rows):
    ws = wb.create_sheet("Components")
    header_row(ws, 1, COMPONENT_HEADERS, COMPONENT_WIDTHS)
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "D2"
    for r in range(2, COMPONENT_ROWS + 2):
        for c in range(1, len(COMPONENT_HEADERS) + 1):
            style_cell(ws.cell(row=r, column=c), editable=True, fmt=COMPONENT_FORMATS.get(c), wrap=(c == 13))
    for i, data in enumerate(rows or []):
        for c, v in enumerate(with_funding(data), start=1):
            if v not in (None, ""):
                ws.cell(row=i + 2, column=c, value=v)

    def dv(kind, op, f1, f2, col, title, msg):
        d = DataValidation(type=kind, operator=op, formula1=f1, formula2=f2, allow_blank=True,
                           showErrorMessage=True, errorTitle=title, error=msg,
                           showInputMessage=True, promptTitle=title, prompt=msg)
        d.add(f"{col}2:{col}{COMPONENT_ROWS + 1}")
        ws.add_data_validation(d)
    dv("list", None, '"recurring,one-time"', None, "D", "Item Type",
       "recurring = repeats every Useful Life years. one-time = happens once, then drops out of the study.")
    dv("whole", "between", "1900", "2200", "E", "Date In Service", "Four-digit year, e.g. 2016.")
    dv("whole", "between", "1", "100", "F", "Useful Life", "Whole years, 1 to 100.")
    dv("whole", "between", "-100", "100", "G", "Adjustment",
       "Whole years (+ later, - earlier) applied to the FIRST scheduled cycle only. Blank = 0.")
    dv("decimal", "between", "0", "100", "H", "Scope Factor", "Share replaced each cycle: 1 = all, 0.06 = 6%. Blank = 1.")
    dv("decimal", "greaterThan", "0", None, "I", "Quantity", "Greater than 0. Blank = 1.")
    dv("list", None, '"Funded,Unfunded"', None, "L", "Funding",
       "Funded (or blank) = counted in the study. Unfunded = deliberately not funded: listed, but left out of all totals.")
    dv("decimal", "greaterThanOrEqual", "0", None, "K", "Unit Cost",
       "Cost per unit in Study Planning Year dollars. Blank = not yet priced (left out of all totals).")
    # No sheet protection here, so rows can be inserted freely.


def build_overrides(wb, title, value_header, value_fmt, schema, rows, hint):
    ws = wb.create_sheet(title)
    header_row(ws, 1, ["JSON Key", "Setting", "Type", "Value", "Notes"], [26, 34, 10, 60, 60])
    for c, v in enumerate(["schemaNotes", "Schema Notes", "string", schema,
                           "Describes how this tab is used. Safe to edit; not used by the calculation engine."], start=1):
        style_cell(ws.cell(row=2, column=c, value=v), editable=(c == 4), wrap=True)
    ws.row_dimensions[2].height = 75
    cap = ws.cell(row=4, column=1, value=f"Overrides — one row per year to force. Leave Year blank to omit a row. {hint}")
    cap.font = BOLD
    header_row(ws, 5, ["Year", value_header, "Notes (for your reference — not exported)"])
    for r in range(6, 6 + 40):
        style_cell(ws.cell(row=r, column=1), True, "0")
        style_cell(ws.cell(row=r, column=2), True, value_fmt)
        style_cell(ws.cell(row=r, column=3), True, wrap=True)
    for i, (year, value, note) in enumerate(rows or []):
        ws.cell(row=6 + i, column=1, value=year)
        cell = ws.cell(row=6 + i, column=2, value=value)
        if isinstance(value, str):
            cell.alignment = Alignment(horizontal="right", vertical="top")
        ws.cell(row=6 + i, column=3, value=note)
    year_dv = DataValidation(type="whole", operator="between", formula1="1900", formula2="2200", allow_blank=True,
                             showErrorMessage=True, error="Enter a 4-digit study year.")
    year_dv.add("A6:A45")
    ws.add_data_validation(year_dv)
    ws.freeze_panes = "A6"


INSTRUCTIONS = [
    ("Reserve Study — Input Workbook", None, "title"),
    ("Fill in the yellow cells on the Settings, Components, Dues Contribution and Force Interest tabs, then upload this "
     "one workbook. Grey cells are labels and are locked.", None, "para"),

    ("Settings tab", None, "h"),
    ("What it holds", "The study's assumptions: years, starting balance and contribution, inflation, interest and tax.", None),
    ("Blank values", "Any blank Value uses the example version's value, shown in that row's Notes. The upload page lists every value it filled in.", None),
    ("Percents", "Enter rates as plain numbers: 3 means 3%. Typing 3% also works.", None),
    ("Years", "Study Planning Year is the year your Unit Costs are priced in. Study Start Year is the first projected year, typically the next year.", None),
    ("Typical values (example version)", "Study Length 30 · Starting Reserve Balance $100,000 · Starting Annual Contribution $50,000 · "
     "General Inflation 3% · Interest Earned 2% · Interest Tax 21% · Fully Funded Target 100%.", None),

    ("Components tab", None, "h"),
    ("Required", "Component ID (unique), Category, Name, Item Type, Date In Service, Useful Life.", None),
    ("Optional", "Adjustment (blank = 0), Scope Factor (blank = 1), Quantity (blank = 1), Quantity Unit (blank for single items), Unit Cost, Funding (blank = Funded), Notes.", None),
    ("Item Type", "recurring: repeats every Useful Life years after its first scheduled cycle. one-time: happens once; after that year it drops out of costs and Fully Funded.", None),
    ("First scheduled cycle", "Date In Service + Useful Life + Adjustment. Adjustment (+ later, − earlier) applies only to this first cycle.", None),
    ("Unit Cost", "Cost per unit in Study Planning Year dollars. Current Cost = Quantity × Unit Cost × Scope Factor. "
     "Leave blank if not yet priced: the item is listed but left out of every total until priced.", None),
    ("Funding", "Funded (or blank): counted in every total. Unfunded: the association has deliberately chosen not to fund it from reserves. "
     "It stays listed on Categorized Components, marked Unfunded, keeps its Unit Cost for reference, is left out of all totals, "
     "and is listed at the end of the report. Use this rather than writing 'Unfunded' in the Name or Notes, "
     "and rather than leaving Unit Cost blank (blank means not yet priced).", None),
    ("Overdue items", "If a recurring item's first scheduled cycle is before the Study Start Year, its Remaining Life shows negative in red "
     "and the upload page names it. If the work is still outstanding, raise Adjustment so the cycle lands in a study year; "
     "if it was done, update Date In Service.", None),
    ("More rows", "100 rows are formatted. Insert more rows above the last one if needed; there is no limit.", None),

    ("Dues Contribution tab (optional)", None, "h"),
    ("What it does", "Forces the Annual Contribution in specific years. Other years grow from the previous year by the General Inflation Rate.", None),
    ("Value", "Either an exact dollar amount (80000) or a percent change from the previous year (10%). "
     "A forced year becomes the base that later years grow from.", None),
    ("On Cash Flow", "Forced years appear in the Forced Annual Contribution column.", None),

    ("Force Interest tab (optional)", None, "h"),
    ("What it does", "Replaces the calculated interest in specific years with a dollar amount, e.g. to match a study being mirrored. Negative amounts count as $0.", None),
    ("On Cash Flow", "Forced years appear in the Forced Annual Interest column.", None),

    ("Upload", None, "h"),
    ("How", "Upload the whole workbook on the study page. Only the four input tabs are read; this Instructions tab is ignored.", None),
    ("Python scripts", "The Settings, Components, Dues Contribution and Force Interest tabs use the same layout as the separate templates, "
     "so xlsx_to_settings_json.py, xlsx_to_components_json.py, xlsx_to_duesContribution_json.py and "
     "xlsx_to_forceInterest_json.py can read this workbook too. (Those scripts accept dollar overrides only.)", None),
]


def build_instructions(wb):
    ws = wb.active
    ws.title = "Instructions"
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 110
    r = 1
    for a, b, kind in INSTRUCTIONS:
        if kind == "h":
            r += 1
        ca = ws.cell(row=r, column=1, value=a)
        ca.alignment = Alignment(vertical="top", wrap_text=True)
        if kind == "title":
            ca.font = Font(name=ARIAL, size=14, bold=True)
        elif kind == "para":
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
            ca.font, ca.alignment = F, WRAP
            ws.row_dimensions[r].height = 28
        elif kind == "h":
            ca.font = Font(name=ARIAL, size=11, bold=True, color="1F3A5F")
        else:
            ca.font = BOLD
            cb = ws.cell(row=r, column=2, value=b)
            cb.font, cb.alignment = F, WRAP
        r += 1


def build(path, full):
    wb = Workbook()
    build_instructions(wb)
    build_settings(wb, FULL_SETTINGS if full else None)
    build_components(wb, FULL_COMPONENTS if full else None)
    build_overrides(wb, "Dues Contribution", "Forced Annual Contribution ($ or %)", '"$"#,##0', DUES_SCHEMA,
                    FULL_DUES if full else None, "Value: dollars (80000) or percent change (10%).")
    build_overrides(wb, "Force Interest", "Forced Interest Amount ($)", '"$"#,##0.00', INTEREST_SCHEMA,
                    FULL_INTEREST if full else None, "Value: dollars.")
    wb.save(path)


if __name__ == "__main__":
    build("Reserve_Study_Template.xlsx", full=False)
    build("Reserve_Study_Example_Full.xlsx", full=True)
    print("ok")
