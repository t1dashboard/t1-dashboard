import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db.js", () => ({
  query: vi.fn(),
  execute: vi.fn(),
}));

import { query, execute } from "./db.js";
const mockedQuery = vi.mocked(query);
const mockedExecute = vi.mocked(execute);

const VALID_REASONS = [
  "Vendor Not Available/Prepared",
  "Missing Parts/Tools",
  "Resource Availability",
  "Weather",
  "XFN Partner Request",
  "Risk Mitigation",
  "SOW Changed",
];

describe("Schedule Adherence - Reason Validation", () => {
  it("should accept all valid reasons", () => {
    VALID_REASONS.forEach(reason => {
      expect(VALID_REASONS.includes(reason)).toBe(true);
    });
  });

  it("should reject invalid reasons", () => {
    const invalidReasons = ["Other", "Unknown", "", "Budget Issues", "Scheduling Conflict"];
    invalidReasons.forEach(reason => {
      expect(VALID_REASONS.includes(reason)).toBe(false);
    });
  });
});

describe("Schedule Adherence - Data Mapping", () => {
  it("should map adherence record to database insert values", () => {
    const record = {
      workOrderNumber: "12345",
      description: "Test WO",
      dataCenter: "DC1",
      lockWeek: "2026-02-10",
      reason: "Weather",
    };

    const values = [
      String(record.workOrderNumber),
      record.description || null,
      record.dataCenter || null,
      record.lockWeek,
      record.reason,
    ];

    expect(values).toHaveLength(5);
    expect(values[0]).toBe("12345");
    expect(values[1]).toBe("Test WO");
    expect(values[2]).toBe("DC1");
    expect(values[3]).toBe("2026-02-10");
    expect(values[4]).toBe("Weather");
  });

  it("should handle null description and dataCenter", () => {
    const record = {
      workOrderNumber: "67890",
      description: null as string | null,
      dataCenter: null as string | null,
      lockWeek: "2026-03-03",
      reason: "Missing Parts/Tools",
    };

    const values = [
      String(record.workOrderNumber),
      record.description || null,
      record.dataCenter || null,
      record.lockWeek,
      record.reason,
    ];

    expect(values[1]).toBeNull();
    expect(values[2]).toBeNull();
    expect(values[4]).toBe("Missing Parts/Tools");
  });

  it("should map database rows to AdherenceRecord format", () => {
    const dbRow = {
      id: 1,
      work_order_number: "12345",
      description: "Test WO",
      data_center: "DC1",
      lock_week: "2026-02-10",
      reason: "Weather",
      submitted_at: "2026-02-17T12:00:00.000Z",
    };

    const mapped = {
      id: dbRow.id,
      workOrderNumber: dbRow.work_order_number,
      description: dbRow.description,
      dataCenter: dbRow.data_center,
      lockWeek: dbRow.lock_week,
      reason: dbRow.reason,
      submittedAt: dbRow.submitted_at,
    };

    expect(mapped.id).toBe(1);
    expect(mapped.workOrderNumber).toBe("12345");
    expect(mapped.reason).toBe("Weather");
    expect(mapped.lockWeek).toBe("2026-02-10");
  });
});

