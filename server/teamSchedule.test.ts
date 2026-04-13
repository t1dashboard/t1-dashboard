/**
 * Tests for team schedule rotation logic.
 *
 * CORRECTED pairing (verified against April 2026 shift calendar):
 *   Sun-Tue: FHD (day) + BHN (night)
 *   Thu-Fri: BHD (day) + FHN (night)
 *   Wed: alternates — even weeks: FHD+BHN, odd weeks: BHD+FHN
 *   Sat: BHD always day; night alternates — even weeks: FHN, odd weeks: BHN
 *
 * Reference week: Mar 22-28, 2026 (Sun-Sat), even week (parity 0)
 *   - FHD has Wed Mar 25
 *   - FHN has Sat Mar 28
 *
 * Week of Apr 12-18 is ODD (user confirmed: FHD does NOT work Wed, FHN does NOT work Sat)
 */
import { describe, it, expect } from "vitest";

type TeamCode = "FHD" | "BHD" | "FHN" | "BHN";

const REFERENCE_SUNDAY = new Date(2026, 2, 22); // Mar 22, 2026
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
    case 0: // Sunday — FHD + BHN
    case 1: // Monday — FHD + BHN
    case 2: // Tuesday — FHD + BHN
      teams.push("FHD", "BHN");
      break;
    case 3: // Wednesday — alternating
      if (isEvenWeek) {
        teams.push("FHD", "BHN");
      } else {
        teams.push("BHD", "FHN");
      }
      break;
    case 4: // Thursday — BHD + FHN
    case 5: // Friday — BHD + FHN
      teams.push("BHD", "FHN");
      break;
    case 6: // Saturday — BHD + alternating night
      teams.push("BHD");
      teams.push(isEvenWeek ? "FHN" : "BHN");
      break;
  }

  return teams;
}

