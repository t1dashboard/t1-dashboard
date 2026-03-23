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

describe("WO Closure SLA - Invoice WO Detection", () => {
  it("should identify Awaiting Invoice WOs for 21-day SLA", () => {
    const deferralWOs = [
      { "Work Order": "12345", "Deferral Reason Selected": "Awaiting Invoice" },
      { "Work Order": "12346", "Deferral Reason Selected": "Pending Parts" },
      { "Work Order": "12347", "Deferral Reason Selected": "Awaiting Invoice" },
    ];
    
    const invoiceSet = new Set<string>();
    deferralWOs.forEach(dwo => {
      if ((dwo["Deferral Reason Selected"] || "").trim() === "Awaiting Invoice") {
        invoiceSet.add(String(dwo["Work Order"]));
      }
    });
    
    expect(invoiceSet.has("12345")).toBe(true);
    expect(invoiceSet.has("12346")).toBe(false);
    expect(invoiceSet.has("12347")).toBe(true);
    expect(invoiceSet.size).toBe(2);
  });

  it("should assign correct SLA based on invoice status", () => {
    const invoiceSet = new Set(["12345", "12347"]);
    
    expect(invoiceSet.has("12345") ? 21 : 2).toBe(21);
    expect(invoiceSet.has("12346") ? 21 : 2).toBe(2);
    expect(invoiceSet.has("12347") ? 21 : 2).toBe(21);
  });
});
