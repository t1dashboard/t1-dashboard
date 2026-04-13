# Tab Diagnosis - Apr 13, 2026

## Compliance Check - FIXED
- Now shows 28 work orders with compliance window ending within 15 days
- Was empty because sync wasn't mapping Compliance Window End Date from Google Sheet
- Fixed by updating sheetsSync.ts column mapping

## Risk Identification - DATA ISSUE
- Empty because EHS LOR and Operational LOR columns are blank in ALL 16,365 rows in the Google Sheet
- The columns exist but Metamate hasn't populated them yet
- No code fix needed - will auto-populate once sheet has LOR data

## LOTO Review - SHOULD WORK
- 57 WOs match via PM code or LOTO/PTW in description for T1 week
- LOR columns will show blank (same data issue as Risk ID)
- Need to verify it's rendering

## WOs Awaiting Closure - FILTER LOGIC ISSUE
- 86 Work Complete WOs exist
- Filter requires Deferral Reason Selected = "NO" but:
  - Deferral Reason is intentionally NOT synced from Google Sheet (marked as inaccurate)
  - Even in the sheet, values are things like "Other", "No Problem" - never literally "No"
- Need to change filter: show ALL Work Complete WOs (remove deferral filter)

## WO Closure SLA - FILTER ISSUE
- Filters for Status = "CLOSED" but there are 0 Closed WOs
- Only 86 "Work Complete" and 4 "Date Completed" WOs
- Also hardcoded to March 2026 only
- Need to update: include Work Complete status, expand date range

## Production Impact - SHOULD WORK
- 11 WOs with impact 10-30 in T1-T3 range
- Data is now in DB after sync fix
- Need to verify it's rendering
