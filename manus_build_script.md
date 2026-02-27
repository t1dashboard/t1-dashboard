# Work Planning Dashboard — Manus Build Script

> **Instructions:** Paste this entire document into a new Manus conversation. Manus will build the complete Work Planning Dashboard from scratch. You will need to upload your Excel spreadsheets after the dashboard is built.

---

## 1. Project Overview

Build a **Work Planning Dashboard** for data center maintenance teams. The dashboard allows users to upload Excel spreadsheets of work orders, scheduled labor, PM codes, and deferral data, then visualizes and organizes that data across multiple planning views. The application uses a **Swiss Rationalism** design style — clean, minimal, with muted teal accents and warm grays, sharp 2px border radius, Inter font for body text, and JetBrains Mono for monospace elements.

**Tech Stack:**
- Frontend: React 19 + Tailwind CSS 4 + shadcn/ui components
- Backend: Express 4 with REST API endpoints (not tRPC for the custom routes)
- Database: MySQL/TiDB (use the built-in DATABASE_URL)
- File parsing: xlsx library (server-side) for Excel upload processing
- File uploads: multer with 50MB limit
- State: Server-side database (shared across all users), no localStorage

---

## 2. Data Model

### 2.1 Work Order Spreadsheet Columns

The main work order Excel file has these columns (use exact names as field keys):

| Column Name | Type | Description |
|---|---|---|
| Work Order | number | Unique work order number |
| Status | string | e.g., Ready, Approved, Planning, In Process, Work Complete, Closed, Cancelled, QA Rejected |
| Type | string | Work order type |
| Priority | string | Priority level |
| Data Center | string | Building/data center name |
| Description | string | Work order description |
| Route | string | Route information |
| Sched. Start Date | date/string | Scheduled start date (may be Excel serial number) |
| Sched. End Date | date/string | Scheduled end date |
| Shift | string | Shift code (e.g., GNSA, GNSB, GNSC, GNSD, GNSE, GNSF, GNSG, GNSH, GNSI, GNSJ) |
| Assigned To Name | string | Person assigned (exists in data but NOT displayed in the UI — replaced by Shift everywhere) |
| Operational LOR | string | Operational Level of Risk (low/medium/high) |
| EHS LOR | string | EHS Level of Risk (low/medium/high) |
| Production Impact | number | Values like 10, 15, 20, 25, 30, 40 |
| Compliance Window Start Date | date/string | Compliance start |
| Compliance Window End Date | date/string | Compliance end |
| Discipline | string | Trade discipline |
| Equipment Description | string | Equipment info |
| Organization | string | Organization |
| Department | string | Department |
| Equipment | string | Equipment ID |
| Class | string | Work order class |
| Reported By | number | Reporter ID |
| PM Code | string | Preventive maintenance code |
| Assigned To | string | Assigned to code |
| Date Created | string | Creation date |
| Deferral Reason Selected | string | Deferral reason (e.g., "Yes", "No", or specific reason) |
| Trade | string | Trade (optional) |
| Supervisor | string | Supervisor name (optional) |

### 2.2 Scheduled Labor Spreadsheet

Single-column spreadsheet with a "Work Order" column containing work order numbers.

### 2.3 PM Codes Spreadsheet

| Column | Description |
|---|---|
| PM Codes | PM code identifier |
| Description | PM description |
| Status | Status |
| Date Approved | Approval date |
| Perform Every | Frequency number |
| Period UOM | Unit of measure (days, weeks, months) |
| LOTO Required | "Yes" or "No" (column G) |
| PTW Required | "Yes" or "No" (column H) |

### 2.4 Deferral Work Orders (>90 Days)

Six separate spreadsheet uploads, one per deferral category:
- Pending Procedure
- Vendor Action Required
- Awaiting Invoice
- Waiting Conditions
- Pending Parts
- OOS Lock

Each has the same columns as the main work order spreadsheet. A work order can appear in multiple categories.

---

## 3. Database Tables

Create these MySQL tables:

**work_orders** — All columns from section 2.1, plus `id` (auto-increment), `uploaded_at` (timestamp, default NOW()), `uploaded_by` (int).

**scheduled_labor** — `id`, `work_order_number` (varchar), `uploaded_at`, `uploaded_by`.

