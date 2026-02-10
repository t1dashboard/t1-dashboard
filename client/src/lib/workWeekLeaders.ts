/**
 * Work Week Leaders data structure
 * Maps week start dates to team leaders for each role
 */

export interface WeekLeaders {
  COM: string;
  LBE: string;
  SMELead: string;
  cSME: string;
  mSME: string;
  eSME: string;
}

export const workWeekLeaders: Record<string, WeekLeaders> = {
  "2026-01-05": { COM: "Marlon", LBE: "Jeremy", SMELead: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Nadir" },
  "2026-01-12": { COM: "Shane", LBE: "Jeremiah", SMELead: "Torrel", cSME: "Corey", mSME: "George", eSME: "Mike" },
  "2026-01-19": { COM: "Tony", LBE: "Nathan", SMELead: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Dana" },
  "2026-01-26": { COM: "Nathan", LBE: "Mark", SMELead: "Ben", cSME: "Josh", mSME: "Tom", eSME: "Charles" },
  "2026-02-02": { COM: "Marlon", LBE: "Jeremy", SMELead: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Mason" },
  "2026-02-09": { COM: "Shane", LBE: "Jeremiah", SMELead: "Torrel", cSME: "Corey", mSME: "George", eSME: "Nadir" },
  "2026-02-16": { COM: "Tony", LBE: "Nathan", SMELead: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Mike" },
  "2026-02-23": { COM: "Nathan", LBE: "Mark", SMELead: "Ben", cSME: "Josh", mSME: "Tom", eSME: "Dana" },
  "2026-03-02": { COM: "Marlon", LBE: "Jeremy", SMELead: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Charles" },
  "2026-03-09": { COM: "Shane", LBE: "Jeremiah", SMELead: "Torrel", cSME: "Corey", mSME: "George", eSME: "Mason" },
  "2026-03-16": { COM: "Tony", LBE: "Nathan", SMELead: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Nadir" },
  "2026-03-23": { COM: "Nathan", LBE: "Mark", SMELead: "Ben", cSME: "Josh", mSME: "Tom", eSME: "Mike" },
  "2026-03-30": { COM: "Marlon", LBE: "Jeremy", SMELead: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Dana" },
  "2026-04-06": { COM: "Shane", LBE: "Jeremiah", SMELead: "Torrel", cSME: "Corey", mSME: "George", eSME: "Charles" },
  "2026-04-13": { COM: "Tony", LBE: "Nathan", SMELead: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Mason" },
  "2026-04-20": { COM: "Nathan", LBE: "Mark", SMELead: "Ben", cSME: "Josh", mSME: "Tom", eSME: "Nadir" },
  "2026-04-27": { COM: "Marlon", LBE: "Jeremy", SMELead: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Mike" },
  "2026-05-04": { COM: "Shane", LBE: "Jeremiah", SMELead: "Torrel", cSME: "Corey", mSME: "George", eSME: "Dana" },
  "2026-05-11": { COM: "Tony", LBE: "Nathan", SMELead: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Charles" },
  "2026-05-18": { COM: "Nathan", LBE: "Mark", SMELead: "Ben", cSME: "Josh", mSME: "Tom", eSME: "Mason" },
  "2026-05-25": { COM: "Marlon", LBE: "Jeremy", SMELead: "Danny", cSME: "Tariq", mSME: "DJ", eSME: "Nadir" },
  "2026-06-01": { COM: "Shane", LBE: "Jeremiah", SMELead: "Torrel", cSME: "Corey", mSME: "George", eSME: "Mike" },
  "2026-06-08": { COM: "Tony", LBE: "Nathan", SMELead: "Tim", cSME: "Kim", mSME: "Bryan", eSME: "Dana" },
  "2026-06-15": { COM: "Nathan", LBE: "Mark", SMELead: "Ben", cSME: "Josh", mSME: "Tom", eSME: "Charles" },
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
