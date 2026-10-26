/**
 * One quoted CSV cell. Text starting with =, +, -, @, tab or CR is prefixed with ' so a
 * customer name like `=HYPERLINK(...)` can't run as a formula when the export is opened
 * in Excel or Sheets. Numbers are left as-is so negative amounts stay numeric.
 */
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = typeof value === "string" && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(",");