**pm_codes** — `id`, `pm_code`, `description`, `status`, `date_approved`, `perform_every`, `period_uom`, `loto_required`, `ptw_required`.

**schedule_locks** — `id`, `work_order_number`, `description`, `data_center`, `sched_start_date`, `assigned_to_name`, `status`, `type`, `equipment_description`, `priority`, `shift`, `lock_week` (varchar, format "YYYY-MM-DD"), `locked_at` (timestamp), `locked_by` (int).

**deferral_work_orders** — `id`, `work_order_number`, `description`, `data_center`, `sched_start_date`, `sched_end_date`, `assigned_to_name`, `supervisor`, `status`, `type`, `deferral_category` (varchar), `priority`, `equipment_description`, `trade`, `uploaded_at`, `uploaded_by`.

---

## 4. Application Layout

### 4.1 Sidebar Navigation (Custom, not DashboardLayout)

Collapsible sidebar with these navigation items:
1. **Work Planning Dashboard** (header/title) — click to go to Upload page
2. **T1-T3 Dashboard** — "Near-term planning"
3. **T4-T8 Dashboard** — "Extended planning"
4. **Schedule Lock** — "Lock T1 schedule"
5. **Schedule Lock Review** — "Review locked schedule"
6. **Inbox Review** — "Review inbox items"

Mobile-responsive: hamburger menu on small screens, overlay sidebar.

### 4.2 Upload Page (PIN-Protected)

The upload page requires a 4-digit PIN (stored in `VITE_UPLOAD_PIN` env variable, default "1171") before showing upload areas. Display a PIN entry form with a lock icon. Once unlocked, show:

- **Work Order Information** — drag/drop or click to upload Excel (.xlsx, .xls)
- **Scheduled Labor** — upload for LOTO Review tracking
- **PM Codes** — upload PM code reference data
- **>90 Days Deferral Categories** — 6 separate upload areas, one for each category (Pending Procedure, Vendor Action Required, Awaiting Invoice, Waiting Conditions, Pending Parts, OOS Lock)

Each upload area shows a count of loaded records after successful upload. Use toast notifications for success/error.

---

## 5. Week Calculation System

All week-based filtering uses a T-week system where weeks run Monday to Sunday:
- **T0** = This week (current Monday through Sunday)
- **T1** = Next week
- **T2** = 2 weeks out
- **T3** = 3 weeks out
- ... up to **T8** = 8 weeks out

Create a `dateUtils.ts` utility with:
- `parseExcelDate(value)` — handles both Excel serial numbers and date strings
- `formatDate(value)` — formats to MM/DD/YYYY
- `getTWeekRange(n)` — returns `{start, end}` for T(n) week
- `isTWeek(date, n)` — checks if a date falls within T(n) week

### Night Shift Detection

Shift codes GNSD, GNSE, GNSI, GNSJ are night shift. All others are day shift.

---

## 6. T1-T3 Dashboard

### 6.1 Header

- Title: "T1-T3 Dashboard"
- Week ranges displayed below (T0 through T8 with date ranges)
- **Last uploaded timestamp** with stale data warning (red badge if >7 days old)
- **Search bar** — filters all work orders by WO number, description, data center, shift, status, or equipment description

### 6.2 KPI Summary Cards (5 cards in a row)

| Card | Color | Metric |
|---|---|---|
| T1 Work Orders | Blue left border | Total T1 WOs |
| Ready | Green left border | T1 WOs with "Ready" status |
| Not Ready | Amber left border | T1 WOs not Ready/Closed/Work Complete/Cancelled |
| High Risk | Red left border | T1 WOs with high Operational or EHS LOR |
| Compliance Alerts | Purple left border | WOs within 3 days of compliance deadline |

### 6.3 Compliance Alert Banner

Red banner at top when there are WOs within 3 days of compliance deadline (non-daily/non-weekly). Shows up to 5 WO descriptions, dismissible.

### 6.4 Tabs (7 tabs)

