/**
 * List of night shift employees
 * Work orders assigned to these employees will be categorized as Night Shift
 */
export const NIGHT_SHIFT_EMPLOYEES = [
  "Dylan Arbogast",
  "Evan Holbrook",
  "Jason Kyzer",
  "Joe Misenheimer",
  "Lamont Ford-Dowling",
  "Michael Evjene",
  "Michael Wright",
  "Oliver Mangaoang",
  "Rashgmaal Bloodman",
  "Ryan Hicks",
  "Samuel Parris",
  "Timothy Strickland",
  "Tony Robertson"
];

export function isNightShift(assignedToName: string): boolean {
  return NIGHT_SHIFT_EMPLOYEES.includes(assignedToName);
}
