/**
 * Work Week Leaders data structure
 * Maps week start dates to team leaders for each role
 * Updated from Work Execution and Planning Guide
 * 
 * Columns from source: Week, COM, LBE, SME Lead, cSME, mSME, eSME
 */

export interface WeekLeaders {
  COM: string;
  LBE: string;
  SME: string;
  cSME: string;
  mSME: string;
  eSME: string;
}

export const workWeekLeaders: Record<string, WeekLeaders> = {
  "2026-01-05": { COM: "Marlon", LBE: "Jeremy", SME: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Nadir" },
  "2026-01-12": { COM: "Shane", LBE: "Jeremiah", SME: "Torrel", cSME: "Corey", mSME: "George", eSME: "Mike" },
  "2026-01-19": { COM: "-", LBE: "Nathan", SME: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "-" },
  "2026-01-26": { COM: "Nathan", LBE: "Mark", SME: "-", cSME: "Josh", mSME: "Tom", eSME: "Charles" },
  "2026-02-02": { COM: "Marlon", LBE: "Jeremy", SME: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Mason" },
  "2026-02-09": { COM: "Shane", LBE: "Jeremiah", SME: "Torrel", cSME: "Corey", mSME: "George", eSME: "Nadir" },
  "2026-02-16": { COM: "-", LBE: "Nathan", SME: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Mike" },
  "2026-02-23": { COM: "Nathan", LBE: "Mark", SME: "-", cSME: "Josh", mSME: "Tom", eSME: "-" },
  "2026-03-02": { COM: "Marlon", LBE: "Jeremy", SME: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Charles" },
  "2026-03-09": { COM: "Shane", LBE: "Jeremiah", SME: "Torrel", cSME: "Corey", mSME: "George", eSME: "Mason" },
  "2026-03-16": { COM: "-", LBE: "Nathan", SME: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Nadir" },
  "2026-03-23": { COM: "Nathan", LBE: "Mark", SME: "Danny", cSME: "Josh", mSME: "Tom", eSME: "Mike" },
  "2026-03-30": { COM: "Marlon", LBE: "Jeremy", SME: "Torrel", cSME: "Tariq", mSME: "DJ", eSME: "Charles" },
  "2026-04-06": { COM: "Shane", LBE: "Jeremiah", SME: "Tim", cSME: "Corey", mSME: "George", eSME: "Mason" },
  "2026-04-13": { COM: "Nathan", LBE: "Nathan", SME: "Danny", cSME: "Kim", mSME: "Bryan", eSME: "Nadir" },
  "2026-04-20": { COM: "Marlon", LBE: "Mark", SME: "Torrel", cSME: "Josh", mSME: "Tom", eSME: "Mike" },
  "2026-04-27": { COM: "Shane", LBE: "Jeremy", SME: "Tim", cSME: "Tariq", mSME: "DJ", eSME: "Charles" },
  "2026-05-04": { COM: "Nathan", LBE: "Jeremiah", SME: "Danny", cSME: "Corey", mSME: "George", eSME: "Mason" },
  "2026-05-11": { COM: "Marlon", LBE: "Nathan", SME: "Torrel", cSME: "Kim", mSME: "Bryan", eSME: "Nadir" },
  "2026-05-18": { COM: "Shane", LBE: "Mark", SME: "Tim", cSME: "Josh", mSME: "Tom", eSME: "Mike" },
  "2026-05-25": { COM: "Nathan", LBE: "Jeremy", SME: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Charles" },
  "2026-06-01": { COM: "Marlon", LBE: "Jeremiah", SME: "Torrel", cSME: "Corey", mSME: "George", eSME: "Mason" },
  "2026-06-08": { COM: "Shane", LBE: "Nathan", SME: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Nadir" },
  "2026-06-15": { COM: "Nathan", LBE: "Mark", SME: "Danny", cSME: "Josh", mSME: "Tom", eSME: "Mike" },
};

/**
 * Get the Work Week Leaders for a given date
 * Returns the leaders for the week that contains the given date
 */
export function getWorkWeekLeaders(date: Date): WeekLeaders | null {
  // Get Monday of the week containing this date
  const dayOfWeek = date.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Sunday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  
  // Format as YYYY-MM-DD
  const key = monday.toISOString().split('T')[0];
  
  return workWeekLeaders[key] || null;
}