describe("Schedule Adherence - Summary Aggregation", () => {
  it("should group summary data by month and reason", () => {
    const summaryRows = [
      { month: "2026-02", reason: "Weather", count: 3 },
      { month: "2026-02", reason: "Missing Parts/Tools", count: 5 },
      { month: "2026-02", reason: "Vendor Not Available/Prepared", count: 2 },
      { month: "2026-01", reason: "Weather", count: 1 },
      { month: "2026-01", reason: "Resource Availability", count: 4 },
    ];

    // Group by month
    const monthMap = new Map<string, Map<string, number>>();
    summaryRows.forEach(row => {
      if (!monthMap.has(row.month)) {
        monthMap.set(row.month, new Map());
      }
      monthMap.get(row.month)!.set(row.reason, Number(row.count));
    });

    expect(monthMap.size).toBe(2);
    expect(monthMap.get("2026-02")!.size).toBe(3);
    expect(monthMap.get("2026-01")!.size).toBe(2);
    expect(monthMap.get("2026-02")!.get("Weather")).toBe(3);
    expect(monthMap.get("2026-01")!.get("Resource Availability")).toBe(4);
  });

  it("should calculate correct percentages", () => {
    const reasons = [
      { name: "Weather", value: 3 },
      { name: "Missing Parts/Tools", value: 5 },
      { name: "Vendor Not Available/Prepared", value: 2 },
    ];
    const total = reasons.reduce((sum, r) => sum + r.value, 0);

    const withPercentages = reasons.map(r => ({
      ...r,
      percentage: ((r.value / total) * 100).toFixed(1),
    }));

    expect(total).toBe(10);
    expect(withPercentages[0].percentage).toBe("30.0"); // 3/10
    expect(withPercentages[1].percentage).toBe("50.0"); // 5/10
    expect(withPercentages[2].percentage).toBe("20.0"); // 2/10
  });

  it("should sort months in descending order", () => {
    const months = ["2026-01", "2026-03", "2026-02"];
    const sorted = [...months].sort((a, b) => b.localeCompare(a));

    expect(sorted[0]).toBe("2026-03");
    expect(sorted[1]).toBe("2026-02");
    expect(sorted[2]).toBe("2026-01");
  });
});

describe("Schedule Adherence - Batch Submission Validation", () => {
  it("should require workOrderNumber and lockWeek for each record", () => {
    const validRecords = [
      { workOrderNumber: "12345", lockWeek: "2026-02-10", reason: "Weather" },
      { workOrderNumber: "67890", lockWeek: "2026-02-10", reason: "Weather" },
    ];

    const invalidRecords = [
      { workOrderNumber: "", lockWeek: "2026-02-10", reason: "Weather" },
      { workOrderNumber: "12345", lockWeek: "", reason: "Weather" },
    ];

    validRecords.forEach(r => {
      expect(r.workOrderNumber).toBeTruthy();
      expect(r.lockWeek).toBeTruthy();
    });

    invalidRecords.forEach(r => {
      expect(!r.workOrderNumber || !r.lockWeek).toBe(true);
    });
  });

  it("should handle multiple records in a single submission", () => {
    const records = [
      { workOrderNumber: "11111", description: "WO A", dataCenter: "DC1", lockWeek: "2026-02-10", reason: "Weather" },
      { workOrderNumber: "22222", description: "WO B", dataCenter: "DC2", lockWeek: "2026-02-10", reason: "Missing Parts/Tools" },
      { workOrderNumber: "33333", description: "WO C", dataCenter: "DC1", lockWeek: "2026-02-10", reason: "Vendor Not Available/Prepared" },
    ];

    // Build SQL values like the API does
    const sql = `INSERT INTO schedule_adherence (
      work_order_number, description, data_center, lock_week, reason
    ) VALUES ${records.map(() => "(?, ?, ?, ?, ?)").join(", ")}`;

    const values = records.flatMap(r => [
      String(r.workOrderNumber),
      r.description || null,
      r.dataCenter || null,
      r.lockWeek,
      r.reason,
    ]);

    expect(values).toHaveLength(15); // 3 records * 5 fields
    expect(sql).toContain("(?, ?, ?, ?, ?), (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)");
  });
});

describe("Schedule Adherence - Lock Week Calculation", () => {
  it("should calculate the correct lock week for incomplete orders", () => {
    // The lock week for incomplete orders is 2 weeks before the current week's Monday
    // If today is in the week of March 10, 2026 (Monday):
    // - This Monday: March 9, 2026
    // - Last Monday: March 2, 2026
    // - Lock created Monday (2 weeks back): Feb 23, 2026
    const today = new Date("2026-03-10");
    const currentDay = today.getDay();
    const diff = currentDay === 0 ? -6 : 1 - currentDay;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    
    const lockCreatedMonday = new Date(lastMonday);
    lockCreatedMonday.setDate(lastMonday.getDate() - 7);
    
    const toDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    
    expect(toDateStr(thisMonday)).toBe("2026-03-09");
    expect(toDateStr(lastMonday)).toBe("2026-03-02");
    expect(toDateStr(lockCreatedMonday)).toBe("2026-02-23");
  });
});

