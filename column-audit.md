# Column Audit: Google Sheet vs Dashboard Requirements

## Currently in Google Sheet "Active Work Orders" tab (12 columns):
1. Work Order
2. Description
3. Data Center
4. Status
5. Type
6. Priority
7. Sched Start Date
8. Shift
9. Assigned To
10. Supervisor
11. Equipment Description
12. Organization

## All columns used by the dashboard frontend (22 unique field keys):
1. Work Order ✅
2. Description ✅
3. Data Center ✅
4. Status ✅
5. Type ✅
6. Priority ✅
7. Sched. Start Date ✅ (mapped from "Sched Start Date")
8. Shift ✅
9. Assigned To Name ✅ (mapped from "Assigned To")
10. Supervisor ✅
11. Equipment Description ✅
12. EHS LOR ❌ MISSING
13. Operational LOR ❌ MISSING
14. Production Impact ❌ MISSING
15. Compliance Window End Date ❌ MISSING
16. Sched. End Date ❌ MISSING
17. Date Created ❌ MISSING
18. Date Completed ❌ MISSING
19. Deferral Reason Selected ❌ MISSING
20. Route ❌ MISSING
21. PM Code ❌ MISSING
22. Assigned To (code) - not critical, "Assigned To" name is used

## Missing columns → Affected dashboard tabs:

| Missing Column | Affected Tabs |
|---|---|
| EHS LOR | Risk Identification, LOTO Review, Workload (risk coloring) |
| Operational LOR | Risk Identification, LOTO Review, Workload (risk coloring) |
| Production Impact | Production Impact (Inbox Review) |
| Compliance Window End Date | Compliance Check |
| Sched. End Date (Sched End Date) | WO Closure SLA, Compliance Check, Workload, Deconfliction, Inbox Review |
| Date Created | WOs Awaiting Closure (>90 days) |
| Date Completed | WO Closure SLA |
| Deferral Reason Selected | >30 Days with no deferral, WOs Awaiting Closure |
| Route | Deconfliction (equipment chain extraction) |
| PM Code | LOTO Review (PM code matching) |
