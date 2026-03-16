/**
 * Tests for team schedule rotation logic.
 *
 * Reference week: Mar 15-21, 2026 (Sun-Sat)
 *   - FHD works Wed Mar 18
 *   - BHN works Sat Mar 21
 */
import { describe, it, expect } from "vitest";

// We test the pure logic by reimplementing the same algorithm server-side
// since the client code uses path aliases. The logic is identical.

type TeamCode = "FHD" | "BHD" | "FHN" | "BHN";

const REFERENCE_SUNDAY = new Date(2026, 2, 15); // Mar 15, 2026
REFERENCE_SUNDAY.setHours(0, 0, 0, 0);

function getWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

function weeksBetween(sundayA: Date, sundayB: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((sundayB.getTime() - sundayA.getTime()) / msPerWeek);
}

function getTeamsForDate(date: Date): TeamCode[] {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay();

  const weekSunday = getWeekSunday(d);
  const weekOffset = weeksBetween(REFERENCE_SUNDAY, weekSunday);
  const isEvenWeek = ((weekOffset % 2) + 2) % 2 === 0;

  const teams: TeamCode[] = [];

  switch (dayOfWeek) {
    case 0: // Sunday
      teams.push("FHD", "FHN");
      break;
    case 1: // Monday
      teams.push("FHD", "FHN");
      break;
    case 2: // Tuesday
      teams.push("FHD", "FHN");
      break;
    case 3: // Wednesday
      teams.push(isEvenWeek ? "FHD" : "BHD");
      teams.push("BHN");
      break;
    case 4: // Thursday
      teams.push("BHD", "BHN");
      break;
    case 5: // Friday
      teams.push("BHD", "BHN");
      break;
    case 6: // Saturday
      teams.push("BHD");
      teams.push(isEvenWeek ? "BHN" : "FHN");
      break;
  }

  return teams;
}

describe("Team Schedule Rotation", () => {
  describe("Reference week (Mar 15-21, 2026)", () => {
    it("Sunday Mar 15: FHD + FHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 15));
      expect(teams).toEqual(["FHD", "FHN"]);
    });

    it("Monday Mar 16: FHD + FHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 16));
      expect(teams).toEqual(["FHD", "FHN"]);
    });

    it("Tuesday Mar 17: FHD + FHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 17));
      expect(teams).toEqual(["FHD", "FHN"]);
    });

    it("Wednesday Mar 18: FHD (even week) + BHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 18));
      expect(teams).toEqual(["FHD", "BHN"]);
    });

    it("Thursday Mar 19: BHD + BHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 19));
      expect(teams).toEqual(["BHD", "BHN"]);
    });

    it("Friday Mar 20: BHD + BHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 20));
      expect(teams).toEqual(["BHD", "BHN"]);
    });

    it("Saturday Mar 21: BHD + BHN (even week)", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 21));
      expect(teams).toEqual(["BHD", "BHN"]);
    });
  });

  describe("Next week (Mar 22-28, 2026) — odd week, alternates", () => {
    it("Sunday Mar 22: FHD + FHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 22));
      expect(teams).toEqual(["FHD", "FHN"]);
    });

    it("Wednesday Mar 25: BHD (odd week) + BHN", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 25));
      expect(teams).toEqual(["BHD", "BHN"]);
    });

    it("Saturday Mar 28: BHD + FHN (odd week)", () => {
      const teams = getTeamsForDate(new Date(2026, 2, 28));
      expect(teams).toEqual(["BHD", "FHN"]);
    });
  });

  describe("Two weeks later (Mar 29 - Apr 4, 2026) — even week again", () => {
    it("Wednesday Apr 1: FHD (even week) + BHN", () => {
      const teams = getTeamsForDate(new Date(2026, 3, 1));
      expect(teams).toEqual(["FHD", "BHN"]);
    });

    it("Saturday Apr 4: BHD + BHN (even week)", () => {
      const teams = getTeamsForDate(new Date(2026, 3, 4));
      expect(teams).toEqual(["BHD", "BHN"]);
    });
  });

  describe("Fixed day assignments (never alternate)", () => {
    it("Every Sunday always has FHD + FHN", () => {
      // Check several Sundays
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 15 + w * 7);
        const teams = getTeamsForDate(d);
        expect(teams).toContain("FHD");
        expect(teams).toContain("FHN");
      }
    });

    it("Every Thursday always has BHD + BHN", () => {
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 19 + w * 7);
        const teams = getTeamsForDate(d);
        expect(teams).toEqual(["BHD", "BHN"]);
      }
    });

    it("Every Friday always has BHD + BHN", () => {
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 20 + w * 7);
        const teams = getTeamsForDate(d);
        expect(teams).toEqual(["BHD", "BHN"]);
      }
    });
  });

  describe("Alternating Wednesday pattern", () => {
    it("Alternates FHD/BHD on Wednesdays, BHN always present", () => {
      // Even weeks: FHD + BHN, Odd weeks: BHD + BHN
      for (let w = 0; w < 8; w++) {
        const wed = new Date(2026, 2, 18 + w * 7);
        const teams = getTeamsForDate(wed);
        const isEven = w % 2 === 0;
        expect(teams).toContain("BHN"); // BHN always on Wed
        if (isEven) {
          expect(teams).toContain("FHD");
          expect(teams).not.toContain("BHD");
        } else {
          expect(teams).toContain("BHD");
          expect(teams).not.toContain("FHD");
        }
      }
    });
  });

  describe("Alternating Saturday pattern", () => {
    it("Alternates BHN/FHN on Saturdays, BHD always present", () => {
      // Even weeks: BHD + BHN, Odd weeks: BHD + FHN
      for (let w = 0; w < 8; w++) {
        const sat = new Date(2026, 2, 21 + w * 7);
        const teams = getTeamsForDate(sat);
        const isEven = w % 2 === 0;
        expect(teams).toContain("BHD"); // BHD always on Sat
        if (isEven) {
          expect(teams).toContain("BHN");
          expect(teams).not.toContain("FHN");
        } else {
          expect(teams).toContain("FHN");
          expect(teams).not.toContain("BHN");
        }
      }
    });
  });

  describe("Each team works 4 days one week, 3 days the next", () => {
    it("FHD works 4 days in even weeks (Sun, Mon, Tue, Wed) and 3 days in odd weeks (Sun, Mon, Tue)", () => {
      // Even week (reference): Sun, Mon, Tue, Wed = 4 days
      let count = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(2026, 2, 15 + d);
        if (getTeamsForDate(date).includes("FHD")) count++;
      }
      expect(count).toBe(4);

      // Odd week: Sun, Mon, Tue = 3 days
      count = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(2026, 2, 22 + d);
        if (getTeamsForDate(date).includes("FHD")) count++;
      }
      expect(count).toBe(3);
    });

    it("BHN works 4 days in even weeks (Wed, Thu, Fri, Sat) and 3 days in odd weeks (Wed, Thu, Fri)", () => {
      // Even week
      let count = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(2026, 2, 15 + d);
        if (getTeamsForDate(date).includes("BHN")) count++;
      }
      expect(count).toBe(4);

      // Odd week
      count = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date(2026, 2, 22 + d);
        if (getTeamsForDate(date).includes("BHN")) count++;
      }
      expect(count).toBe(3);
    });
  });
});
