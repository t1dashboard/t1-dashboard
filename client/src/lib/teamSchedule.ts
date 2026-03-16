/**
 * Team schedule rotation logic.
 *
 * Four teams rotate on a fixed pattern:
 *   FHD (Front Half Days):  Sun, Mon, Tue + every other Wed
 *   BHD (Back Half Days):   Thu, Fri, Sat + every other Wed
 *   FHN (Front Half Nights): Sun, Mon, Tue + every other Sat
 *   BHN (Back Half Nights):  Wed, Thu, Fri + every other Sat
 *
 * The alternating Wed/Sat is determined by a reference week.
 * Reference: The week of Mar 16, 2026 (Sun Mar 15 – Sat Mar 21):
 *   - FHD works Wednesday (Mar 18)
 *   - BHN works Saturday (Mar 21)
 *
 * This means in that reference week:
 *   - Wed belongs to FHD (not BHD)
 *   - Sat belongs to BHN (not FHN)
 *
 * The pattern alternates every week after that.
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
    color: "bg-amber-200",
    textColor: "text-amber-900",
  },
  BHD: {
    code: "BHD",
    label: "Back Half Days",
    color: "bg-orange-200",
    textColor: "text-orange-900",
  },
  FHN: {
    code: "FHN",
    label: "Front Half Nights",
    color: "bg-indigo-200",
    textColor: "text-indigo-900",
  },
  BHN: {
    code: "BHN",
    label: "Back Half Nights",
    color: "bg-purple-200",
    textColor: "text-purple-900",
  },
};

/**
 * Reference Sunday for week-parity calculation.
 * The week starting Sun Mar 15, 2026:
 *   - FHD has Wed (so this is an "FHD-Wed week", week parity 0)
 *   - BHN has Sat (so this is a "BHN-Sat week", week parity 0)
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
 */
export function getTeamsForDate(date: Date): TeamCode[] {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  const weekSunday = getWeekSunday(d);
  const weekOffset = weeksBetween(REFERENCE_SUNDAY, weekSunday);
  // weekOffset 0 = reference week, 1 = next week, etc.
  // Even weeks (0, 2, 4...) = FHD has Wed, BHN has Sat
  // Odd weeks (1, 3, 5...) = BHD has Wed, FHN has Sat
  const isEvenWeek = ((weekOffset % 2) + 2) % 2 === 0; // handle negative modulo

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
      // Alternating: even weeks = FHD, odd weeks = BHD
      teams.push(isEvenWeek ? "FHD" : "BHD");
      // BHN always works Wednesday
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
      // Alternating: even weeks = BHN, odd weeks = FHN
      teams.push(isEvenWeek ? "BHN" : "FHN");
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
