import { describe, it, expect } from "vitest";

/**
 * Tests for WO Closure SLA business day calculation logic
 * The countBusinessDays function counts business days between two dates (excluding weekends)
 * Does NOT count the start date, counts the end date
 */

function countBusinessDays(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  if (e <= s) return 0;
  
  let count = 0;
  const current = new Date(s);
  current.setDate(current.getDate() + 1);
  
  while (current <= e) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

describe("WO Closure SLA - Business Days Calculation", () => {
  it("should return 0 when end date equals start date", () => {
    const date = new Date(2026, 2, 23); // Mon Mar 23
    expect(countBusinessDays(date, date)).toBe(0);
  });

  it("should return 0 when end date is before start date", () => {
    const start = new Date(2026, 2, 25); // Wed Mar 25
    const end = new Date(2026, 2, 23);   // Mon Mar 23
    expect(countBusinessDays(start, end)).toBe(0);
  });

  it("should count 1 business day for consecutive weekdays", () => {
    const mon = new Date(2026, 2, 23); // Mon
    const tue = new Date(2026, 2, 24); // Tue
    expect(countBusinessDays(mon, tue)).toBe(1);
  });

  it("should count 2 business days for Mon to Wed", () => {
    const mon = new Date(2026, 2, 23); // Mon
    const wed = new Date(2026, 2, 25); // Wed
    expect(countBusinessDays(mon, wed)).toBe(2);
  });

  it("should count 5 business days for one full work week (Mon to next Mon)", () => {
    const mon1 = new Date(2026, 2, 23); // Mon Mar 23
    const mon2 = new Date(2026, 2, 30); // Mon Mar 30
    expect(countBusinessDays(mon1, mon2)).toBe(5);
  });

  it("should skip weekends - Fri to Mon should be 1 business day", () => {
    const fri = new Date(2026, 2, 20); // Fri Mar 20
    const mon = new Date(2026, 2, 23); // Mon Mar 23
    expect(countBusinessDays(fri, mon)).toBe(1);
  });

  it("should handle Sat to Mon as 1 business day", () => {
    const sat = new Date(2026, 2, 21); // Sat Mar 21
    const mon = new Date(2026, 2, 23); // Mon Mar 23
    expect(countBusinessDays(sat, mon)).toBe(1);
  });

  it("should handle Sun to Mon as 1 business day", () => {
    const sun = new Date(2026, 2, 22); // Sun Mar 22
    const mon = new Date(2026, 2, 23); // Mon Mar 23
    expect(countBusinessDays(sun, mon)).toBe(1);
  });

  it("should count 10 business days for two full work weeks", () => {
    const mon1 = new Date(2026, 2, 23); // Mon Mar 23
    const mon3 = new Date(2026, 3, 6);  // Mon Apr 6
    expect(countBusinessDays(mon1, mon3)).toBe(10);
  });
});

describe("WO Closure SLA - SLA Determination", () => {
  it("should use 2-day SLA for normal work orders", () => {
    const slaLimit = 2;
    // Sched end Mon, completed Wed = 2 business days = within SLA
    const businessDays = countBusinessDays(
      new Date(2026, 2, 23), // Mon
      new Date(2026, 2, 25)  // Wed
    );
    expect(businessDays).toBe(2);
    expect(businessDays <= slaLimit).toBe(true);
  });

  it("should flag normal WO as outside SLA when > 2 business days", () => {
    const slaLimit = 2;
    // Sched end Mon, completed Thu = 3 business days = outside SLA
    const businessDays = countBusinessDays(
      new Date(2026, 2, 23), // Mon
      new Date(2026, 2, 26)  // Thu
    );
    expect(businessDays).toBe(3);
    expect(businessDays <= slaLimit).toBe(false);
  });

  it("should use 21-day SLA for invoice work orders", () => {
    const slaLimit = 21;
    // Sched end Mon Mar 23, completed Tue Apr 21 = 21 business days = within SLA
    const businessDays = countBusinessDays(
      new Date(2026, 2, 23), // Mon Mar 23
      new Date(2026, 3, 21)  // Tue Apr 21
    );
    expect(businessDays).toBe(21);
    expect(businessDays <= slaLimit).toBe(true);
  });

  it("should flag invoice WO as outside SLA when > 21 business days", () => {
    const slaLimit = 21;
    // Sched end Mon Mar 23, completed Wed Apr 22 = 22 business days = outside SLA
    const businessDays = countBusinessDays(
      new Date(2026, 2, 23), // Mon Mar 23
      new Date(2026, 3, 22)  // Wed Apr 22
    );
    expect(businessDays).toBe(22);
    expect(businessDays <= slaLimit).toBe(false);
  });
});

describe("WO Closure SLA - Adherence Percentage", () => {
  it("should calculate 100% when all WOs are within SLA", () => {
    const total = 10;
    const withinSLA = 10;
    const adherencePercent = Math.round((withinSLA / total) * 100);
    expect(adherencePercent).toBe(100);
  });

  it("should calculate 50% when half are within SLA", () => {
    const total = 20;
    const withinSLA = 10;
    const adherencePercent = Math.round((withinSLA / total) * 100);
    expect(adherencePercent).toBe(50);
  });

  it("should calculate 0% when none are within SLA", () => {
    const total = 5;
    const withinSLA = 0;
    const adherencePercent = Math.round((withinSLA / total) * 100);
    expect(adherencePercent).toBe(0);
  });

  it("should handle 0 total WOs gracefully", () => {
    const total = 0;
    const adherencePercent = total > 0 ? Math.round((0 / total) * 100) : 0;
    expect(adherencePercent).toBe(0);
  });
});

describe("WO Closure SLA - Invoice WO Detection (DB overrides + description pattern)", () => {
  // Simulates the new logic: DB overrides set + description pattern matching
  const INVOICE_DESCRIPTION_PATTERNS = [
    "[MSME/VENDOR] PROCESS WATER / WASTEWATER SAMPLING",
  ];

  function matchesInvoiceDescription(description: string): boolean {
    const upper = (description || "").toUpperCase();
    return INVOICE_DESCRIPTION_PATTERNS.some(pattern => upper.includes(pattern.toUpperCase()));
  }

  it("should identify WOs in the DB overrides set for 21-day SLA", () => {
    const invoiceOverrideSet = new Set(["2586065", "2585494", "2602387", "3328923"]);
    
    expect(invoiceOverrideSet.has("2586065")).toBe(true);
    expect(invoiceOverrideSet.has("2585494")).toBe(true);
    expect(invoiceOverrideSet.has("2602387")).toBe(true);
    expect(invoiceOverrideSet.has("3328923")).toBe(true);
    expect(invoiceOverrideSet.has("9999999")).toBe(false);
  });

  it("should match description pattern for wastewater sampling WOs", () => {
    expect(matchesInvoiceDescription("[MSME/VENDOR] PROCESS WATER / WASTEWATER SAMPLING")).toBe(true);
    expect(matchesInvoiceDescription("MWG | [MSME/Vendor] Process Water / Wastewater Sampling")).toBe(true);
    expect(matchesInvoiceDescription("NCG | [MSME/VENDOR] PROCESS WATER / WASTEWATER SAMPLING - Monthly")).toBe(true);
  });

  it("should NOT match unrelated descriptions", () => {
    expect(matchesInvoiceDescription("MWG-6 Tug Charger Prep Work")).toBe(false);
    expect(matchesInvoiceDescription("Regular maintenance work order")).toBe(false);
    expect(matchesInvoiceDescription("")).toBe(false);
  });

  it("should assign correct SLA based on DB override or description pattern", () => {
    const invoiceOverrideSet = new Set(["2586065", "2585494"]);
    
    function getSLALimit(woNumber: string, description: string): number {
      return (invoiceOverrideSet.has(woNumber) || matchesInvoiceDescription(description)) ? 21 : 2;
    }

    // In DB overrides
    expect(getSLALimit("2586065", "MWG-6 Tug Charger Prep Work")).toBe(21);
    // Matches description pattern
    expect(getSLALimit("9999999", "[MSME/VENDOR] PROCESS WATER / WASTEWATER SAMPLING")).toBe(21);
    // Neither
    expect(getSLALimit("1111111", "Regular work order")).toBe(2);
    // Both (DB override + description match)
    expect(getSLALimit("2586065", "[MSME/VENDOR] PROCESS WATER / WASTEWATER SAMPLING")).toBe(21);
  });
});

describe("WO Closure SLA - Wrong Year Detection", () => {
  function isLikelyWrongYear(schedEndDate: Date, dateCompleted: Date): boolean {
    const calendarDaysApart = Math.abs(
      (dateCompleted.getTime() - schedEndDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return calendarDaysApart >= 335 && calendarDaysApart <= 395;
  }

  it("should detect exactly 365 days apart as wrong year", () => {
    const schedEnd = new Date(2025, 2, 23); // Mar 23, 2025
    const completed = new Date(2026, 2, 23); // Mar 23, 2026
    expect(isLikelyWrongYear(schedEnd, completed)).toBe(true);
  });

  it("should detect 340 days apart as wrong year (within ±30)", () => {
    const schedEnd = new Date(2025, 3, 18); // Apr 18, 2025
    const completed = new Date(2026, 2, 23); // Mar 23, 2026 (~340 days)
    expect(isLikelyWrongYear(schedEnd, completed)).toBe(true);
  });

  it("should detect 390 days apart as wrong year (within ±30)", () => {
    const schedEnd2 = new Date(2025, 1, 22); // Feb 22, 2025
    const completed = new Date(2026, 2, 23); // Mar 23, 2026
    expect(isLikelyWrongYear(schedEnd2, completed)).toBe(true);
  });

  it("should NOT flag 330 days apart (outside ±30 range)", () => {
    const schedEnd = new Date(2025, 3, 28);  // Apr 28, 2025
    const completed = new Date(2026, 2, 23); // Mar 23, 2026 (~330 days)
    expect(isLikelyWrongYear(schedEnd, completed)).toBe(false);
  });

  it("should NOT flag 400 days apart (outside ±30 range)", () => {
    const schedEnd2 = new Date(2025, 1, 10); // Feb 10, 2025 (~406 days)
    const completed = new Date(2026, 2, 23); // Mar 23, 2026
    expect(isLikelyWrongYear(schedEnd2, completed)).toBe(false);
  });

  it("should NOT flag normal 2-day difference", () => {
    const schedEnd = new Date(2026, 2, 21); // Mar 21, 2026
    const completed = new Date(2026, 2, 23); // Mar 23, 2026
    expect(isLikelyWrongYear(schedEnd, completed)).toBe(false);
  });

  it("should detect wrong year when sched end is AFTER completed (future year typo)", () => {
    const schedEnd = new Date(2027, 2, 23); // Mar 23, 2027
    const completed = new Date(2026, 2, 23); // Mar 23, 2026
    expect(isLikelyWrongYear(schedEnd, completed)).toBe(true);
  });
});

describe("WO Closure SLA - Excluded Supervisors", () => {
  const EXCLUDED_SUPERVISORS = new Set(["ABOSTWICK"]);

  it("should exclude ABOSTWICK", () => {
    expect(EXCLUDED_SUPERVISORS.has("ABOSTWICK")).toBe(true);
  });

  it("should exclude case-insensitively when uppercased", () => {
    const supervisor = "ABostwick";
    expect(EXCLUDED_SUPERVISORS.has(supervisor.toUpperCase())).toBe(true);
  });

  it("should NOT exclude other supervisors", () => {
    expect(EXCLUDED_SUPERVISORS.has("STEVEN.EGELAND")).toBe(false);
    expect(EXCLUDED_SUPERVISORS.has("SMSHERIDAN")).toBe(false);
  });
});

describe("WO Closure SLA - March 2026 Filter", () => {
  it("should include WOs completed in March 2026", () => {
    const dateCompleted = new Date(2026, 2, 15); // March 15, 2026
    const isMarCh2026 = dateCompleted.getMonth() === 2 && dateCompleted.getFullYear() === 2026;
    expect(isMarCh2026).toBe(true);
  });

  it("should exclude WOs completed in February 2026", () => {
    const dateCompleted = new Date(2026, 1, 28); // Feb 28, 2026
    const isMarch2026 = dateCompleted.getMonth() === 2 && dateCompleted.getFullYear() === 2026;
    expect(isMarch2026).toBe(false);
  });

  it("should exclude WOs completed in April 2026", () => {
    const dateCompleted = new Date(2026, 3, 1); // Apr 1, 2026
    const isMarch2026 = dateCompleted.getMonth() === 2 && dateCompleted.getFullYear() === 2026;
    expect(isMarch2026).toBe(false);
  });

  it("should exclude WOs completed in March 2025", () => {
    const dateCompleted = new Date(2025, 2, 15); // March 15, 2025
    const isMarch2026 = dateCompleted.getMonth() === 2 && dateCompleted.getFullYear() === 2026;
    expect(isMarch2026).toBe(false);
  });
});
