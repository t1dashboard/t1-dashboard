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
