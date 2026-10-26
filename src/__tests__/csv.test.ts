import { describe, expect, it } from "vitest";
import { csvRow } from "@/lib/csv";

describe("csvRow", () => {
  it("quotes text, escapes quotes and neutralizes spreadsheet formulas", () => {
    expect(csvRow(["=HYPERLINK(\"x\")", "Smith, Jo", -12.5, null])).toBe(`"'=HYPERLINK(""x"")","Smith, Jo","-12.5",""`);
  });
});
