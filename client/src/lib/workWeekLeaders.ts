/**
 * Work Week Leaders data structure
 * Maps week start dates to team leaders for each role
 * Updated from Work Execution and Planning Guide
 */

export interface WeekLeaders {
  COM: string;
  LBE: string;
  SME: string;
  Lead: string;
  cSME: string;
  mSME: string;
  eSME: string;
}

export const workWeekLeaders: Record<string, WeekLeaders> = {
  "2026-01-05": { COM: "Marlon", LBE: "Jeremy", SME: "Danny", Lead: "Tariq", cSME: "DJ", mSME: "Nadir", eSME: "" },
  "2026-01-12": { COM: "Shane", LBE: "Jeremiah", SME: "Torrel", Lead: "Corey", cSME: "George", mSME: "Mike", eSME: "" },
  "2026-01-19": { COM: "Ben", LBE: "Nathan", SME: "Tim", Lead: "Kim", cSME: "Bryan", mSME: "Danna", eSME: "" },
  "2026-01-26": { COM: "Nathan", LBE: "Mark", SME: "Ben", Lead: "Josh", cSME: "Tom", mSME: "Charles", eSME: "" },
  "2026-02-02": { COM: "Marlon", LBE: "Jeremy", SME: "Danny", Lead: "Tariq", cSME: "DJ", mSME: "Mason", eSME: "" },
  "2026-02-09": { COM: "Shane", LBE: "Jeremiah", SME: "Torrel", Lead: "Corey", cSME: "George", mSME: "Nadir", eSME: "" },
  "2026-02-16": { COM: "Ben", LBE: "Nathan", SME: "Tim", Lead: "Kim", cSME: "Bryan", mSME: "Mike", eSME: "" },
  "2026-02-23": { COM: "Nathan", LBE: "Mark", SME: "Ben", Lead: "Josh", cSME: "Tom", mSME: "Danna", eSME: "" },
  "2026-03-02": { COM: "Marlon", LBE: "Jeremy", SME: "Danny", Lead: "Tariq", cSME: "DJ", mSME: "Charles", eSME: "" },
  "2026-03-09": { COM: "Shane", LBE: "Jeremiah", SME: "Torrel", Lead: "Corey", cSME: "George", mSME: "Mason", eSME: "" },
  "2026-03-16": { COM: "Ben", LBE: "Nathan", SME: "Tim", Lead: "Kim", cSME: "Bryan", mSME: "Nadir", eSME: "" },
  "2026-03-23": { COM: "Nathan", LBE: "Mark", SME: "Danny", Lead: "Josh", cSME: "Tom", mSME: "Mike", eSME: "" },
  "2026-03-30": { COM: "Marlon", LBE: "Jeremy", SME: "Torrel", Lead: "Tariq", cSME: "DJ", mSME: "Charles", eSME: "" },
  "2026-04-06": { COM: "Shane", LBE: "Jeremiah", SME: "Tim", Lead: "Corey", cSME: "George", mSME: "Mason", eSME: "" },
  "2026-04-13": { COM: "Ben", LBE: "Nathan", SME: "Danny", Lead: "Kim", cSME: "Bryan", mSME: "Nadir", eSME: "" },
  "2026-04-20": { COM: "Nathan", LBE: "Mark", SME: "Torrel", Lead: "Josh", cSME: "Tom", mSME: "Mike", eSME: "" },
  "2026-04-27": { COM: "Marlon", LBE: "Jeremy", SME: "Tim", Lead: "Tariq", cSME: "DJ", mSME: "Charles", eSME: "" },
  "2026-05-04": { COM: "Shane", LBE: "Jeremiah", SME: "Danny", Lead: "Corey", cSME: "George", mSME: "Mason", eSME: "" },
  "2026-05-11": { COM: "Ben", LBE: "Nathan", SME: "Torrel", Lead: "Kim", cSME: "Bryan", mSME: "Nadir", eSME: "" },
  "2026-05-18": { COM: "Nathan", LBE: "Mark", SME: "Tim", Lead: "Josh", cSME: "Tom", mSME: "Mike", eSME: "" },
  "2026-05-25": { COM: "Marlon", LBE: "Jeremy", SME: "Danny", Lead: "Tariq", cSME: "DJ", mSME: "Charles", eSME: "" },
  "2026-06-01": { COM: "Shane", LBE: "Jeremiah", SME: "Torrel", Lead: "Corey", cSME: "George", mSME: "Mason", eSME: "" },
  "2026-06-08": { COM: "Ben", LBE: "Nathan", SME: "Tim", Lead: "Kim", cSME: "Bryan", mSME: "Nadir", eSME: "" },
  "2026-06-15": { COM: "Nathan", LBE: "Mark", SME: "Danny", Lead: "Josh", cSME: "Tom", mSME: "Mike", eSME: "" },
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
