/**
 * Night shift detection based on shift codes
 * Work orders with these shift codes will be categorized as Night Shift
 */
const NIGHT_SHIFT_CODES = ["GNSD", "GNSE", "GNSI", "GNSJ"];

export function isNightShift(shift: string): boolean {
  if (!shift) return false;
  const upperShift = shift.toUpperCase();
  return NIGHT_SHIFT_CODES.some(code => upperShift.includes(code));
}