describe("Schedule Adherence - Quarterly Aggregation", () => {
  it("should correctly map months to quarters", () => {
    const getQuarterKey = (monthStr: string): string => {
      const [year, month] = monthStr.split("-");
      const m = parseInt(month, 10);
      const q = Math.ceil(m / 3);
      return `${year}-Q${q}`;
    };

    expect(getQuarterKey("2026-01")).toBe("2026-Q1");
    expect(getQuarterKey("2026-02")).toBe("2026-Q1");
    expect(getQuarterKey("2026-03")).toBe("2026-Q1");
    expect(getQuarterKey("2026-04")).toBe("2026-Q2");
    expect(getQuarterKey("2026-06")).toBe("2026-Q2");
    expect(getQuarterKey("2026-07")).toBe("2026-Q3");
    expect(getQuarterKey("2026-09")).toBe("2026-Q3");
    expect(getQuarterKey("2026-10")).toBe("2026-Q4");
    expect(getQuarterKey("2026-12")).toBe("2026-Q4");
  });

  it("should aggregate monthly data into quarterly totals", () => {
    const summaryRows = [
      { month: "2026-01", reason: "Weather", count: 3 },
      { month: "2026-02", reason: "Weather", count: 5 },
      { month: "2026-02", reason: "Risk Mitigation", count: 2 },
      { month: "2026-03", reason: "Vendor Not Available/Prepared", count: 4 },
      { month: "2026-04", reason: "Weather", count: 1 },
    ];

    const getQuarterKey = (monthStr: string): string => {
      const [year, month] = monthStr.split("-");
      const m = parseInt(month, 10);
      const q = Math.ceil(m / 3);
      return `${year}-Q${q}`;
    };

    const quarterMap = new Map<string, Map<string, number>>();
    summaryRows.forEach(row => {
      const qKey = getQuarterKey(row.month);
      if (!quarterMap.has(qKey)) {
        quarterMap.set(qKey, new Map());
      }
      const reasonMap = quarterMap.get(qKey)!;
      reasonMap.set(row.reason, (reasonMap.get(row.reason) || 0) + Number(row.count));
    });

    expect(quarterMap.size).toBe(2); // Q1 and Q2
    expect(quarterMap.get("2026-Q1")!.get("Weather")).toBe(8); // 3 + 5
    expect(quarterMap.get("2026-Q1")!.get("Risk Mitigation")).toBe(2);
    expect(quarterMap.get("2026-Q1")!.get("Vendor Not Available/Prepared")).toBe(4);
    expect(quarterMap.get("2026-Q2")!.get("Weather")).toBe(1);
  });

  it("should format quarter labels correctly", () => {
    const getQuarterLabel = (quarterKey: string): string => {
      const [year, q] = quarterKey.split("-Q");
      return `Q${q} ${year}`;
    };

    expect(getQuarterLabel("2026-Q1")).toBe("Q1 2026");
    expect(getQuarterLabel("2026-Q2")).toBe("Q2 2026");
    expect(getQuarterLabel("2026-Q3")).toBe("Q3 2026");
    expect(getQuarterLabel("2026-Q4")).toBe("Q4 2026");
  });

  it("should sort quarters in descending order", () => {
    const quarters = ["2026-Q1", "2025-Q4", "2026-Q2"];
    const sorted = [...quarters].sort((a, b) => b.localeCompare(a));

    expect(sorted[0]).toBe("2026-Q2");
    expect(sorted[1]).toBe("2026-Q1");
    expect(sorted[2]).toBe("2025-Q4");
  });
});

