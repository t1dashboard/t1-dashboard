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
