import { describe, it, expect } from "vitest";

/**
 * Tests for the transformer deconfliction logic.
 * These test the pure functions used in DeconflictionTab.
 */

// Transformer-to-building mapping (mirrors the component)
const TRANSFORMER_MAP: Record<string, Record<string, [string, string]>> = {
  NCG: {
    A: ["NCG1", "NCG6"],
    B: ["NCG1", "NCG2"],
    C: ["NCG2", "NCG3"],
    D: ["NCG5", "NCG6"],
    E: ["NCG5", "NCG6"],
  },
  MWG: {
    A: ["MWG1", "MWG3"],
    B: ["MWG1", "MWG2"],
    C: ["MWG2", "MWG3"],
  },
};

function extractTransformerLetter(text: string): string | null {
  if (!text) return null;
  const match = text.match(/\bT-([A-E])\b/i);
  return match ? match[1].toUpperCase() : null;
}

function getCampusPrefix(dataCenter: string): string | null {
  const match = dataCenter.match(/^([A-Z]+)\d/i);
  return match ? match[1].toUpperCase() : null;
}

function getTransformerBuildings(campus: string, letter: string): [string, string] | null {
  const campusMap = TRANSFORMER_MAP[campus];
  if (!campusMap) return null;
  return campusMap[letter] || null;
}

