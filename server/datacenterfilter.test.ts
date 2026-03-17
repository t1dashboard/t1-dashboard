import { describe, it, expect } from "vitest";

/**
 * Tests for the data center filter logic used in Not in Ready / Not in Approved tabs.
 * These test the pure filtering logic, not the React component itself.
 */

interface MockWorkOrder {
  "Work Order": number;
  "Data Center": string;
  "Status": string;
  "Description": string;
}

function filterByDataCenter(
  workOrders: MockWorkOrder[],
  selectedDCs: Set<string>
): MockWorkOrder[] {
  if (selectedDCs.size === 0) return workOrders;
  return workOrders.filter((wo) => selectedDCs.has(wo["Data Center"]));
}

function getUniqueDataCenters(workOrders: MockWorkOrder[]): string[] {
  const dcs = new Set<string>();
  workOrders.forEach((wo) => {
    if (wo["Data Center"]) dcs.add(wo["Data Center"]);
  });
  return Array.from(dcs).sort();
}

const sampleOrders: MockWorkOrder[] = [
  { "Work Order": 1001, "Data Center": "NCG1", "Status": "Planning", "Description": "Test WO 1" },
  { "Work Order": 1002, "Data Center": "NCG2", "Status": "Planning", "Description": "Test WO 2" },
  { "Work Order": 1003, "Data Center": "NCG1", "Status": "Planning", "Description": "Test WO 3" },
  { "Work Order": 1004, "Data Center": "MWG1", "Status": "Planning", "Description": "Test WO 4" },
  { "Work Order": 1005, "Data Center": "MWG2", "Status": "Planning", "Description": "Test WO 5" },
  { "Work Order": 1006, "Data Center": "NCG1", "Status": "Planning", "Description": "Test WO 6" },
];

describe("Data Center Filter Logic", () => {
  it("should return all work orders when no DCs are selected (All mode)", () => {
    const result = filterByDataCenter(sampleOrders, new Set());
    expect(result).toHaveLength(6);
  });

  it("should filter to a single data center", () => {
    const result = filterByDataCenter(sampleOrders, new Set(["NCG1"]));
    expect(result).toHaveLength(3);
    result.forEach((wo) => expect(wo["Data Center"]).toBe("NCG1"));
  });

  it("should filter to multiple data centers", () => {
    const result = filterByDataCenter(sampleOrders, new Set(["NCG1", "MWG1"]));
    expect(result).toHaveLength(4);
    result.forEach((wo) => expect(["NCG1", "MWG1"]).toContain(wo["Data Center"]));
  });

  it("should return empty when filtering by non-existent DC", () => {
    const result = filterByDataCenter(sampleOrders, new Set(["XYZ1"]));
    expect(result).toHaveLength(0);
  });

  it("should handle empty work orders list", () => {
    const result = filterByDataCenter([], new Set(["NCG1"]));
    expect(result).toHaveLength(0);
  });
});

describe("Unique Data Centers Extraction", () => {
  it("should extract unique data centers sorted alphabetically", () => {
    const dcs = getUniqueDataCenters(sampleOrders);
    expect(dcs).toEqual(["MWG1", "MWG2", "NCG1", "NCG2"]);
  });

  it("should return empty array for empty work orders", () => {
    const dcs = getUniqueDataCenters([]);
    expect(dcs).toEqual([]);
  });

  it("should handle single data center", () => {
    const dcs = getUniqueDataCenters([
      { "Work Order": 1, "Data Center": "NCG1", "Status": "Planning", "Description": "Test" },
    ]);
    expect(dcs).toEqual(["NCG1"]);
  });
});
