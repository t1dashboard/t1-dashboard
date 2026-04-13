/**
 * Team schedule rotation logic.
 *
 * Four teams rotate on a fixed pattern:
 *   FHD (Front Half Days):   Sun, Mon, Tue + every other Wed
 *   BHD (Back Half Days):    Thu, Fri, Sat + every other Wed
 *   BHN (Back Half Nights):  Sun, Mon, Tue + every other Wed (opposite night crew)
 *   FHN (Front Half Nights): Thu, Fri, Sat + every other Wed (opposite night crew)
 *
 * Key: Day and Night crews on the SAME half-week are DIFFERENT halves:
 *   - Front half of week (Sun-Tue): FHD (days) + BHN (nights)
 *   - Back half of week (Thu-Sat):  BHD (days) + FHN (nights)
 *   - Wednesday: alternates between FHD/BHN and BHD/FHN
 *   - Saturday: BHD always works day; night alternates between FHN and BHN
 *
 * The alternating Wed/Sat is determined by a reference week.
 * Reference: The week of Apr 5, 2026 (Sun Apr 5 – Sat Apr 11):
 *   - Wed Apr 8 belongs to FHD (day) + BHD (... actually need to verify)
 *
 * From the April 2026 calendar:
 *   Week of Apr 5:  Sun-Tue = FHD+BHN, Wed Apr 8 = FHD+BHD (transition), Thu-Fri = BHD+FHN, Sat = BHD+FHN
 *   Week of Apr 12: Sun-Tue = FHD+BHN, Wed Apr 15 = FHD+BHN (FHD keeps Wed), Thu-Fri = BHD+FHN, Sat = BHD+FHN
 *   Week of Apr 19: Sun-Tue = FHD+BHN, Wed Apr 22 = BHD+FHN (BHD gets Wed), Thu-Fri = BHD+FHN, Sat = BHD+FHN
 *
 * Reference: The week starting Sun Mar 15, 2026:
 *   - FHD has Wed (so this is an "FHD-Wed week", week parity 0)
 */

export type TeamCode = "FHD" | "BHD" | "FHN" | "BHN";

export interface TeamInfo {
  code: TeamCode;
  label: string;
  color: string; // Tailwind bg class
  textColor: string; // Tailwind text class
}

export const TEAMS: Record<TeamCode, TeamInfo> = {
  FHD: {
    code: "FHD",
    label: "Front Half Days",
    color: "bg-blue-200",
    textColor: "text-blue-900",
  },
  BHD: {
    code: "BHD",
    label: "Back Half Days",
    color: "bg-green-200",
    textColor: "text-green-900",
  },
  FHN: {
    code: "FHN",
    label: "Front Half Nights",
    color: "bg-yellow-200",
    textColor: "text-yellow-900",
  },
  BHN: {
    code: "BHN",
    label: "Back Half Nights",
    color: "bg-orange-200",
    textColor: "text-orange-900",
  },
};

/**
 * Reference Sunday for week-parity calculation.
 * The week starting Sun Mar 15, 2026:
 *   - FHD has Wed (so this is an "FHD-Wed week", week parity 0)
 *   - FHN has Sat (so this is a "FHN-Sat week", week parity 0)
 */
const REFERENCE_SUNDAY = new Date(2026, 2, 15); // Mar 15, 2026 (Sunday)
REFERENCE_SUNDAY.setHours(0, 0, 0, 0);

/**
 * Get the Sunday that starts the week containing the given date.
 * Week starts on Sunday.
 */
function getWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

/**
 * Calculate the number of weeks between two Sundays.
 */
function weeksBetween(sundayA: Date, sundayB: Date): number {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.round((sundayB.getTime() - sundayA.getTime()) / msPerWeek);
}

/**
 * Get the teams working on a given date.
 * Returns an array of TeamCodes (day teams first, then night teams).
 *
 * Day-of-week mapping (JS getDay()):
 *   0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday,
 *   4 = Thursday, 5 = Friday, 6 = Saturday
 *
 * CORRECTED pairing:
 *   Sun-Tue: FHD (day) + BHN (night)
 *   Thu-Fri: BHD (day) + FHN (night)
 *   Wed: alternates — even weeks: FHD+BHN, odd weeks: BHD+FHN
 *   Sat: BHD (day) always; night alternates — even weeks: FHN, odd weeks: BHN
 */
export function getTeamsForDate(date: Date): TeamCode[] {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  const weekSunday = getWeekSunday(d);
  const weekOffset = weeksBetween(REFERENCE_SUNDAY, weekSunday);
  // weekOffset 0 = reference week, 1 = next week, etc.
  // Even weeks (0, 2, 4...) = FHD has Wed, FHN has Sat
  // Odd weeks (1, 3, 5...) = BHD has Wed, BHN has Sat
  const isEvenWeek = ((weekOffset % 2) + 2) % 2 === 0; // handle negative modulo

  const teams: TeamCode[] = [];

  switch (dayOfWeek) {
    case 0: // Sunday — FHD (day) + BHN (night)
      teams.push("FHD", "BHN");
      break;
    case 1: // Monday — FHD (day) + BHN (night)
      teams.push("FHD", "BHN");
      break;
    case 2: // Tuesday — FHD (day) + BHN (night)
      teams.push("FHD", "BHN");
      break;
    case 3: // Wednesday — alternating
      // Even weeks: FHD (day) + BHN (night) — front half keeps Wed
      // Odd weeks: BHD (day) + FHN (night) — back half gets Wed
      if (isEvenWeek) {
        teams.push("FHD", "BHN");
      } else {
        teams.push("BHD", "FHN");
      }
      break;
    case 4: // Thursday — BHD (day) + FHN (night)
      teams.push("BHD", "FHN");
      break;
    case 5: // Friday — BHD (day) + FHN (night)
      teams.push("BHD", "FHN");
      break;
    case 6: // Saturday — BHD (day) always; night alternates
      teams.push("BHD");
      // Even weeks: FHN has Sat, Odd weeks: BHN has Sat
      teams.push(isEvenWeek ? "FHN" : "BHN");
      break;
  }

  return teams;
}

/**
 * Get the day and night teams separately for a given date.
 */
export function getTeamsByShift(date: Date): { day: TeamCode[]; night: TeamCode[] } {
  const teams = getTeamsForDate(date);
  const dayTeams: TeamCode[] = [];
  const nightTeams: TeamCode[] = [];

  for (const team of teams) {
    if (team === "FHD" || team === "BHD") {
      dayTeams.push(team);
    } else {
      nightTeams.push(team);
    }
  }

  return { day: dayTeams, night: nightTeams };
}