describe("Team Schedule Rotation (Corrected)", () => {
  describe("Reference week (Mar 22-28, 2026) — even week", () => {
    it("Sunday Mar 22: FHD + BHN", () => {
      expect(getTeamsForDate(new Date(2026, 2, 22))).toEqual(["FHD", "BHN"]);
    });
    it("Monday Mar 23: FHD + BHN", () => {
      expect(getTeamsForDate(new Date(2026, 2, 23))).toEqual(["FHD", "BHN"]);
    });
    it("Tuesday Mar 24: FHD + BHN", () => {
      expect(getTeamsForDate(new Date(2026, 2, 24))).toEqual(["FHD", "BHN"]);
    });
    it("Wednesday Mar 25: FHD + BHN (even week — FHD has Wed)", () => {
      expect(getTeamsForDate(new Date(2026, 2, 25))).toEqual(["FHD", "BHN"]);
    });
    it("Thursday Mar 26: BHD + FHN", () => {
      expect(getTeamsForDate(new Date(2026, 2, 26))).toEqual(["BHD", "FHN"]);
    });
    it("Friday Mar 27: BHD + FHN", () => {
      expect(getTeamsForDate(new Date(2026, 2, 27))).toEqual(["BHD", "FHN"]);
    });
    it("Saturday Mar 28: BHD + FHN (even week — FHN has Sat)", () => {
      expect(getTeamsForDate(new Date(2026, 2, 28))).toEqual(["BHD", "FHN"]);
    });
  });

  describe("Next week (Mar 29 - Apr 4, 2026) — odd week", () => {
    it("Sunday Mar 29: FHD + BHN", () => {
      expect(getTeamsForDate(new Date(2026, 2, 29))).toEqual(["FHD", "BHN"]);
    });
    it("Wednesday Apr 1: BHD + FHN (odd week — BHD has Wed)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 1))).toEqual(["BHD", "FHN"]);
    });
    it("Saturday Apr 4: BHD + BHN (odd week — BHN has Sat)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 4))).toEqual(["BHD", "BHN"]);
    });
  });

  describe("Week of Apr 5-11 — even week", () => {
    it("Wednesday Apr 8: FHD + BHN (even week)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 8))).toEqual(["FHD", "BHN"]);
    });
    it("Saturday Apr 11: BHD + FHN (even week)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 11))).toEqual(["BHD", "FHN"]);
    });
  });

  describe("Week of Apr 12-18 — ODD week (user confirmed)", () => {
    it("Sunday Apr 12: FHD + BHN", () => {
      expect(getTeamsForDate(new Date(2026, 3, 12))).toEqual(["FHD", "BHN"]);
    });
    it("Wednesday Apr 15: BHD + FHN (odd — FHD does NOT work this Wed)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 15))).toEqual(["BHD", "FHN"]);
    });
    it("Thursday Apr 16: BHD + FHN", () => {
      expect(getTeamsForDate(new Date(2026, 3, 16))).toEqual(["BHD", "FHN"]);
    });
    it("Saturday Apr 18: BHD + BHN (odd — FHN does NOT work this Sat)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 18))).toEqual(["BHD", "BHN"]);
    });
  });

  describe("Week of Apr 19-25 — even week", () => {
    it("Wednesday Apr 22: FHD + BHN (even week)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 22))).toEqual(["FHD", "BHN"]);
    });
    it("Saturday Apr 25: BHD + FHN (even week)", () => {
      expect(getTeamsForDate(new Date(2026, 3, 25))).toEqual(["BHD", "FHN"]);
    });
  });

  describe("Fixed day assignments (never alternate)", () => {
    it("Every Sunday always has FHD + BHN", () => {
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 22 + w * 7);
        expect(getTeamsForDate(d)).toEqual(["FHD", "BHN"]);
      }
    });
    it("Every Monday always has FHD + BHN", () => {
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 23 + w * 7);
        expect(getTeamsForDate(d)).toEqual(["FHD", "BHN"]);
      }
    });
    it("Every Tuesday always has FHD + BHN", () => {
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 24 + w * 7);
        expect(getTeamsForDate(d)).toEqual(["FHD", "BHN"]);
      }
    });
    it("Every Thursday always has BHD + FHN", () => {
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 26 + w * 7);
        expect(getTeamsForDate(d)).toEqual(["BHD", "FHN"]);
      }
    });
    it("Every Friday always has BHD + FHN", () => {
      for (let w = 0; w < 6; w++) {
        const d = new Date(2026, 2, 27 + w * 7);
        expect(getTeamsForDate(d)).toEqual(["BHD", "FHN"]);
      }
    });
  });

  describe("Alternating Wednesday pattern", () => {
    it("Even weeks: FHD+BHN, Odd weeks: BHD+FHN", () => {
      for (let w = 0; w < 8; w++) {
        const wed = new Date(2026, 2, 25 + w * 7); // Mar 25 is first Wed (even)
        const teams = getTeamsForDate(wed);
        const isEven = w % 2 === 0;
        if (isEven) {
          expect(teams).toEqual(["FHD", "BHN"]);
        } else {
          expect(teams).toEqual(["BHD", "FHN"]);
        }
      }
    });
  });

  describe("Alternating Saturday pattern", () => {
    it("BHD always works Sat day; even weeks: FHN night, odd weeks: BHN night", () => {
      for (let w = 0; w < 8; w++) {
        const sat = new Date(2026, 2, 28 + w * 7); // Mar 28 is first Sat (even)
        const teams = getTeamsForDate(sat);
        const isEven = w % 2 === 0;
        expect(teams).toContain("BHD");
        if (isEven) {
          expect(teams).toContain("FHN");
          expect(teams).not.toContain("BHN");
        } else {
          expect(teams).toContain("BHN");
          expect(teams).not.toContain("FHN");
        }
      }
    });
  });

  describe("Each team works correct number of days per week", () => {
    it("FHD: 4 days in even weeks (Sun-Wed), 3 days in odd weeks (Sun-Tue)", () => {
      // Even week (Mar 22-28)
      let count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 22 + d)).includes("FHD")) count++;
      }
      expect(count).toBe(4);

      // Odd week (Mar 29 - Apr 4)
      count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 29 + d)).includes("FHD")) count++;
      }
      expect(count).toBe(3);
    });

    it("BHD: 3 days in even weeks (Thu-Sat), 4 days in odd weeks (Wed-Sat)", () => {
      // Even week
      let count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 22 + d)).includes("BHD")) count++;
      }
      expect(count).toBe(3);

      // Odd week
      count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 29 + d)).includes("BHD")) count++;
      }
      expect(count).toBe(4);
    });

    it("BHN: 4 days in even weeks (Sun-Wed), 4 days in odd weeks (Sun-Tue+Sat)", () => {
      // Even week
      let count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 22 + d)).includes("BHN")) count++;
      }
      expect(count).toBe(4);

      // Odd week: Sun, Mon, Tue + Sat = 4
      count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 29 + d)).includes("BHN")) count++;
      }
      expect(count).toBe(4);
    });

    it("FHN: 3 days in even weeks (Thu-Sat), 3 days in odd weeks (Wed-Fri)", () => {
      // Even week
      let count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 22 + d)).includes("FHN")) count++;
      }
      expect(count).toBe(3);

      // Odd week: Wed, Thu, Fri = 3 (Sat goes to BHN)
      count = 0;
      for (let d = 0; d < 7; d++) {
        if (getTeamsForDate(new Date(2026, 2, 29 + d)).includes("FHN")) count++;
      }
      expect(count).toBe(3);
    });
  });
});