#### Tab 1: T3 Not in Ready
- Filter: T3 week WOs where status is NOT "Ready", "Closed", "Work Complete", or "Cancelled"
- Exclude: WOs with "weekly" in description
- Group by data center (alphabetical), show count per DC
- **Work Week Leaders** display at top of each data center section — show text in standard small size with semibold weight
- Columns: Work Order (clickable link), Description, Shift, Sched Start Date, Status
- All work order links use: `https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum={WO_NUMBER}`

#### Tab 2: T2 Not in Ready
- Same as T3 Not in Ready but for T2 week
- Same Work Week Leaders display

#### Tab 3: T1 Not in Ready
- Same as T3 Not in Ready but for T1 week
- Same Work Week Leaders display

#### Tab 4: Workload
- **View toggles**: List view / Calendar view (calendar is default)
- **Week selector**: Dropdown T0-T8 with date ranges
- **Calendar view**: Full-width weekly calendar with Day/Night shift sections
  - Days: 7AM-6:59PM shift codes
  - Nights: GNSD, GNSE, GNSI, GNSJ shift codes
  - Color-coded by risk: green (low), yellow (medium), red (high) based on Operational/EHS LOR
  - In Process work orders shown in separate section at bottom
  - **Weekly/Daily toggle**: Switch between weekly calendar and daily view
  - **Daily view**: Previous/next navigation arrows, clickable day selector pills showing WO counts per day, expanded card layout grouped by shift (Day/Night) then by data center
- **List view**: Table with Work Order, Description, Data Center, Shift, Sched Start Date, Status
- Exclude WOs with "weekly" in description
- Show total combined count at top

#### Tab 5: Risk Identification
- Filter: T1 week WOs with Operational LOR or EHS LOR containing "high" or "medium"
- Exclude: WOs with "weekly" in description
- Group by data center
- Columns: Work Order, Description, Shift, Sched Start Date, Ops LOR, EHS LOR, Status

#### Tab 6: LOTO Review
- Filter: T1 week WOs where the PM Code matches a PM code in the PM Codes table that has "Yes" in LOTO Required or PTW Required
- Show a "LOTO Review" column: "Yes" if the WO number is in the scheduled labor list, "No" otherwise
- Columns: Work Order, Description, Shift, Sched Start Date, PM Code, LOTO Review, Status

#### Tab 7: Compliance Check
- Filter: WOs with Compliance Window End Date within 15 days from now
- Exclude: Closed, Work Complete, Cancelled, QA Rejected statuses
- Exclude: WOs with "daily" in description
- For "weekly" WOs: only show if compliance date falls on upcoming Sat/Sun/Mon
- For WOs with "NICV" PM code: treat as monthly (only show if due on upcoming Sat/Sun/Mon)
- Sort by days until compliance (ascending)
- Columns: Work Order, Description, Data Center, Shift, Compliance End Date, Day of Week, Days Until Compliance (red if ≤7), Slack (sched start to compliance end, pink if <10 days excluding daily/weekly/monthly), Status
- Yellow highlighting for Sat/Sun/Mon compliance deadlines

---

## 7. T4-T8 Dashboard

### Tabs (5 tabs)

#### Tab 1: T1 Not in Ready
- Same component as T1-T3 Dashboard's T1 Not in Ready tab

#### Tab 2: T4-T8 Not in Approved
- Filter: WOs with sched start date in T4-T8 range where status is NOT "Approved", "Ready", "Closed", "Work Complete", or "Cancelled"
- Group by data center
- Columns: Work Order, Description, Shift, Sched Start Date, Status

#### Tab 3: WOs >30 Days
- Filter: Corrective WOs (Type = "CM" or similar) where sched start date is >30 days in the past
- Exclude: Closed, Work Complete, Cancelled
- Sort by sched start date (oldest first) within each data center section
- Group by data center
- Columns: Work Order, Description, Shift, Sched Start Date, Status, Days Old

#### Tab 4: >90 Days with Deferral
- This is the **Deferral Dashboard** with 6 category tabs plus a "Missing Deferral" tab
- **6 Category tabs**: Pending Procedure, Vendor Action Required, Awaiting Invoice, Waiting Conditions, Pending Parts, OOS Lock
  - Data comes from the separate deferral uploads (not the main work order file)
  - Filter: Only show Planning, Ready to Schedule, Approved, Work Complete statuses
  - Exclude: Cancelled status
  - Only show WOs where sched start date is actually >90 days in the past
  - Group by data center, sort alphabetically
  - Show red count badges per category
  - Columns: Work Order, Description, Data Center, Shift, Sched Start Date, Status, Days Since Sched Start
  - Total per data center summary at bottom of each category
