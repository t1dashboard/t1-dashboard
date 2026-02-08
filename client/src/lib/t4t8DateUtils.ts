/**
 * Date utility functions for T4-T8 week calculations
 */

import { parseExcelDate } from "./dateUtils";

/**
 * Get the start and end dates for T4-T8 weeks (4-8 weeks out, Monday to Sunday)
 */
export function getT4T8WeekRange(): { start: Date, end: Date } {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  const daysUntilNextMonday = currentDay === 0 ? 1 : (8 - currentDay);
  
  // Next Monday
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilNextMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  // T4 Monday (3 weeks after next Monday)
  const t4Monday = new Date(nextMonday);
  t4Monday.setDate(nextMonday.getDate() + 21); // 3 weeks = 21 days
  
  // T8 Sunday (4 weeks and 6 days after T4 Monday = 34 days)
  const t8Sunday = new Date(t4Monday);
  t8Sunday.setDate(t4Monday.getDate() + 34);
  t8Sunday.setHours(23, 59, 59, 999);
  
  return { start: t4Monday, end: t8Sunday };
}

/**
 * Check if a date falls within T4-T8 weeks
 */
export function isT4T8Week(date: any): boolean {
  const parsed = parseExcelDate(date);
  if (!parsed) return false;
  
  const { start, end } = getT4T8WeekRange();
  return parsed >= start && parsed <= end;
}

/**
 * Check if a work order is older than specified days
 */
export function isOlderThanDays(dateCreated: any, days: number): boolean {
  const parsed = parseExcelDate(dateCreated);
  if (!parsed) return false;
  
  const today = new Date();
  const diffTime = today.getTime() - parsed.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  return diffDays > days;
}
