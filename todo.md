# Project TODO

## Current Issue
- [x] Fix LOTO Review column logic - scheduled labor work order numbers need to be converted to strings for proper matching
- [x] Fix scheduled labor parsing - need to read from "Work Order" column instead of first column

## Completed Features
- [x] Swiss Rationalism design implementation
- [x] Work order upload and display
- [x] T1-T3 Dashboard with filtering
- [x] T4-T8 Dashboard
- [x] Schedule Lock functionality
- [x] Schedule Lock Review
- [x] LOTO Review tab
- [x] localStorage persistence

## New Tasks
- [x] Exclude work orders containing "weekly" in description from T1 Workload tab
- [x] Exclude work orders containing "weekly" in description from Risk Identification tab
- [x] Add combined total count at the top of T1 Workload tab
- [x] Exclude work orders containing "weekly" from Schedule Lock tab
- [x] Exclude work orders containing "weekly" from Schedule Lock Review tab
- [x] Add Work Week Leaders display to T3 Not in Ready tab
- [x] Add Work Week Leaders display to T2 Not in Ready tab
- [x] Add Work Week Leaders display to T1 Not in Ready tab
- [x] Add previous week's Work Week Leaders to Schedule Lock Review tab
- [x] Move Previous Week Leaders to card header in Schedule Lock Review
- [x] Add In Process work orders section to T1 Workload tab (separate from day/night shift)
- [x] Move In Process section to bottom of T1 Workload (after Sunday)
- [x] Add calendar view to T1 Workload tab
- [x] Add toggle between list view and calendar view
- [x] Make sidebar collapsible with toggle button
- [x] Add PM codes upload functionality
- [x] Update LOTO Review to filter by PM codes with Yes in column G or H
- [x] Add Scheduled Labor Review navigation item in sidebar
- [x] Create ScheduledLaborReviewTab component
- [x] Show total count of Ready status work orders from scheduled labor
- [x] Show breakdown of all unique work orders with assigned to and status
- [x] Make Ready status appear in red in Scheduled Labor Review
- [x] Make Ready count number red in summary
- [x] Group work orders by assigned person in Scheduled Labor Review
- [x] Create ComplianceCheckTab component
- [x] Add compliance window end date filtering (within 30 days)
- [x] Add yellow highlighting for Sat/Sun/Mon compliance deadlines
- [x] Add days until compliance column with red highlight for ≤7 days
- [x] Add slack column (sched start to compliance end) with pink highlight for <10 days (excluding daily/weekly/monthly)
- [x] Add Compliance Check to T1-T3 Dashboard
- [x] Add Compliance Check to T4-T8 Dashboard
- [x] Fix date parsing in ComplianceCheckTab to handle Excel dates correctly
- [x] Debug why Compliance Check shows no work orders despite valid data - added robust date parsing
- [x] Fix Excel date parsing in work order upload handler to convert serial dates properly
- [x] Exclude Closed and Work Complete status from Compliance Check
- [x] Exclude work orders with "daily" in description from Compliance Check
- [x] Fix Excel serial number to Date conversion in ComplianceCheckTab
- [x] Add day of week column to Compliance Check tab
- [x] Sort Compliance Check by days until compliance (ascending)
- [x] Add Status column to Compliance Check tab
- [x] Exclude Cancelled status from Compliance Check
- [x] Make work order numbers clickable hyperlinks in Compliance Check
- [x] Exclude QA Rejected status from Compliance Check
- [x] Only show weekly work orders if compliance date is upcoming Sat/Sun/Mon
- [x] Change Compliance Check time window from 30 days to 15 days