- **Missing Deferral tab**: WOs from the main work order file that have an actual deferral code (not just "Yes" or "No") but don't appear in any of the 6 deferral category uploads
  - Show counter at top of Deferral Dashboard

#### Tab 5: Compliance Check
- Same component as T1-T3 Dashboard's Compliance Check tab

---

## 8. Schedule Lock

- Displays all T1 work orders in a table with checkboxes
- Users can select WOs and click "Lock Schedule" to save them to the database
- Lock/unlock buttons are hidden behind PIN protection (same VITE_UPLOAD_PIN)
- **Export button** with week selector to download locked WOs as Excel file
  - Export filename uses the T1 week date range
- Columns: Checkbox, Work Order, Description, Data Center, Shift, Sched Start Date, Status, Type, Equipment Description, Priority
- Exclude WOs with "weekly" in description

---

## 9. Schedule Lock Review

### 9.1 Work Week Leaders
Display previous week's Work Week Leaders at the top in standard small text with semibold weight.

### 9.2 Unplanned Schedule Review
- Shows WOs that appeared in the previous week's actual work but were NOT in the locked schedule
- **Logic**: Compare current work orders (with sched start dates in the T1 week that was locked 2 weeks ago) against the locked WOs from that lock week
- WOs in the lock but not in current data = unplanned
- Exclude WOs with description containing "000"
- Include WOs with door or wall repairs in description
- **Shift code exclusion**: Exclude WOs with shift code GNSF, GNSG, GNSH, GNSI, GNSJ UNLESS the description contains "LOTO" or "PTW"
- Separate LOTO/PTW work orders into their own section at the top
- Organize remaining work orders by building/data center
- Columns: Work Order, Description, Data Center, Shift, Sched Start Date, Status

### 9.3 Incomplete Locked Orders
- Shows locked WOs that are NOT in Work Complete, Closed, or In Process status
- Same shift code exclusion as above (GNSF-GNSJ unless LOTO/PTW)
- Columns: Work Order, Description, Data Center, Shift, Sched Start Date, Status

---

## 10. Inbox Review

Four sub-tabs:

### Tab 1: WO Campaign
- Filter: WOs with "WO Campaign" in description
- Exclude: Work Complete, Closed, Cancelled statuses
- Sort by sched start date (oldest first)
- Columns: Work Order, Description, Shift, Sched Start Date, Sched End Date, Status

### Tab 2: Scheduled Labor Review
- Shows work orders from the scheduled labor upload list
- Only include WOs with "Ready" status
- Group by shift code (not by person name)
- Show total count of Ready status WOs with red count number
- Columns: Work Order, Description, Shift, Sched Start Date, Status

### Tab 3: WOs Awaiting Closure
- Filter: Work Complete status + Deferral Reason Selected = "No"
- Organize by data center sections (alphabetical)
- Columns: Work Order, Description, Shift, Sched Start Date, Status, Deferral Reason
- No Supervisor column

### Tab 4: Production Impact
- Filter: WOs with Production Impact value of 10, 15, 20, 25, or 30 (exclude 40)
- **Only T1-T3 work orders** (sched start date within next 3 weeks)
- Organize by data center sections
- Color-coded impact values: red for 10-15, orange for 20, yellow for 25
- Columns: Work Order, Description, Data Center, Sched Start Date, Shift, Status, Impact, Priority

---

## 11. Global UI Rules

1. **All work order number links** open in new tab using the EAM URL: `https://eamprod.thefacebook.com/web/base/logindisp?tenant=DS_MP_1&FROMEMAIL=YES&SYSTEM_FUNCTION_NAME=WSJOBS&workordernum={WO_NUMBER}`

2. **"Shift" column replaces "Assigned To Name"** everywhere in the UI. The data field "Assigned To Name" exists in the spreadsheet but is never displayed. Show the "Shift" code instead in all tables, cards, and calendar views.

