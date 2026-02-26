# Consolidated User Requests & Statements

This document compiles every question, request, and statement made by the user throughout the development of the T1 Dashboard project, organized chronologically by topic area.

---

## 1. Initial Setup & Core Features

1. Build a Work Planning Dashboard with Swiss Rationalism design
2. Upload work order spreadsheets (Excel) to populate dashboards
3. Create T1-T3 Dashboard with near-term planning views
4. Create T4-T8 Dashboard with extended planning views
5. Add Schedule Lock functionality
6. Add Schedule Lock Review
7. Add LOTO Review tab
8. Use localStorage for data persistence

---

## 2. Data Filtering & Exclusions

9. Exclude work orders containing "weekly" in description from T1 Workload tab
10. Exclude work orders containing "weekly" in description from Risk Identification tab
11. Exclude work orders containing "weekly" from Schedule Lock tab
12. Exclude work orders containing "weekly" from Schedule Lock Review tab
13. Exclude Closed and Work Complete status from Compliance Check
14. Exclude work orders with "daily" in description from Compliance Check
15. Exclude Cancelled status from Compliance Check
16. Exclude QA Rejected status from Compliance Check
17. Only show weekly work orders if compliance date is upcoming Sat/Sun/Mon
18. Treat NICV PM work orders as monthly (only show if due on upcoming Sat/Sun/Mon)
19. Change Compliance Check time window from 30 days to 15 days
20. Exclude Work Complete and Closed status work orders from WO Campaign
21. Unplanned Schedule Review: Only include Work Complete or Closed status work orders
22. Unplanned Schedule Review: Exclude work orders with description containing '000'
23. Unplanned Schedule Review: Include work orders with door or wall repairs in description
24. Schedule Lock Review: Exclude WOs with shift code GNSF, GNSG, GNSH, GNSI, GNSJ unless description contains LOTO or PTW
25. Schedule Lock Review: Exclude 'In Process' status from Incomplete Locked Orders section
26. Exclude work orders with status "Cancelled" from >90 Days Deferral tabs
27. Only show work orders where sched start date is actually >90 days in the past
28. Scheduled Labor Review: Only include work orders with Ready status

---

## 3. Display & Layout Changes

29. Add combined total count at the top of T1 Workload tab
30. Add Work Week Leaders display to T3 Not in Ready tab
31. Add Work Week Leaders display to T2 Not in Ready tab
32. Add Work Week Leaders display to T1 Not in Ready tab
33. Add previous week's Work Week Leaders to Schedule Lock Review tab
34. Move Previous Week Leaders to card header in Schedule Lock Review
35. Add In Process work orders section to T1 Workload tab (separate from day/night shift)
36. Move In Process section to bottom of T1 Workload (after Sunday)
37. Make sidebar collapsible with toggle button
38. Sort WOs >30 Days by Sched Start Date (oldest first) within each building section
39. T1 Workload: Section off Days (7AM-6:59PM) and Nights
40. T1 Workload: Color-code by risk level (green=low, yellow=medium, red=high)
41. T1 Workload: Redesign calendar as one large full-width view with horizontal Day/Night divider, no scrolling
42. Make calendar view the default view (instead of list view)
43. Rename "T1 Workload" tab to "Workload"
44. Make week headers (Work Week Leaders) larger across the entire dashboard
45. WOs Awaiting Closure: Remove Supervisor column
46. WOs Awaiting Closure: Organize by data center sections
47. Replace 'Assigned To Name' column with 'Shift' code column across all sections of the dashboard
48. Remove Assigned To Name from every section of the dashboard (replaced with Shift)
49. Fix table column alignment across data center sections — use consistent fixed column widths
50. Fix table column alignment in ALL dashboard tabs
51. Change Days >90 column to show total days since sched start date instead of days beyond 90-day threshold

---

## 4. Calendar & Workload Views

52. Add calendar view to T1 Workload tab
53. Add toggle between list view and calendar view
54. Add T1/T2/T3 dropdown selector to Workload tab (T1 default)
55. Move T1/T2/T3 week dropdown from tab bar to below List/Calendar toggle in Workload Summary card
56. Expand week dropdown from T1-T3 to T1-T8 with correct date ranges for each week
57. Add T0 (this week) option to the Workload week dropdown
58. Add In Process work orders section to bottom of calendar view in Workload tab
59. Add daily view option to calendar in Workload tab (in addition to weekly view)

---

## 5. Compliance Check

60. Create ComplianceCheckTab component
61. Add compliance window end date filtering (within 30 days)
62. Add yellow highlighting for Sat/Sun/Mon compliance deadlines
63. Add days until compliance column with red highlight for ≤7 days
64. Add slack column (sched start to compliance end) with pink highlight for <10 days (excluding daily/weekly/monthly)
65. Add Compliance Check to T1-T3 Dashboard
66. Add Compliance Check to T4-T8 Dashboard
67. Fix date parsing in ComplianceCheckTab to handle Excel dates correctly
68. Fix Excel serial number to Date conversion in ComplianceCheckTab
69. Add day of week column to Compliance Check tab
70. Sort Compliance Check by days until compliance (ascending)
71. Add Status column to Compliance Check tab
72. Make work order numbers clickable hyperlinks in Compliance Check
73. Add compliance notification for non-daily/non-weekly WOs within 3 days of compliance

