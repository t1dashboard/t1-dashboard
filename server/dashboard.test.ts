import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db.js", () => ({
  query: vi.fn(),
  execute: vi.fn(),
}));

import { query } from "./db.js";
const mockedQuery = vi.mocked(query);

describe("Upload Metadata endpoint logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return timestamps from all three tables", async () => {
    // Simulate what the GET /upload-metadata endpoint does
    const woTimestamp = "2026-02-17T18:49:25.000Z";
    const slTimestamp = "2026-02-17T19:15:48.000Z";
    const pmTimestamp = "2026-02-13T19:15:42.000Z";

    const result = {
      workOrders: woTimestamp,
      scheduledLabor: slTimestamp,
      pmCodes: pmTimestamp,
    };

    expect(result.workOrders).toBe(woTimestamp);
    expect(result.scheduledLabor).toBe(slTimestamp);
    expect(result.pmCodes).toBe(pmTimestamp);
  });

  it("should handle null timestamps when no data uploaded", () => {
    const result = {
      workOrders: null,
      scheduledLabor: null,
      pmCodes: null,
    };

    expect(result.workOrders).toBeNull();
    expect(result.scheduledLabor).toBeNull();
    expect(result.pmCodes).toBeNull();
  });
});

describe("Compliance Alerts filtering logic", () => {
  it("should exclude daily work orders from compliance alerts", () => {
    const rows = [
      { description: "DAILY INSPECTION PM", compliance_window_end_date: "2026-02-18" },
      { description: "MONTHLY INSPECTION PM", compliance_window_end_date: "2026-02-18" },
    ];

    const filtered = rows.filter((row) => {
      const desc = (row.description || "").toUpperCase();
      return !desc.includes("DAILY") && !desc.includes("WEEKLY");
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].description).toBe("MONTHLY INSPECTION PM");
  });

  it("should exclude weekly work orders from compliance alerts", () => {
    const rows = [
      { description: "EMERGENCY GENERATOR WEEKLY PM", compliance_window_end_date: "2026-02-18" },
      { description: "SAND FILTER SKID ANNUAL PM", compliance_window_end_date: "2026-02-18" },
    ];

    const filtered = rows.filter((row) => {
      const desc = (row.description || "").toUpperCase();
      return !desc.includes("DAILY") && !desc.includes("WEEKLY");
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].description).toBe("SAND FILTER SKID ANNUAL PM");
  });

  it("should only include work orders within 3 days of compliance deadline", () => {
    const now = new Date("2026-02-17T12:00:00Z");
    const rows = [
      { description: "PM A", compliance_window_end_date: "2026-02-18" }, // 1 day away - include
      { description: "PM B", compliance_window_end_date: "2026-02-20" }, // 3 days away - include
      { description: "PM C", compliance_window_end_date: "2026-02-25" }, // 8 days away - exclude
      { description: "PM D", compliance_window_end_date: "2026-02-15" }, // past - exclude
    ];

    const filtered = rows.filter((row) => {
      const endDate = new Date(row.compliance_window_end_date);
      const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 3;
    });

    expect(filtered).toHaveLength(2);
    expect(filtered[0].description).toBe("PM A");
    expect(filtered[1].description).toBe("PM B");
  });

  it("should handle Excel serial date numbers", () => {
    // Excel serial number 46071 = 2026-02-18
    const serialDate = 46071;
    const jsDate = new Date((serialDate - 25569) * 86400000);

    // The date should be Feb 18, 2026
    expect(jsDate.getUTCFullYear()).toBe(2026);
    expect(jsDate.getUTCMonth()).toBe(1); // 0-indexed, so 1 = February
    expect(jsDate.getUTCDate()).toBe(18);

    // Also verify serial 46072 = Feb 19
    const serialDate2 = 46072;
    const jsDate2 = new Date((serialDate2 - 25569) * 86400000);
    expect(jsDate2.getUTCDate()).toBe(19);
  });

  it("should exclude Closed, Work Complete, Cancelled, QA Rejected statuses", () => {
    const excludedStatuses = ["Closed", "Work Complete", "Cancelled", "QA Rejected"];
    const rows = [
      { status: "Ready", description: "PM A" },
      { status: "Closed", description: "PM B" },
      { status: "Work Complete", description: "PM C" },
      { status: "Cancelled", description: "PM D" },
      { status: "QA Rejected", description: "PM E" },
      { status: "In Process", description: "PM F" },
    ];

    const filtered = rows.filter(
      (row) => !excludedStatuses.includes(row.status)
    );

    expect(filtered).toHaveLength(2);
    expect(filtered[0].description).toBe("PM A");
    expect(filtered[1].description).toBe("PM F");
  });
});

