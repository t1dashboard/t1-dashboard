/**
 * Excel stores dates as serial numbers (days since 1900-01-01)
 * This function converts Excel serial dates to JavaScript Date objects
 */
export function parseExcelDate(excelDate: any): Date | null {
  if (!excelDate) return null;
  
  // If it's already a valid date string, parse it
  if (typeof excelDate === 'string') {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  // If it's a number (Excel serial date)
  if (typeof excelDate === 'number') {
    // Excel serial date starts from 1900-01-01
    // JavaScript Date starts from 1970-01-01
    const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
    const jsDate = new Date(excelEpoch.getTime() + excelDate * 24 * 60 * 60 * 1000);
    return jsDate;
  }
  
  return null;
}

export function formatDate(date: any): string {
  const parsed = parseExcelDate(date);
  if (!parsed) return '';
  
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Get the start and end dates for next week (Monday to Sunday)
 */
export function getNextWeekRange(): { start: Date, end: Date } {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  const daysUntilNextMonday = currentDay === 0 ? 1 : (8 - currentDay);
  
  // Next Monday
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  // Next Sunday (6 days after Monday)
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);
  
  return { start: nextMonday, end: nextSunday };
}

/**
 * Check if a date falls within next week
 */
export function isNextWeek(date: any): boolean {
  const parsed = parseExcelDate(date);
  if (!parsed) return false;
  
  const { start, end } = getNextWeekRange();
  return parsed >= start && parsed <= end;
}

/**
 * Get the start and end dates for T2 week (2 weeks out, Monday to Sunday)
 */
export function getT2WeekRange(): { start: Date, end: Date } {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  const daysUntilNextMonday = currentDay === 0 ? 1 : (8 - currentDay);
  
  // Next Monday
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  // T2 Monday (1 week after next Monday)
  const t2Monday = new Date(nextMonday);
  t2Monday.setDate(nextMonday.getDate() + 7);
  
  // T2 Sunday (6 days after T2 Monday)
  const t2Sunday = new Date(t2Monday);
  t2Sunday.setDate(t2Monday.getDate() + 6);
  t2Sunday.setHours(23, 59, 59, 999);
  
  return { start: t2Monday, end: t2Sunday };
}

/**
 * Check if a date falls within T2 week
 */
export function isT2Week(date: any): boolean {
  const parsed = parseExcelDate(date);
  if (!parsed) return false;
  
  const { start, end } = getT2WeekRange();
  return parsed >= start && parsed <= end;
}

/**
 * Get the start and end dates for T3 week (3 weeks out, Monday to Sunday)
 */
export function getT3WeekRange(): { start: Date, end: Date } {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  const daysUntilNextMonday = currentDay === 0 ? 1 : (8 - currentDay);
  
  // Next Monday
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  // T3 Monday (2 weeks after next Monday)
  const t3Monday = new Date(nextMonday);
  t3Monday.setDate(nextMonday.getDate() + 14);
  
  // T3 Sunday (6 days after T3 Monday)
  const t3Sunday = new Date(t3Monday);
  t3Sunday.setDate(t3Monday.getDate() + 6);
  t3Sunday.setHours(23, 59, 59, 999);
  
  return { start: t3Monday, end: t3Sunday };
}

/**
 * Check if a date falls within T3 week
 */
export function isT3Week(date: any): boolean {
  const parsed = parseExcelDate(date);
  if (!parsed) return false;
  
  const { start, end } = getT3WeekRange();
  return parsed >= start && parsed <= end;
}

/**
 * Generic: Get the start and end dates for T(n) week.
 * T1 = next week, T2 = 2 weeks out, ... T8 = 8 weeks out.
 * Each week runs Monday to Sunday.
 */
export function getTWeekRange(n: number): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Days until next Monday
  const daysUntilNextMonday = currentDay === 0 ? 1 : (8 - currentDay);
  
  // Next Monday (T1 start)
  const t1Monday = new Date(today);
  t1Monday.setDate(today.getDate() + daysUntilNextMonday);
  t1Monday.setHours(0, 0, 0, 0);
  
  // T(n) Monday = T1 Monday + (n-1) weeks
  const tnMonday = new Date(t1Monday);
  tnMonday.setDate(t1Monday.getDate() + (n - 1) * 7);
  
  // T(n) Sunday = T(n) Monday + 6 days
  const tnSunday = new Date(tnMonday);
  tnSunday.setDate(tnMonday.getDate() + 6);
  tnSunday.setHours(23, 59, 59, 999);
  
  return { start: tnMonday, end: tnSunday };
}

/**
 * Generic: Check if a date falls within T(n) week.
 */
export function isTWeek(date: any, n: number): boolean {
  const parsed = parseExcelDate(date);
  if (!parsed) return false;
  
  const { start, end } = getTWeekRange(n);
  return parsed >= start && parsed <= end;
}