---

## 6. Schedule Lock & Review

74. Add export button to Schedule Lock page to download locked work orders
75. Update export filename to use next week's date range (T1 week)
76. Add week selector to Export Locked button on Schedule Lock page
77. Restrict Schedule Lock and Schedule Lock Review sidebar buttons to owner only (hidden behind PIN)
78. Fix: Restore Schedule Lock/Review sidebar buttons for everyone; only hide lock/unlock action buttons behind PIN
79. Unplanned Schedule Review: Separate LOTO/PTW work orders into their own section at the top
80. Unplanned Schedule Review: Organize remaining work orders by building
81. Fix Unplanned Schedule Review: locked WOs should be excluded from unplanned list even if sched start date falls outside the lock week
82. Fix lock week offset: lock_week is when lock was created, WOs are planned for the following week. Use lock_week from 2 weeks ago for previous week review.

---

## 7. Inbox Review

83. Add Inbox Review sidebar menu item
84. Create WO Campaign sub-tab (filter by description containing "WO Campaign")
85. Move Scheduled Labor Review from sidebar into Inbox Review as sub-tab
86. Create WOs Awaiting Closure sub-tab (Work Complete status + Deferral Reason = No)
87. Change WOs Awaiting Closure to show Supervisor Name instead of Assigned To Name
88. WO Campaign: Group by similar description, sort by sched start date oldest first within each group
89. Revert WO Campaign to flat table (no grouping by description), sort by sched start date oldest first

---

## 8. >90 Days Deferral Dashboard

90. Create database table for >90 Days Deferral upload data
91. Add API endpoints for deferral data upload and query
92. Add deferral upload area on the upload screen (6 separate category uploads)
93. Create >90 Days Deferral page with 6 categories (Pending Procedure, Vendor Action Required, Awaiting Invoice, Waiting Conditions, Pending Parts, OOS Lock)
94. Red count badges per category, organized by data center
95. Filter to only show Planning, Ready to Schedule, Approved status WOs
96. Display WO number, description, data center, days >90 since sched start date
97. Add sidebar navigation entry for >90 Days Deferral
98. Add Assigned To Name column to >90 Days Deferral table display
99. Add Missing Deferral category (WOs with YES deferral not in any of the 6 deferral files)
100. Add Missing Deferral counter at the top of the Deferral Dashboard
101. Add total per data center summary row at the bottom of each category tab
102. Move >90 Days Deferral from sidebar into T4-T8 Dashboard (replace existing >90 Days tab)
103. Remove >90 Days Deferral sidebar entry
104. Allow work orders to appear in multiple deferral categories
105. Add 'Work Complete' status to allowed statuses in >90 Days Deferral tabs
106. Add Sched Start Date column to >90 Days Deferral category tables
107. Fix Missing Deferral logic — WOs showing as missing but they actually have deferral categories
108. Fix Missing Deferral logic — only show WOs with actual deferral code, not "YES" without a category

---

## 9. Backend & Infrastructure

109. Move work order data from localStorage to server-side database
110. Create database tables for work orders, scheduled labor, PM codes, and schedule locks
111. Create REST API endpoints for uploading and retrieving data
112. Update frontend to use API calls instead of localStorage
113. Ensure all visitors see the same uploaded data
114. Add PIN lock to upload page to restrict data uploads
115. Add PM codes upload functionality
116. Update LOTO Review to filter by PM codes with Yes in column G or H
117. Update all work order links to use EAM production URL (eamprod.thefacebook.com)
118. Upgrade project to web-db-user template with tRPC + Manus Auth support

---

## 10. Bug Fixes

119. Fix LOTO Review column logic — scheduled labor work order numbers need to be converted to strings for proper matching
120. Fix scheduled labor parsing — need to read from "Work Order" column instead of first column
121. Fix: Work orders not uploading when spreadsheet is uploaded
122. Fix: File too large error when uploading work order spreadsheet
123. Fix: Handle very large work order Excel files
124. Fix: T1 Workload calendar overflowing outside the white background
125. Fix API server routing — ensure Express API starts correctly with Vite dev server
126. Fix Excel date parsing in work order upload handler to convert serial dates properly

---

## 11. Misc / UI Polish

127. Add dashboard summary KPI cards (total T1 WOs, Ready vs Not Ready, high risk, compliance alerts)
128. Add search/filter bar across all tabs
129. Add mobile-responsive layout with collapsible sidebar
130. Add "Last uploaded" timestamp on every tab with stale data warning (>7 days)
131. Make Ready status appear in red in Scheduled Labor Review
132. Make Ready count number red in summary
133. Group work orders by assigned person in Scheduled Labor Review
134. Add comprehensive test suite for dashboard enhancements
135. Add test script to package.json

---

## 12. Latest Request

136. Consolidate all questions and statements made throughout the conversation
137. Fix "Cannot GET /" error on preview