describe("Schedule Adherence - Reason Categories", () => {
  it("should include Vendor Not Available/Prepared as a combined reason", () => {
    expect(VALID_REASONS.includes("Vendor Not Available/Prepared")).toBe(true);
  });

  it("should include Risk Mitigation as a valid reason", () => {
    expect(VALID_REASONS.includes("Risk Mitigation")).toBe(true);
  });


  it("should include SOW Changed as a valid reason", () => {
    expect(VALID_REASONS.includes("SOW Changed")).toBe(true);
  });

  it("should have 7 total reason categories", () => {
    expect(VALID_REASONS).toHaveLength(7);
  });

  it("should NOT have separate Vendor not Available or Vendor Not Prepared", () => {
    expect(VALID_REASONS.includes("Vendor not Available")).toBe(false);
    expect(VALID_REASONS.includes("Vendor Not Prepared")).toBe(false);
  });
});

describe("Schedule Adherence - Month Formatting", () => {
  it("should format month strings correctly", () => {
    const formatMonth = (monthStr: string): string => {
      const [year, month] = monthStr.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthIndex = parseInt(month, 10) - 1;
      return `${monthNames[monthIndex]} ${year}`;
    };

    expect(formatMonth("2026-01")).toBe("Jan 2026");
    expect(formatMonth("2026-02")).toBe("Feb 2026");
    expect(formatMonth("2026-12")).toBe("Dec 2026");
  });
});

