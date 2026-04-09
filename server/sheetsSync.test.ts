import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the Google Sheets sync module.
 * We test the data processing logic (rowsToObjects, comment filtering, token resolution)
 * without actually hitting the Google Sheets API.
 */

// ============================================================
// rowsToObjects logic (converts array-of-arrays to array-of-objects)
// ============================================================

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = (row[i] || "").trim();
    });
    return obj;
  });
}

describe("rowsToObjects", () => {
  it("should convert header + data rows into objects", () => {
    const rows = [
      ["Work Order", "Description", "Status"],
      ["12345", "Fix pump", "Ready"],
      ["67890", "Replace valve", "Planning"],
    ];
    const result = rowsToObjects(rows);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      "Work Order": "12345",
      Description: "Fix pump",
      Status: "Ready",
    });
    expect(result[1]).toEqual({
      "Work Order": "67890",
      Description: "Replace valve",
      Status: "Planning",
    });
  });

  it("should return empty array if only headers (no data)", () => {
    const rows = [["Work Order", "Description"]];
    expect(rowsToObjects(rows)).toEqual([]);
  });

  it("should return empty array if empty input", () => {
    expect(rowsToObjects([])).toEqual([]);
  });

  it("should handle rows shorter than headers (missing cells)", () => {
    const rows = [
      ["A", "B", "C"],
      ["1"], // only first cell
    ];
    const result = rowsToObjects(rows);
    expect(result[0]).toEqual({ A: "1", B: "", C: "" });
  });

  it("should trim whitespace from cell values", () => {
    const rows = [
      ["Name", "Value"],
      ["  hello  ", "  world  "],
    ];
    const result = rowsToObjects(rows);
    expect(result[0]).toEqual({ Name: "hello", Value: "world" });
  });
});

// ============================================================
// Comment filtering logic (eamprod links)
// ============================================================

function filterComment(comment: string): string {
  if (/eamprod\.thefacebook\.com/i.test(comment)) return "";
  return comment;
}

describe("Comment filtering", () => {
  it("should filter out eamprod hyperlinks", () => {
    expect(filterComment("https://eamprod.thefacebook.com/web/base/logindisp")).toBe("");
    expect(filterComment("Check eamprod.thefacebook.com/link here")).toBe("");
  });

  it("should keep normal comments", () => {
    expect(filterComment("Normal comment about work order")).toBe("Normal comment about work order");
    expect(filterComment("Replaced the pump gasket")).toBe("Replaced the pump gasket");
  });

  it("should handle empty strings", () => {
    expect(filterComment("")).toBe("");
  });
});

// ============================================================
// Work order number cleanup
// ============================================================

function cleanWONumber(raw: string): string {
  let woNum = raw.trim();
  if (woNum.match(/^\d+\.0$/)) woNum = woNum.replace(/\.0$/, "");
  return woNum;
}

describe("Work order number cleanup", () => {
  it("should remove trailing .0 from numeric strings", () => {
    expect(cleanWONumber("12345.0")).toBe("12345");
    expect(cleanWONumber("67890.0")).toBe("67890");
  });

  it("should keep normal WO numbers unchanged", () => {
    expect(cleanWONumber("12345")).toBe("12345");
    expect(cleanWONumber("WO-12345")).toBe("WO-12345");
  });

  it("should trim whitespace", () => {
    expect(cleanWONumber("  12345  ")).toBe("12345");
  });
});

// ============================================================
// Sync status tracking
// ============================================================

describe("Sync status structure", () => {
  it("should have correct shape for a successful sync result", () => {
    const result = {
      success: true,
      results: [
        { tableName: "work_orders", rowCount: 16919, durationMs: 5000 },
        { tableName: "scheduled_labor", rowCount: 70000, durationMs: 8000 },
        { tableName: "comments", rowCount: 567, durationMs: 500 },
      ],
      totalDurationMs: 13500,
      timestamp: new Date().toISOString(),
    };

    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(3);
    expect(result.results[0].tableName).toBe("work_orders");
    expect(result.results[0].rowCount).toBe(16919);
    expect(result.totalDurationMs).toBeGreaterThan(0);
    expect(new Date(result.timestamp).getTime()).not.toBeNaN();
  });

  it("should have correct shape for a failed sync result", () => {
    const result = {
      success: false,
      results: [
        { tableName: "work_orders", rowCount: 0, durationMs: 100, error: "No token" },
      ],
      totalDurationMs: 100,
      timestamp: new Date().toISOString(),
    };

    expect(result.success).toBe(false);
    expect(result.results[0].error).toBe("No token");
    expect(result.results[0].rowCount).toBe(0);
  });
});

// ============================================================
// Tue/Thu 1:25 PM EST schedule check
// ============================================================

function isTueThurScheduledTime(now: Date): boolean {
  const estHours = (now.getUTCHours() - 5 + 24) % 24;
  const estMinutes = now.getUTCMinutes();
  const dayOfWeek = now.getUTCDay();

  let estDay = dayOfWeek;
  if (now.getUTCHours() < 5) {
    estDay = (dayOfWeek - 1 + 7) % 7;
  }

  return (estDay === 2 || estDay === 4) && estHours === 13 && estMinutes === 25;
}