3. **Sort by data center alphabetically** within every tab that groups by data center.

4. **Consistent table column widths** — use `table-fixed` layout with `<colgroup>` to ensure columns align across data center sections within the same tab.

5. **Work Week Leaders** — displayed in standard small text (`text-sm font-semibold`) at the top of T1/T2/T3 Not in Ready tabs and Schedule Lock Review.

6. **Status column** is included in every table view.

7. **Exclude "weekly" description WOs** from: Workload, Risk Identification, Schedule Lock, Schedule Lock Review.

8. **Last uploaded timestamp** shown on T1-T3 Dashboard with stale data warning if >7 days old.

---

## 12. Design Specifications

- **Theme**: Light mode, Swiss Rationalism
- **Primary color**: Muted teal — `oklch(0.55 0.08 200)`
- **Background**: Warm off-white — `oklch(0.98 0.005 85)`
- **Foreground**: Dark warm gray — `oklch(0.25 0.01 85)`
- **Border radius**: 2px everywhere (sharp, rationalist)
- **Font**: Inter (sans-serif), JetBrains Mono (monospace for WO numbers)
- **Cards**: White background, subtle border
- **Active sidebar item**: Primary color background with primary-foreground text
- **Tables**: Alternating hover states, border-bottom separators
- **Badges**: Secondary variant for counts

---

## 13. API Endpoints Summary

| Method | Path | Description |
|---|---|---|
| POST | /api/work-orders/upload | Upload work order Excel file |
| GET | /api/work-orders | Get all work orders |
| POST | /api/scheduled-labor/upload | Upload scheduled labor Excel file |
| GET | /api/scheduled-labor | Get all scheduled labor |
| POST | /api/pm-codes/upload | Upload PM codes Excel file |
| GET | /api/pm-codes | Get all PM codes |
| POST | /api/schedule-locks | Lock work orders (JSON array) |
| GET | /api/schedule-locks | Get all locked WOs |
| GET | /api/schedule-locks/weeks | Get distinct lock weeks |
| GET | /api/schedule-locks/by-week?week= | Get locks for specific week |
| POST | /api/schedule-locks/unlock | Unlock WOs (JSON with workOrderNumbers array) |
| GET | /api/upload-metadata | Get last upload timestamps |
| GET | /api/compliance-alerts | Get WOs within 3 days of compliance |
| POST | /api/deferral-work-orders/upload?category= | Upload deferral WOs for a category |
| GET | /api/deferral-work-orders | Get all deferral WOs |

---

## 14. Build Order

Please build in this order:

1. **Set up project** with database support (web-db-user template)
2. **Create database tables** and run migrations
3. **Build the Express API** with all endpoints from section 13
4. **Create the upload page** with PIN protection and all upload areas
5. **Build the date utilities** (parseExcelDate, getTWeekRange, isTWeek, etc.)
6. **Build T1-T3 Dashboard** with all 7 tabs
7. **Build T4-T8 Dashboard** with all 5 tabs including Deferral Dashboard
8. **Build Schedule Lock** with export functionality
9. **Build Schedule Lock Review** with unplanned and incomplete sections
10. **Build Inbox Review** with all 4 sub-tabs
11. **Apply global UI rules** (shift column, links, sorting, styling)
12. **Write tests** for API endpoints and dashboard logic
13. **Set VITE_UPLOAD_PIN** secret to "1171"

---

## 15. Important Implementation Notes

- Excel dates may come as serial numbers (e.g., 45678) — always handle both serial numbers and date strings in parsing
- The server parses Excel files (not the frontend) — use multer for file upload and xlsx library server-side
- Use batch inserts (100 at a time) for large spreadsheet uploads
- The compliance alerts endpoint runs server-side date comparison
- Schedule lock uses `lock_week` as the Monday date string of the week when the lock was created; when reviewing, use the lock from 2 weeks ago (because lock_week is when lock was created, but WOs are planned for the following week)
- Deferral uploads clear only their specific category before re-inserting (not all categories)
- Night shift codes: GNSD, GNSE, GNSI, GNSJ
- Excluded shift codes from Schedule Lock Review: GNSF, GNSG, GNSH, GNSI, GNSJ (unless description contains LOTO or PTW)
