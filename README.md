# reserves-study

## Download

Download the latest release as a zip from the [Releases page](../../releases).

Files to create a reserves study- an overview of anticipated and scheduled expenses
Reserve Study

A client-side web application for preparing and reviewing homeowner association reserve studies. Upload a single Excel workbook; the app parses it and renders a multi-page study with no server required.

Features
Categorized Components — all funded components grouped by category, with unfunded components listed separately at the end

Current Cost — component replacement costs inflated from the study planning year to the present

Expenditures — projected replacement costs by component and decade

Fully Funded — annual fully funded balance targets by component

Cash Flow — 30-year projection of reserves, contributions, expenditures and interest

Method Notes — explanation of calculations and assumptions

PDF Report — all pages assembled into a print-ready landscape PDF with page numbers and association name in the footer
Per-Component Inflation Rate

A global inflation rate applies to all components by default. An optional Inflation Rate column in the Components tab overrides the global rate for individual components — useful for categories such as paving or roofing that escalate at rates different from general inflation.

Input Workbook

Fill in the yellow cells on four tabs: Settings, Components, Dues Contribution, and Force Interest. A blank template and a filled example are provided on the upload page.

Usage
Open index.html in a web browser (or serve the folder with any static file server)
Upload your completed Excel workbook
Review the study pages and download the PDF report
No Dependencies

All calculation and rendering is done in the browser. No build step, no backend, no npm install required. SheetJS is loaded from a CDN for Excel parsing.
