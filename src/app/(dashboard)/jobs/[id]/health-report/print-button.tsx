"use client";

// Small client island so the print action can live inside the otherwise-static
// server-rendered health report (a server component may not pass an onClick).
export function PrintButton() {
  return (
    <button className="print-btn no-print" onClick={() => window.print()}>
      Print / Save PDF
    </button>
  );
}