describe("Transformer Letter Extraction", () => {
  it("should extract T-A from description", () => {
    expect(extractTransformerLetter("PM T-A Transformer Maintenance")).toBe("A");
  });

  it("should extract T-B from description", () => {
    expect(extractTransformerLetter("Inspect T-B oil levels")).toBe("B");
  });

  it("should extract T-C from description", () => {
    expect(extractTransformerLetter("T-C annual testing")).toBe("C");
  });

  it("should extract T-D from description", () => {
    expect(extractTransformerLetter("Replace T-D bushing")).toBe("D");
  });

  it("should extract T-E from description", () => {
    expect(extractTransformerLetter("T-E relay calibration")).toBe("E");
  });

  it("should be case insensitive", () => {
    expect(extractTransformerLetter("pm t-a maintenance")).toBe("A");
  });

  it("should return null for no transformer reference", () => {
    expect(extractTransformerLetter("Regular maintenance work")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(extractTransformerLetter("")).toBeNull();
  });

  it("should not match T-F or beyond", () => {
    expect(extractTransformerLetter("T-F something")).toBeNull();
  });
});

describe("Campus Prefix Extraction", () => {
  it("should extract NCG from NCG1", () => {
    expect(getCampusPrefix("NCG1")).toBe("NCG");
  });

  it("should extract NCG from NCG6", () => {
    expect(getCampusPrefix("NCG6")).toBe("NCG");
  });

  it("should extract MWG from MWG1", () => {
    expect(getCampusPrefix("MWG1")).toBe("MWG");
  });

  it("should extract MWG from MWG3", () => {
    expect(getCampusPrefix("MWG3")).toBe("MWG");
  });

  it("should handle lowercase input", () => {
    expect(getCampusPrefix("ncg2")).toBe("NCG");
  });

  it("should return null for unknown format", () => {
    expect(getCampusPrefix("Unknown")).toBeNull();
  });
});

describe("Transformer Building Mapping", () => {
  // NCG mappings
  it("NCG T-A should map to NCG1 and NCG6", () => {
    expect(getTransformerBuildings("NCG", "A")).toEqual(["NCG1", "NCG6"]);
  });

  it("NCG T-B should map to NCG1 and NCG2", () => {
    expect(getTransformerBuildings("NCG", "B")).toEqual(["NCG1", "NCG2"]);
  });

  it("NCG T-C should map to NCG2 and NCG3", () => {
    expect(getTransformerBuildings("NCG", "C")).toEqual(["NCG2", "NCG3"]);
  });

  it("NCG T-D should map to NCG5 and NCG6", () => {
    expect(getTransformerBuildings("NCG", "D")).toEqual(["NCG5", "NCG6"]);
  });

  it("NCG T-E should map to NCG5 and NCG6", () => {
    expect(getTransformerBuildings("NCG", "E")).toEqual(["NCG5", "NCG6"]);
  });

  // MWG mappings
  it("MWG T-A should map to MWG1 and MWG3", () => {
    expect(getTransformerBuildings("MWG", "A")).toEqual(["MWG1", "MWG3"]);
  });

  it("MWG T-B should map to MWG1 and MWG2", () => {
    expect(getTransformerBuildings("MWG", "B")).toEqual(["MWG1", "MWG2"]);
  });

  it("MWG T-C should map to MWG2 and MWG3", () => {
    expect(getTransformerBuildings("MWG", "C")).toEqual(["MWG2", "MWG3"]);
  });

  // Invalid mappings
  it("should return null for unknown campus", () => {
    expect(getTransformerBuildings("XYZ", "A")).toBeNull();
  });

  it("should return null for MWG T-D (not defined)", () => {
    expect(getTransformerBuildings("MWG", "D")).toBeNull();
  });
});

describe("Campus Matching - NCG with NCG, MWG with MWG", () => {
  it("NCG transformer should only match NCG equipment WOs", () => {
    const xformerCampus = getCampusPrefix("NCG1");
    const equipCampusNCG = getCampusPrefix("NCG6");
    const equipCampusMWG = getCampusPrefix("MWG1");

    expect(xformerCampus).toBe("NCG");
    expect(equipCampusNCG).toBe("NCG");
    expect(equipCampusMWG).toBe("MWG");

    // NCG transformer should match NCG equipment
    expect(xformerCampus === equipCampusNCG).toBe(true);
    // NCG transformer should NOT match MWG equipment
    expect(xformerCampus === equipCampusMWG).toBe(false);
  });

  it("MWG transformer should only match MWG equipment WOs", () => {
    const xformerCampus = getCampusPrefix("MWG2");
    const equipCampusMWG = getCampusPrefix("MWG3");
    const equipCampusNCG = getCampusPrefix("NCG1");

    expect(xformerCampus).toBe("MWG");
    expect(equipCampusMWG).toBe("MWG");
    expect(equipCampusNCG).toBe("NCG");

    // MWG transformer should match MWG equipment
    expect(xformerCampus === equipCampusMWG).toBe(true);
    // MWG transformer should NOT match NCG equipment
    expect(xformerCampus === equipCampusNCG).toBe(false);
  });
});

// Route column parsing (mirrors the component)
const EQUIPMENT_PATTERNS = ["MSB", "EG", "UPS", "PTX"];

function extractEquipmentFromRoute(route: string): Array<{ type: string; chain: string; fullId: string; building: string }> {
  if (!route) return [];
  const results: Array<{ type: string; chain: string; fullId: string; building: string }> = [];
  const routeRegex = /(?:GNS|[A-Z]+)-([A-Z]+\d+)\s+([A-Z]+)-([A-Za-z0-9]+)/gi;
  let match;
  while ((match = routeRegex.exec(route)) !== null) {
    const building = match[1].toUpperCase();
    const eqType = match[2].toUpperCase();
    const chainId = match[3].toUpperCase();
    if (EQUIPMENT_PATTERNS.includes(eqType)) {
      results.push({ type: eqType, chain: chainId, fullId: `${eqType}-${chainId}`, building });
    }
  }
  return results;
}

function extractTransformerFromRoute(route: string): string | null {
  if (!route) return null;
  const match = route.match(/\bT-([A-E])\b/i);
  return match ? match[1].toUpperCase() : null;
}

describe("Route Column Equipment Extraction", () => {
  it("should extract EG-01 from GNS-NCG1 EG-01", () => {
    const result = extractEquipmentFromRoute("GNS-NCG1 EG-01");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "EG", chain: "01", fullId: "EG-01", building: "NCG1" });
  });

  it("should extract MSB-N1 from GNS-NCG1 MSB-N1 6A (ignore PM frequency suffix)", () => {
    const result = extractEquipmentFromRoute("GNS-NCG1 MSB-N1 6A");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "MSB", chain: "N1", fullId: "MSB-N1", building: "NCG1" });
  });

  it("should extract UPS-1R from GNS-MWG2 UPS-1R", () => {
    const result = extractEquipmentFromRoute("GNS-MWG2 UPS-1R");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "UPS", chain: "1R", fullId: "UPS-1R", building: "MWG2" });
  });

  it("should extract PTX-N3 from GNS-NCG3 PTX-N3 2A", () => {
    const result = extractEquipmentFromRoute("GNS-NCG3 PTX-N3 2A");
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: "PTX", chain: "N3", fullId: "PTX-N3", building: "NCG3" });
  });

  it("should return empty for non-equipment route", () => {
    const result = extractEquipmentFromRoute("GNS-NCG1 HVAC-01");
    expect(result).toHaveLength(0);
  });

  it("should return empty for empty string", () => {
    const result = extractEquipmentFromRoute("");
    expect(result).toHaveLength(0);
  });

  it("should return empty for null/undefined", () => {
    const result = extractEquipmentFromRoute(null as any);
    expect(result).toHaveLength(0);
  });
});

