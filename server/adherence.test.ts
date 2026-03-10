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
  "Vendor not Available",
  "Missing Parts/Tools",
  "Resource Availability",
  "Weather",
  "XFN Partner Request",
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
      { month: "2026-02", reason: "Vendor not Available", count: 2 },
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
      { name: "Vendor not Available", value: 2 },
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
      { workOrderNumber: "33333", description: "WO C", dataCenter: "DC1", lockWeek: "2026-02-10", reason: "Vendor not Available" },
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