describe("Schedule Adherence - Adherence Percentage Calculation", () => {
  /** Helper: compute month from lockWeek (T1 week = lockWeek + 7 days) */
  function getMonthFromLockWeek(lockWeek: string): string {
    const weekDate = new Date(lockWeek + "T00:00:00");
    const t1Monday = new Date(weekDate);
    t1Monday.setDate(weekDate.getDate() + 7);
    const year = t1Monday.getFullYear();
    const month = String(t1Monday.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }

  it("should calculate reason-based adherence percentage correctly", () => {
    // 20 locked, 4 with reasons = 16 adhered = 80%
    const stats = { totalLocked: 20, withReason: 4 };
    const adhered = stats.totalLocked - stats.withReason;
    const percent = Math.round((adhered / stats.totalLocked) * 100);
    expect(percent).toBe(80);
  });

  it("should handle 100% adherence (no reasons submitted)", () => {
    const stats = { totalLocked: 15, withReason: 0 };
    const adhered = stats.totalLocked - stats.withReason;
    const percent = Math.round((adhered / stats.totalLocked) * 100);
    expect(percent).toBe(100);
  });

  it("should handle 0% adherence (all have reasons)", () => {
    const stats = { totalLocked: 10, withReason: 10 };
    const adhered = stats.totalLocked - stats.withReason;
    const percent = Math.round((adhered / stats.totalLocked) * 100);
    expect(percent).toBe(0);
  });

  it("should handle zero locked WOs gracefully", () => {
    const stats = { totalLocked: 0, withReason: 0 };
    const percent = stats.totalLocked > 0 ? Math.round(((stats.totalLocked - stats.withReason) / stats.totalLocked) * 100) : 0;
    expect(percent).toBe(0);
  });

  it("should round adherence percentage to nearest integer", () => {
    // 3 locked, 1 with reason = 2 adhered = 66.67% → 67
    const stats = { totalLocked: 3, withReason: 1 };
    const adhered = stats.totalLocked - stats.withReason;
    const percent = Math.round((adhered / stats.totalLocked) * 100);
    expect(percent).toBe(67);
  });

  it("should aggregate weekly stats into monthly adherence", () => {
    const weeklyStats = [
      { lockWeek: "2026-02-09", totalLocked: 20, withReason: 5, adhered: 15, adherencePercent: 75 },
      { lockWeek: "2026-02-16", totalLocked: 25, withReason: 5, adhered: 20, adherencePercent: 80 },
      { lockWeek: "2026-02-23", totalLocked: 30, withReason: 8, adhered: 22, adherencePercent: 73 },
    ];

    const monthMap = new Map<string, { totalLocked: number; withReason: number }>();
    weeklyStats.forEach(stat => {
      const month = getMonthFromLockWeek(stat.lockWeek);
      if (!monthMap.has(month)) {
        monthMap.set(month, { totalLocked: 0, withReason: 0 });
      }
      const entry = monthMap.get(month)!;
      entry.totalLocked += stat.totalLocked;
      entry.withReason += stat.withReason;
    });

    // All three lock weeks (Feb 9, 16, 23) map to T1 weeks starting Feb 16, 23, Mar 2
    // Feb 9 → T1 week starts Feb 16 → month 2026-02
    // Feb 16 → T1 week starts Feb 23 → month 2026-02
    // Feb 23 → T1 week starts Mar 2 → month 2026-03
    const feb = monthMap.get("2026-02");
    const mar = monthMap.get("2026-03");

    expect(feb).toBeDefined();
    expect(mar).toBeDefined();
    expect(feb!.totalLocked).toBe(45); // 20 + 25
    expect(feb!.withReason).toBe(10); // 5 + 5
    expect(mar!.totalLocked).toBe(30);
    expect(mar!.withReason).toBe(8);

    const febAdhered = feb!.totalLocked - feb!.withReason;
    const febPercent = Math.round((febAdhered / feb!.totalLocked) * 100);
    expect(febPercent).toBe(78); // 35/45 = 77.78 → 78

    const marAdhered = mar!.totalLocked - mar!.withReason;
    const marPercent = Math.round((marAdhered / mar!.totalLocked) * 100);
    expect(marPercent).toBe(73); // 22/30
  });

  it("should correctly determine T1 month from lock week", () => {
    // lockWeek is when the lock was created (a Monday)
    // T1 week = lockWeek + 7 days
    expect(getMonthFromLockWeek("2026-01-26")).toBe("2026-02"); // T1 starts Feb 2
    expect(getMonthFromLockWeek("2026-02-23")).toBe("2026-03"); // T1 starts Mar 2
    expect(getMonthFromLockWeek("2026-03-23")).toBe("2026-03"); // T1 starts Mar 30
    expect(getMonthFromLockWeek("2026-03-30")).toBe("2026-04"); // T1 starts Apr 6
  });

  it("should aggregate monthly adherence into quarterly adherence", () => {
    const monthlyAdherence = [
      { month: "2026-01", totalLocked: 50, withReason: 10 },
      { month: "2026-02", totalLocked: 60, withReason: 15 },
      { month: "2026-03", totalLocked: 55, withReason: 5 },
    ];

    const getQuarterKey = (monthStr: string): string => {
      const [year, month] = monthStr.split("-");
      const m = parseInt(month, 10);
      const q = Math.ceil(m / 3);
      return `${year}-Q${q}`;
    };

    const quarterMap = new Map<string, { totalLocked: number; withReason: number }>();
    monthlyAdherence.forEach(ma => {
      const qKey = getQuarterKey(ma.month);
      if (!quarterMap.has(qKey)) {
        quarterMap.set(qKey, { totalLocked: 0, withReason: 0 });
      }
      const entry = quarterMap.get(qKey)!;
      entry.totalLocked += ma.totalLocked;
      entry.withReason += ma.withReason;
    });

    const q1 = quarterMap.get("2026-Q1")!;
    expect(q1.totalLocked).toBe(165); // 50 + 60 + 55
    expect(q1.withReason).toBe(30); // 10 + 15 + 5

    const q1Adhered = q1.totalLocked - q1.withReason;
    const q1Percent = Math.round((q1Adhered / q1.totalLocked) * 100);
    expect(q1Percent).toBe(82); // 135/165 = 81.8 → 82
  });

  it("should color-code adherence percentages correctly", () => {
    const getAdherenceColor = (percent: number): string => {
      if (percent >= 80) return "green";
      if (percent >= 60) return "yellow";
      return "red";
    };

    expect(getAdherenceColor(100)).toBe("green");
    expect(getAdherenceColor(80)).toBe("green");
    expect(getAdherenceColor(79)).toBe("yellow");
    expect(getAdherenceColor(60)).toBe("yellow");
    expect(getAdherenceColor(59)).toBe("red");
    expect(getAdherenceColor(0)).toBe("red");
  });
});

describe("Schedule Adherence - Sched Start Date Moved Detection", () => {
  it("should detect date-moved orders: completed but sched date changed", () => {
    const lockedOrders = [
      { workOrderNumber: "111", schedStartDate: "2026-03-10", status: "Ready" },
      { workOrderNumber: "222", schedStartDate: "2026-03-11", status: "Ready" },
      { workOrderNumber: "333", schedStartDate: "2026-03-12", status: "Ready" },
    ];

    const currentWorkOrders = [
      { workOrderNumber: "111", schedStartDate: "2026-03-10", status: "Work Complete" }, // same date, completed
      { workOrderNumber: "222", schedStartDate: "2026-03-18", status: "Closed" },        // date moved, completed
      { workOrderNumber: "333", schedStartDate: "2026-03-12", status: "Ready" },          // same date, not completed
    ];

    const dateMoved = lockedOrders.filter(locked => {
      const current = currentWorkOrders.find(wo => wo.workOrderNumber === locked.workOrderNumber);
      if (!current) return false;
      const isCompleted = current.status === "Work Complete" || current.status === "Closed";
      if (!isCompleted) return false;
      return locked.schedStartDate !== current.schedStartDate;
    });

    expect(dateMoved).toHaveLength(1);
    expect(dateMoved[0].workOrderNumber).toBe("222");
  });

  it("should not flag completed orders with same sched date as date-moved", () => {
    const lockedOrders = [
      { workOrderNumber: "111", schedStartDate: "2026-03-10", status: "Ready" },
    ];

    const currentWorkOrders = [
      { workOrderNumber: "111", schedStartDate: "2026-03-10", status: "Work Complete" },
    ];

    const dateMoved = lockedOrders.filter(locked => {
      const current = currentWorkOrders.find(wo => wo.workOrderNumber === locked.workOrderNumber);
      if (!current) return false;
      const isCompleted = current.status === "Work Complete" || current.status === "Closed";
      if (!isCompleted) return false;
      return locked.schedStartDate !== current.schedStartDate;
    });

    expect(dateMoved).toHaveLength(0);
  });

  it("should not flag incomplete orders as date-moved even if date changed", () => {
    const lockedOrders = [
      { workOrderNumber: "111", schedStartDate: "2026-03-10", status: "Ready" },
    ];

    const currentWorkOrders = [
      { workOrderNumber: "111", schedStartDate: "2026-03-18", status: "Ready" },
    ];

    const dateMoved = lockedOrders.filter(locked => {
      const current = currentWorkOrders.find(wo => wo.workOrderNumber === locked.workOrderNumber);
      if (!current) return false;
      const isCompleted = current.status === "Work Complete" || current.status === "Closed";
      if (!isCompleted) return false;
      return locked.schedStartDate !== current.schedStartDate;
    });

    expect(dateMoved).toHaveLength(0);
  });

  it("should include date-moved reasons in total adherence count", () => {
    // 20 locked total, 3 incomplete with reasons, 2 date-moved with reasons = 5 total with reasons
    const totalLocked = 20;
    const incompleteWithReason = 3;
    const dateMovedWithReason = 2;
    const totalWithReason = incompleteWithReason + dateMovedWithReason;
    const adhered = totalLocked - totalWithReason;
    const percent = Math.round((adhered / totalLocked) * 100);
    expect(percent).toBe(75); // 15/20
  });

  it("should keep date-moved and incomplete as separate sections but combine for submission", () => {
    const incompleteOrders = [
      { workOrderNumber: "111", reason: "Weather" },
      { workOrderNumber: "222", reason: "Missing Parts/Tools" },
    ];
    const dateMovedOrders = [
      { workOrderNumber: "333", reason: "SOW Changed" },
    ];

    const allRecords = [...incompleteOrders, ...dateMovedOrders];
    expect(allRecords).toHaveLength(3);
    expect(allRecords.map(r => r.workOrderNumber)).toEqual(["111", "222", "333"]);
  });
});

describe("Schedule Adherence - Date Moved Routine Maintenance Exclusion", () => {
  function shouldIncludeInDateMoved(description: string): boolean {
    const desc = description.toUpperCase();
    const isRoutine = desc.includes("DAILY") || desc.includes("MONTHLY") || desc.includes("QUARTERLY");
    const hasKitchen = desc.includes("KITCHEN");
    if (isRoutine && !hasKitchen) return false;
    return true;
  }

  it("should exclude DAILY maintenance from date-moved", () => {
    expect(shouldIncludeInDateMoved("GNS-NCG1 Daily AHU Inspection")).toBe(false);
  });

  it("should exclude MONTHLY maintenance from date-moved", () => {
    expect(shouldIncludeInDateMoved("GNS-MWG2 Monthly Generator Check")).toBe(false);
  });

  it("should exclude QUARTERLY maintenance from date-moved", () => {
    expect(shouldIncludeInDateMoved("GNS-NCG Quarterly UPS PM")).toBe(false);
  });

  it("should include DAILY kitchen maintenance in date-moved", () => {
    expect(shouldIncludeInDateMoved("GNS-NCG1 Daily Kitchen Cleaning")).toBe(true);
  });

  it("should include MONTHLY kitchen maintenance in date-moved", () => {
    expect(shouldIncludeInDateMoved("GNS-MWG1 Monthly Kitchen Equipment PM")).toBe(true);
  });

  it("should include QUARTERLY kitchen maintenance in date-moved", () => {
    expect(shouldIncludeInDateMoved("Quarterly Kitchen Hood Inspection")).toBe(true);
  });

  it("should include non-routine work orders in date-moved", () => {
    expect(shouldIncludeInDateMoved("GNS-NCG1 EG-N1 6A")).toBe(true);
    expect(shouldIncludeInDateMoved("GNS-MWG2 MSB-S1 Replace Breaker")).toBe(true);
  });

  it("should be case-insensitive", () => {
    expect(shouldIncludeInDateMoved("daily inspection")).toBe(false);
    expect(shouldIncludeInDateMoved("DAILY KITCHEN cleanup")).toBe(true);
    expect(shouldIncludeInDateMoved("Monthly check")).toBe(false);
  });
});

describe("Schedule Adherence - Date Moved Direction Filter", () => {
  function shouldIncludeInDateMoved(lockedDate: string, currentDate: string): boolean {
    if (lockedDate === currentDate || lockedDate === "" || currentDate === "") return false;
    // Only include if date moved later (pushed back), not earlier (completed early)
    return currentDate > lockedDate;
  }

  it("should include WO whose date moved later in the week", () => {
    // Locked for Monday, moved to Wednesday
    expect(shouldIncludeInDateMoved("2026-03-16", "2026-03-18")).toBe(true);
  });

  it("should include WO whose date moved to next week", () => {
    // Locked for Friday, moved to next Monday
    expect(shouldIncludeInDateMoved("2026-03-20", "2026-03-23")).toBe(true);
  });

  it("should exclude WO completed early (date moved earlier in the week)", () => {
    // Locked for Wednesday, completed on Monday
    expect(shouldIncludeInDateMoved("2026-03-18", "2026-03-16")).toBe(false);
  });

  it("should exclude WO completed early (date moved to previous week)", () => {
    // Locked for Monday, completed previous Friday
    expect(shouldIncludeInDateMoved("2026-03-16", "2026-03-13")).toBe(false);
  });

  it("should exclude WO with same date (no change)", () => {
    expect(shouldIncludeInDateMoved("2026-03-16", "2026-03-16")).toBe(false);
  });

  it("should exclude WO with empty dates", () => {
    expect(shouldIncludeInDateMoved("", "2026-03-16")).toBe(false);
    expect(shouldIncludeInDateMoved("2026-03-16", "")).toBe(false);
    expect(shouldIncludeInDateMoved("", "")).toBe(false);
  });
});