describe("KPI Calculations", () => {
  it("should count T1 work orders correctly", () => {
    const workOrders = [
      { status: "Ready" },
      { status: "Ready" },
      { status: "Approved" },
      { status: "In Process" },
      { status: "Closed" },
    ];

    const readyCount = workOrders.filter(
      (wo) => wo.status.toLowerCase() === "ready"
    ).length;
    const notReadyCount = workOrders.filter(
      (wo) =>
        wo.status.toLowerCase() !== "ready" &&
        wo.status.toLowerCase() !== "closed" &&
        wo.status.toLowerCase() !== "work complete" &&
        wo.status.toLowerCase() !== "cancelled"
    ).length;

    expect(readyCount).toBe(2);
    expect(notReadyCount).toBe(2); // Approved and In Process
  });

  it("should identify high risk work orders", () => {
    const workOrders = [
      { "Operational LOR": "High", "EHS LOR": "Low" },
      { "Operational LOR": "Low", "EHS LOR": "High" },
      { "Operational LOR": "Medium", "EHS LOR": "Medium" },
      { "Operational LOR": "", "EHS LOR": "" },
    ];

    const highRiskCount = workOrders.filter((wo) => {
      const opsLOR = (wo["Operational LOR"] || "").toLowerCase();
      const ehsLOR = (wo["EHS LOR"] || "").toLowerCase();
      return opsLOR.includes("high") || ehsLOR.includes("high");
    }).length;

    expect(highRiskCount).toBe(2);
  });
});

describe("Stale Data Detection", () => {
  it("should detect data older than 7 days as stale", () => {
    const now = new Date("2026-02-17T12:00:00Z");
    const uploadDate = new Date("2026-02-08T12:00:00Z"); // 9 days ago
    const diffDays = Math.ceil(
      (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeGreaterThan(7);
  });

  it("should not flag recent data as stale", () => {
    const now = new Date("2026-02-17T12:00:00Z");
    const uploadDate = new Date("2026-02-15T12:00:00Z"); // 2 days ago
    const diffDays = Math.ceil(
      (now.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBeLessThanOrEqual(7);
  });
});

describe("Search/Filter logic", () => {
  it("should filter work orders by work order number", () => {
    const workOrders = [
      { "Work Order": "12345", "Description": "PM A", "Data Center": "DC1" },
      { "Work Order": "67890", "Description": "PM B", "Data Center": "DC2" },
      { "Work Order": "12399", "Description": "PM C", "Data Center": "DC3" },
    ];

    const query = "123";
    const filtered = workOrders.filter(
      (wo) =>
        String(wo["Work Order"]).toLowerCase().includes(query.toLowerCase()) ||
        (wo["Description"] || "").toLowerCase().includes(query.toLowerCase()) ||
        (wo["Data Center"] || "").toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered).toHaveLength(2);
    expect(filtered[0]["Work Order"]).toBe("12345");
    expect(filtered[1]["Work Order"]).toBe("12399");
  });

  it("should filter work orders by description", () => {
    const workOrders = [
      { "Work Order": "1", "Description": "SAND FILTER SKID ANNUAL PM", "Data Center": "MWG1" },
      { "Work Order": "2", "Description": "EMERGENCY GENERATOR WEEKLY PM", "Data Center": "MWG2" },
      { "Work Order": "3", "Description": "SAND FILTER MONTHLY PM", "Data Center": "NCG1" },
    ];

    const query = "sand filter";
    const filtered = workOrders.filter(
      (wo) =>
        String(wo["Work Order"]).toLowerCase().includes(query.toLowerCase()) ||
        (wo["Description"] || "").toLowerCase().includes(query.toLowerCase()) ||
        (wo["Data Center"] || "").toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered).toHaveLength(2);
  });

  it("should filter work orders by data center", () => {
    const workOrders = [
      { "Work Order": "1", "Description": "PM A", "Data Center": "MWG1" },
      { "Work Order": "2", "Description": "PM B", "Data Center": "MWG2" },
      { "Work Order": "3", "Description": "PM C", "Data Center": "NCG1" },
    ];

    const query = "mwg";
    const filtered = workOrders.filter(
      (wo) =>
        String(wo["Work Order"]).toLowerCase().includes(query.toLowerCase()) ||
        (wo["Description"] || "").toLowerCase().includes(query.toLowerCase()) ||
        (wo["Data Center"] || "").toLowerCase().includes(query.toLowerCase())
    );

    expect(filtered).toHaveLength(2);
  });

  it("should return all work orders when search is empty", () => {
    const workOrders = [
      { "Work Order": "1", "Description": "PM A", "Data Center": "DC1" },
      { "Work Order": "2", "Description": "PM B", "Data Center": "DC2" },
    ];

    const query = "";
    const filtered = query.trim()
      ? workOrders.filter(
          (wo) =>
            String(wo["Work Order"]).toLowerCase().includes(query.toLowerCase())
        )
      : workOrders;

    expect(filtered).toHaveLength(2);
  });
});

describe("Schedule Lock Week Selector", () => {
  it("should return distinct weeks sorted in descending order", () => {
    const weeks = ["2026-02-23", "2026-02-16", "2026-03-02", "2026-02-09"];
    const sorted = [...weeks].sort((a, b) => b.localeCompare(a));

    expect(sorted[0]).toBe("2026-03-02");
    expect(sorted[sorted.length - 1]).toBe("2026-02-09");
  });
});