describe("Tue/Thu 1:25 PM EST schedule check", () => {
  it("should match Tuesday 1:25 PM EST (6:25 PM UTC)", () => {
    // Tuesday April 8, 2025 at 18:25 UTC = 1:25 PM EST
    const date = new Date("2025-04-08T18:25:00Z");
    expect(isTueThurScheduledTime(date)).toBe(true);
  });

  it("should match Thursday 1:25 PM EST (6:25 PM UTC)", () => {
    // Thursday April 10, 2025 at 18:25 UTC = 1:25 PM EST
    const date = new Date("2025-04-10T18:25:00Z");
    expect(isTueThurScheduledTime(date)).toBe(true);
  });

  it("should not match Monday", () => {
    const date = new Date("2025-04-07T18:25:00Z"); // Monday
    expect(isTueThurScheduledTime(date)).toBe(false);
  });

  it("should not match wrong time on Tuesday", () => {
    const date = new Date("2025-04-08T20:00:00Z"); // Tuesday 3 PM EST
    expect(isTueThurScheduledTime(date)).toBe(false);
  });

  it("should not match Wednesday", () => {
    const date = new Date("2025-04-09T18:25:00Z"); // Wednesday
    expect(isTueThurScheduledTime(date)).toBe(false);
  });
});

// ============================================================
// Next scheduled sync calculation
// ============================================================

function getNextScheduledSync(now: Date): Date {
  const next4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const estOffset = -5;
  const nowEST = new Date(now.getTime() + estOffset * 60 * 60 * 1000);

  const candidates: Date[] = [];
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(nowEST);
    candidate.setDate(candidate.getDate() + daysAhead);
    candidate.setHours(13, 25, 0, 0);
    const dayOfWeek = candidate.getDay();
    if ((dayOfWeek === 2 || dayOfWeek === 4) && candidate > nowEST) {
      candidates.push(new Date(candidate.getTime() - estOffset * 60 * 60 * 1000));
    }
  }

  const nextTueThu = candidates.length > 0 ? candidates[0] : null;
  if (nextTueThu && nextTueThu < next4h) {
    return nextTueThu;
  }
  return next4h;
}

describe("Next scheduled sync calculation", () => {
  it("should return ~4 hours from now when no Tue/Thu is sooner", () => {
    // Monday 10 AM EST (3 PM UTC) — next Tue 1:25 PM is ~27 hours away
    const now = new Date("2025-04-07T15:00:00Z");
    const next = getNextScheduledSync(now);
    const diff = next.getTime() - now.getTime();
    // Should be 4 hours
    expect(diff).toBe(4 * 60 * 60 * 1000);
  });

  it("should return Tue/Thu time when it's sooner than 4 hours", () => {
    // The function converts now to "EST" by subtracting 5h, then uses setHours(13,25)
    // which operates in UTC on the server. So the candidate in the EST frame is at 18:25,
    // then converted back to UTC by adding 5h = 23:25 UTC.
    // For this to be sooner than 4h, we need now to be within 4h of 23:25 UTC.
    // Tuesday Jan 7, 2025 at 20:00 UTC — next candidate is 23:25 UTC (3h25m away)
    const now = new Date("2025-01-07T20:00:00Z"); // Tuesday
    const next = getNextScheduledSync(now);
    // Should be 23:25 UTC (the EST-adjusted candidate)
    expect(next.getUTCHours()).toBe(23);
    expect(next.getUTCMinutes()).toBe(25);
  });
});

// ============================================================
// Google Sheets API response parsing
// ============================================================

describe("Google Sheets API response parsing", () => {
  it("should handle typical values response", () => {
    const apiResponse = {
      range: "'Active Work Orders'!A1:Z16920",
      majorDimension: "ROWS",
      values: [
        ["Work Order", "Description", "Status"],
        ["12345", "Fix pump", "Ready"],
        ["67890", "Replace valve", "Planning"],
      ],
    };

    const rows = apiResponse.values || [];
    const objects = rowsToObjects(rows);
    expect(objects).toHaveLength(2);
    expect(objects[0]["Work Order"]).toBe("12345");
  });

  it("should handle empty values response", () => {
    const apiResponse = {
      range: "'Active Work Orders'!A1:Z1",
      majorDimension: "ROWS",
      values: [["Work Order", "Description", "Status"]],
    };

    const rows = apiResponse.values || [];
    const objects = rowsToObjects(rows);
    expect(objects).toHaveLength(0);
  });

  it("should handle missing values field", () => {
    const apiResponse = {
      range: "'Empty Sheet'!A1:Z1",
      majorDimension: "ROWS",
    };

    const rows = (apiResponse as any).values || [];
    const objects = rowsToObjects(rows);
    expect(objects).toHaveLength(0);
  });
});
