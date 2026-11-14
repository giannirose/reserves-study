// -------------------------------
// Export Excel (shared utility)
// -------------------------------
function exportExcel({ tableId, filename, sheetName, title }) {
  let rows;
  if (window._exportData?.rows) {
    rows = window._exportData.rows;
} else {
  const table = document.getElementById(tableId);
  if (!table) { console.warn(`exportExcel: no element with id "${tableId}"`); return; }
  const r = [];
  const caption = table.querySelector("caption");
  if (caption) r.push([caption.innerText.trim()]);
  r.push([...table.querySelectorAll("thead th")].map(th => th.innerText.trim()));
  table.querySelectorAll("tbody tr").forEach(tr => {
    r.push([
      ...[...tr.querySelectorAll("th")].map(th => th.innerText.trim()),
      ...[...tr.querySelectorAll("td")].map(td => td.innerText.trim())
    ]);
  });
  // Pad all rows to the same width so Excel doesn't complain
  const maxCols = Math.max(...r.map(row => row.length));
  r.forEach(row => {
    while (row.length < maxCols) row.push("");
  });
  rows = r;
}

  if (!rows) return;

  let xml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="BoldHeader"><Font ss:Bold="1"/></Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="_(&quot;$&quot;* #,##0_);_(&quot;$&quot;* (#,##0))"/>
    </Style>
    <Style ss:ID="Percent">
      <NumberFormat ss:Format="0%"/>
    </Style>
    <Style ss:ID="Percent2">
      <NumberFormat ss:Format="0.00%"/>
    </Style>
    <Style ss:ID="BoldCurrency">
      <Font ss:Bold="1"/>
      <NumberFormat ss:Format="_(&quot;$&quot;* #,##0_);_(&quot;$&quot;* (#,##0))"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="${sheetName}">
    <Table>
`;

rows.forEach((row, rowIndex) => {
  if (row.length === 0) return;
  xml += `<Row>`;
  row.forEach((cell, colIndex) => {
    const bold = rowIndex === 1 || colIndex === 0;

    // Percent cells ("210%", "3.00%"): store as a fraction with a % format, not as currency
    const text = String(cell).trim();
    if (rowIndex > 1 && colIndex > 0 && /^-?[\d,]*\.?\d+%$/.test(text)) {
      const fraction = Number(text.replace(/[%,]/g, "")) / 100;
      const style = text.includes(".") ? "Percent2" : "Percent";
      xml += `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${fraction}</Data></Cell>`;
      return;
    }

    const stripped = String(cell).replace(/[^0-9.-]/g, "");
    const numericValue = Number(stripped);
    const isNumber = rowIndex > 1
      && colIndex > 0
      && cell !== ""
      && cell !== "—"
      && stripped !== ""
      && !isNaN(numericValue)
      && isFinite(numericValue);

    if (isNumber) {
      xml += bold
        ? `<Cell ss:StyleID="BoldCurrency"><Data ss:Type="Number">${numericValue}</Data></Cell>`
        : `<Cell ss:StyleID="Currency"><Data ss:Type="Number">${numericValue}</Data></Cell>`;
    } else {
      const escaped = String(cell).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      xml += bold
        ? `<Cell ss:StyleID="BoldHeader"><Data ss:Type="String">${escaped}</Data></Cell>`
        : `<Cell><Data ss:Type="String">${escaped}</Data></Cell>`;
    }
  });
  xml += `</Row>`;   // ← inside rows.forEach, after row.forEach
});

xml += `\n    </Table>\n  </Worksheet>\n</Workbook>`;

const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename;
a.click();
URL.revokeObjectURL(url);
}

// -------------------------------
// Export CSV (shared utility)
// -------------------------------
function exportCSV({ tableId, filename, title }) {
  let rows;
  if (window._exportData?.rows) {
    rows = window._exportData.rows;
  } else {
    const table = document.getElementById(tableId);
    if (!table) {
      console.warn(`exportCSV: no element with id "${tableId}"`);
      return;
    }
    const r = [];
    const caption = table.querySelector("caption");
    if (caption) r.push([caption.innerText.trim()]);
    r.push([...table.querySelectorAll("thead th")].map(th => th.innerText.trim()));
    table.querySelectorAll("tbody tr").forEach(tr => {
      r.push([
        ...[...tr.querySelectorAll("th")].map(th => th.innerText.trim()),
        ...[...tr.querySelectorAll("td")].map(td => td.innerText.trim())
      ]);
    });
    // Pad all rows to the same width
    const maxCols = Math.max(...r.map(row => row.length));
    r.forEach(row => {
      while (row.length < maxCols) row.push("");
    });
    rows = r;
  }

  if (!rows) return;

  const csvContent = rows
    .filter(row => row.length > 0)
    .map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const text = String(cell).trim();
        if (rowIndex > 1 && colIndex > 0 && /^-?[\d,]*\.?\d+%$/.test(text)) {
          return text.replace(/,/g, "");                       // e.g. 210% — Excel reads this as a percent
        }
        const stripped = String(cell).replace(/[^0-9.-]/g, "");
        const numericValue = Number(stripped);
        const isNumber = rowIndex > 1
          && colIndex > 0
          && cell !== ""
          && cell !== "—"
          && stripped !== ""
          && !isNaN(numericValue)
          && isFinite(numericValue);

        return isNumber
          ? numericValue                                        // bare number, no quotes
          : `"${String(cell).replace(/"/g, '""')}"`;           // quoted string
      }).join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}