describe("Route Column Transformer Extraction", () => {
  it("should extract T-A from route", () => {
    expect(extractTransformerFromRoute("GNS-NCG1 T-A")).toBe("A");
  });

  it("should extract T-B from route", () => {
    expect(extractTransformerFromRoute("GNS-MWG1 T-B")).toBe("B");
  });

  it("should return null for non-transformer route", () => {
    expect(extractTransformerFromRoute("GNS-NCG1 EG-01")).toBeNull();
  });

  it("should return null for empty string", () => {
    expect(extractTransformerFromRoute("")).toBeNull();
  });
});

describe("Route-Based Conflict Detection", () => {
  it("GNS-NCG1 MSB-N1 6A should conflict with GNS-NCG1 EG-N1 (same building, same chain N1)", () => {
    const route1 = extractEquipmentFromRoute("GNS-NCG1 MSB-N1 6A");
    const route2 = extractEquipmentFromRoute("GNS-NCG1 EG-N1");

    expect(route1).toHaveLength(1);
    expect(route2).toHaveLength(1);

    // Same building
    expect(route1[0].building).toBe("NCG1");
    expect(route2[0].building).toBe("NCG1");

    // Same chain
    expect(route1[0].chain).toBe("N1");
    expect(route2[0].chain).toBe("N1");

    // Different equipment types
    expect(route1[0].type).toBe("MSB");
    expect(route2[0].type).toBe("EG");
  });

  it("GNS-NCG1 EG-01 should NOT conflict with GNS-NCG1 EG-N1 (different chains)", () => {
    const route1 = extractEquipmentFromRoute("GNS-NCG1 EG-01");
    const route2 = extractEquipmentFromRoute("GNS-NCG1 EG-N1");

    expect(route1[0].chain).toBe("01");
    expect(route2[0].chain).toBe("N1");
    expect(route1[0].chain).not.toBe(route2[0].chain);
  });

  it("GNS-NCG1 MSB-N1 should NOT conflict with GNS-NCG2 EG-N1 (different buildings, different DC)", () => {
    const route1 = extractEquipmentFromRoute("GNS-NCG1 MSB-N1");
    const route2 = extractEquipmentFromRoute("GNS-NCG2 EG-N1");

    expect(route1[0].building).toBe("NCG1");
    expect(route2[0].building).toBe("NCG2");
    expect(route1[0].building).not.toBe(route2[0].building);
  });
});

describe("Transformer Conflict Scenario", () => {
  it("T-A in NCG1 with 1EG-01 in NCG6 should be flagged (NCG T-A powers NCG1 and NCG6)", () => {
    const xformerDC = "NCG1";
    const xformerDesc = "PM T-A Transformer Maintenance";
    const equipDC = "NCG6";
    const equipDesc = "1EG-01 Annual Testing";

    const letter = extractTransformerLetter(xformerDesc);
    expect(letter).toBe("A");

    const campus = getCampusPrefix(xformerDC);
    expect(campus).toBe("NCG");

    const pairedBuildings = getTransformerBuildings(campus!, letter!);
    expect(pairedBuildings).toEqual(["NCG1", "NCG6"]);

    // Equipment DC should be in paired buildings
    expect(pairedBuildings!.includes(equipDC)).toBe(true);

    // Campus should match
    const equipCampus = getCampusPrefix(equipDC);
    expect(equipCampus).toBe(campus);
  });

  it("T-B in NCG1 with 1MSB-01 in NCG2 should be flagged (NCG T-B powers NCG1 and NCG2)", () => {
    const xformerDC = "NCG1";
    const letter = extractTransformerLetter("T-B inspection");
    const campus = getCampusPrefix(xformerDC);
    const pairedBuildings = getTransformerBuildings(campus!, letter!);

    expect(pairedBuildings).toEqual(["NCG1", "NCG2"]);
    expect(pairedBuildings!.includes("NCG2")).toBe(true);
  });

  it("T-A in MWG1 should NOT flag equipment in NCG6 (different campus)", () => {
    const xformerDC = "MWG1";
    const xformerCampus = getCampusPrefix(xformerDC);
    const equipDC = "NCG6";
    const equipCampus = getCampusPrefix(equipDC);

    expect(xformerCampus).toBe("MWG");
    expect(equipCampus).toBe("NCG");
    expect(xformerCampus === equipCampus).toBe(false);
  });

  it("T-C in MWG2 with 1UPS-01 in MWG3 should be flagged (MWG T-C powers MWG2 and MWG3)", () => {
    const xformerDC = "MWG2";
    const letter = extractTransformerLetter("T-C relay test");
    const campus = getCampusPrefix(xformerDC);
    const pairedBuildings = getTransformerBuildings(campus!, letter!);

    expect(pairedBuildings).toEqual(["MWG2", "MWG3"]);
    expect(pairedBuildings!.includes("MWG3")).toBe(true);

    const equipCampus = getCampusPrefix("MWG3");
    expect(equipCampus).toBe(campus);
  });
});
