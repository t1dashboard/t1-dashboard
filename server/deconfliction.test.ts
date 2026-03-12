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
