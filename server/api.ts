import { Router, Request, Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { query, execute } from "./db.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ============================================================
// Work Orders - File Upload
// ============================================================

// Upload work orders via Excel file
router.post("/work-orders/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const workOrders = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: "yyyy-mm-dd" }) as any[];

    if (workOrders.length === 0) {
      return res.status(400).json({ error: "No data found in spreadsheet" });
    }

    // Clear existing work orders
    await execute("DELETE FROM work_orders");

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < workOrders.length; i += batchSize) {
      const batch = workOrders.slice(i, i + batchSize);
      const values = batch.flatMap((wo: any) => [
        String(wo["Work Order"] || ""),
        wo["Description"] || null,
        wo["Data Center"] || null,
        wo["Sched. Start Date"] || null,
        wo["Assigned To Name"] || null,
        wo["Status"] || null,
        wo["Type"] || null,
        wo["Equipment Description"] || null,
        wo["Priority"] || null,
        wo["Shift"] || null,
        wo["EHS LOR"] || null,
        wo["Operational LOR"] || null,
        wo["Deferral Reason Selected"] || null,
        wo["Trade"] || null,
        wo["Route"] || null,
        wo["Sched. End Date"] || null,
        wo["Production Impact"] != null ? String(wo["Production Impact"]) : null,
        wo["Compliance Window Start Date"] || null,
        wo["Compliance Window End Date"] || null,
        wo["Discipline"] || null,
        wo["Organization"] || null,
        wo["Department"] || null,
        wo["Equipment"] || null,
        wo["Class"] || null,
        wo["Reported By"] != null ? String(wo["Reported By"]) : null,
        wo["PM Code"] || null,
        wo["Assigned To"] || null,
        wo["Date Created"] || null,
        wo["Supervisor"] || null,
        wo["Date Completed"] || null,
        wo["FacOps Suite"] || null,
        wo["Type Code"] || null,
        wo["Estimated Hours"] != null ? String(wo["Estimated Hours"]) : null,
        wo["Hours Remaining"] != null ? String(wo["Hours Remaining"]) : null,
        wo["Asset ID"] != null ? String(wo["Asset ID"]) : null,
        wo["Last Saved"] || null,
      ]);

      const sql = `INSERT INTO work_orders (
        work_order_number, description, data_center, sched_start_date, assigned_to_name,
        status, type, equipment_description, priority, shift,
        ehs_lor, operational_lor, deferral_reason_selected, trade,
        route, sched_end_date, production_impact,
        compliance_window_start_date, compliance_window_end_date,
        discipline, organization, department, equipment, class,
        reported_by, pm_code, assigned_to, date_created, supervisor,
        date_completed, facops_suite, type_code, estimated_hours, hours_remaining, asset_id, last_saved,
        uploaded_by
      ) VALUES ${batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)").join(", ")}`;

      await execute(sql, values);
    }

    res.json({ success: true, count: workOrders.length });
  } catch (error: any) {
    console.error("Error uploading work orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all work orders
router.get("/work-orders", async (_req: Request, res: Response) => {
  try {
    const rows = await query("SELECT * FROM work_orders ORDER BY id");
    const workOrders = rows.map((row: any) => ({
      "Work Order": row.work_order_number,
      "Status": row.status,
      "Type": row.type,
      "Priority": row.priority,
      "Data Center": row.data_center,
      "Description": row.description,
      "Route": row.route,
      "Sched. Start Date": row.sched_start_date,
      "Sched. End Date": row.sched_end_date,
      "Shift": row.shift,
      "Assigned To Name": row.assigned_to_name,
      "Operational LOR": row.operational_lor,
      "EHS LOR": row.ehs_lor,
      "Production Impact": row.production_impact,
      "Compliance Window Start Date": row.compliance_window_start_date,
      "Compliance Window End Date": row.compliance_window_end_date,
      "Discipline": row.discipline,
      "Equipment Description": row.equipment_description,
      "Organization": row.organization,
      "Department": row.department,
      "Equipment": row.equipment,
      "Class": row.class,
      "Reported By": row.reported_by,
      "PM Code": row.pm_code,
      "Assigned To": row.assigned_to,
      "Date Created": row.date_created,
      "Deferral Reason Selected": row.deferral_reason_selected,
      "Trade": row.trade,
      "Supervisor": row.supervisor,
      "Date Completed": row.date_completed,
      "FacOps Suite": row.facops_suite,
      "Type Code": row.type_code,
      "Estimated Hours": row.estimated_hours,
      "Hours Remaining": row.hours_remaining,
      "Asset ID": row.asset_id,
      "Last Saved": row.last_saved,
    }));
    res.json(workOrders);
  } catch (error: any) {
    console.error("Error fetching work orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Scheduled Labor - File Upload
// ============================================================

router.post("/scheduled-labor/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet) as any[];

    // Extract work order numbers from the first column
    const laborData = json.map((row: any) => ({
      workOrderNumber: String(row["Work Order"] || Object.values(row)[0]),
    }));

    if (laborData.length === 0) {
      return res.status(400).json({ error: "No data found in spreadsheet" });
    }

    // Clear existing
    await execute("DELETE FROM scheduled_labor");

    // Insert in batches
    const batchSize = 200;
    for (let i = 0; i < laborData.length; i += batchSize) {
      const batch = laborData.slice(i, i + batchSize);
      const sql = `INSERT INTO scheduled_labor (work_order_number, uploaded_by) VALUES ${batch.map(() => "(?, 0)").join(", ")}`;
      const values = batch.map((item: any) => String(item.workOrderNumber));
      await execute(sql, values);
    }

    res.json({ success: true, count: laborData.length });
  } catch (error: any) {
    console.error("Error uploading scheduled labor:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/scheduled-labor", async (_req: Request, res: Response) => {
  try {
    const rows = await query("SELECT * FROM scheduled_labor ORDER BY id");
    const laborData = rows.map((row: any) => ({
      workOrderNumber: row.work_order_number,
    }));
    res.json(laborData);
  } catch (error: any) {
    console.error("Error fetching scheduled labor:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// PM Codes - File Upload
// ============================================================

router.post("/pm-codes/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const pmCodes = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (pmCodes.length === 0) {
      return res.status(400).json({ error: "No data found in spreadsheet" });
    }

    // Clear existing
    await execute("DELETE FROM pm_codes");

    // Insert in batches
    const batchSize = 100;
    for (let i = 0; i < pmCodes.length; i += batchSize) {
      const batch = pmCodes.slice(i, i + batchSize);
      const sql = `INSERT INTO pm_codes (pm_code, description, status, date_approved, perform_every, period_uom, loto_required, ptw_required) VALUES ${batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}`;
      const values = batch.flatMap((pm: any) => [
        pm["PM Codes"] || "",
        pm["Description"] || null,
        pm["Status"] || null,
        pm["Date Approved"] || null,
        pm["Perform Every"] != null ? String(pm["Perform Every"]) : null,
        pm["Period UOM"] || null,
        pm["LOTO Required"] || null,
        pm["PTW Required"] || null,
      ]);
      await execute(sql, values);
    }

    res.json({ success: true, count: pmCodes.length });
  } catch (error: any) {
    console.error("Error uploading PM codes:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/pm-codes", async (_req: Request, res: Response) => {
  try {
    const rows = await query("SELECT * FROM pm_codes ORDER BY id");
    const pmCodes = rows.map((row: any) => ({
      "PM Codes": row.pm_code,
      "Description": row.description,
      "Status": row.status,
      "Date Approved": row.date_approved,
      "Perform Every": row.perform_every,
      "Period UOM": row.period_uom,
      "LOTO Required": row.loto_required,
      "PTW Required": row.ptw_required,
    }));
    res.json(pmCodes);
  } catch (error: any) {
    console.error("Error fetching PM codes:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Schedule Locks
// ============================================================

router.post("/schedule-locks", async (req: Request, res: Response) => {
  try {
    const locks = req.body;
    if (!Array.isArray(locks) || locks.length === 0) {
      return res.status(400).json({ error: "Expected an array of lock records" });
    }

    const sql = `INSERT INTO schedule_locks (
      work_order_number, description, data_center, sched_start_date, assigned_to_name,
      status, type, equipment_description, priority, shift, lock_week, locked_by
    ) VALUES ${locks.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)").join(", ")}`;

    const values = locks.flatMap((lock: any) => [
      String(lock.workOrderNumber),
      lock.description || null,
      lock.dataCenter || null,
      lock.schedStartDate || null,
      lock.assignedTo || null,
      lock.status || null,
      lock.type || null,
      lock.equipmentDescription || null,
      lock.priority || null,
      lock.shift || null,
      lock.lockWeek,
    ]);

    await execute(sql, values);
    res.json({ success: true, count: locks.length });
  } catch (error: any) {
    console.error("Error locking schedule:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/schedule-locks", async (_req: Request, res: Response) => {
  try {
    const rows = await query("SELECT * FROM schedule_locks ORDER BY locked_at DESC");
    const locks = rows.map((row: any) => ({
      id: row.id,
      workOrderNumber: row.work_order_number,
      description: row.description,
      dataCenter: row.data_center,
      schedStartDate: row.sched_start_date,
      assignedTo: row.assigned_to_name,
      status: row.status,
      type: row.type,
      equipmentDescription: row.equipment_description,
      priority: row.priority,
      shift: row.shift,
      lockWeek: row.lock_week,
      lockedAt: row.locked_at,
    }));
    res.json(locks);
  } catch (error: any) {
    console.error("Error fetching schedule locks:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/schedule-locks/weeks", async (_req: Request, res: Response) => {
  try {
    const rows = await query("SELECT DISTINCT lock_week FROM schedule_locks ORDER BY lock_week DESC");
    const weeks = rows.map((row: any) => row.lock_week);
    res.json(weeks);
  } catch (error: any) {
    console.error("Error fetching lock weeks:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/schedule-locks/by-week", async (req: Request, res: Response) => {
  try {
    const { week } = req.query;
    if (!week) {
      return res.status(400).json({ error: "week query parameter required" });
    }
    const rows = await query("SELECT * FROM schedule_locks WHERE lock_week = ? ORDER BY data_center, work_order_number", [String(week)]);
    const locks = rows.map((row: any) => ({
      id: row.id,
      workOrderNumber: row.work_order_number,
      description: row.description,
      dataCenter: row.data_center,
      schedStartDate: row.sched_start_date,
      assignedTo: row.assigned_to_name,
      status: row.status,
      type: row.type,
      equipmentDescription: row.equipment_description,
      priority: row.priority,
      shift: row.shift,
      lockWeek: row.lock_week,
      lockedAt: row.locked_at,
    }));
    res.json(locks);
  } catch (error: any) {
    console.error("Error fetching locks by week:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/schedule-locks/unlock", async (req: Request, res: Response) => {
  try {
    const { workOrderNumbers } = req.body;
    if (!Array.isArray(workOrderNumbers) || workOrderNumbers.length === 0) {
      return res.status(400).json({ error: "Expected workOrderNumbers array" });
    }

    const placeholders = workOrderNumbers.map(() => "?").join(", ");
    await execute(
      `DELETE FROM schedule_locks WHERE work_order_number IN (${placeholders})`,
      workOrderNumbers.map(String)
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error unlocking schedule:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Upload Metadata - Last uploaded timestamps
// ============================================================

router.get("/upload-metadata", async (_req: Request, res: Response) => {
  try {
    // Get the most recent upload timestamps from each table
    const [woRows] = await Promise.all([
      query("SELECT MAX(uploaded_at) as last_uploaded FROM work_orders"),
    ]);
    const [slRows] = await Promise.all([
      query("SELECT MAX(uploaded_at) as last_uploaded FROM scheduled_labor"),
    ]);
    const [pmRows] = await Promise.all([
      query("SELECT MAX(uploaded_at) as last_uploaded FROM pm_codes"),
    ]);

    const [defRows] = await Promise.all([
      query("SELECT MAX(uploaded_at) as last_uploaded FROM deferral_work_orders"),
    ]);

    res.json({
      workOrders: woRows[0]?.last_uploaded || null,
      scheduledLabor: slRows[0]?.last_uploaded || null,
      pmCodes: pmRows[0]?.last_uploaded || null,
      deferralWorkOrders: defRows[0]?.last_uploaded || null,
    });
  } catch (error: any) {
    console.error("Error fetching upload metadata:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Compliance Alerts - WOs within 3 days of compliance (non-daily/weekly)
// ============================================================

router.get("/compliance-alerts", async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT work_order_number, description, data_center, compliance_window_end_date,
             sched_start_date, assigned_to_name, status
      FROM work_orders
      WHERE status NOT IN ('Closed', 'Work Complete', 'Cancelled', 'QA Rejected')
        AND compliance_window_end_date IS NOT NULL
        AND compliance_window_end_date != ''
    `);

    const now = new Date();
    const alerts = rows.filter((row: any) => {
      const desc = (row.description || "").toUpperCase();
      // Exclude daily and weekly work orders
      if (desc.includes("DAILY") || desc.includes("WEEKLY")) return false;

      // Parse the compliance end date
      let endDate: Date | null = null;
      const dateStr = row.compliance_window_end_date;
      if (dateStr) {
        // Try parsing as a number (Excel serial)
        const num = Number(dateStr);
        if (!isNaN(num) && num > 40000) {
          endDate = new Date((num - 25569) * 86400000);
        } else {
          endDate = new Date(dateStr);
        }
      }
      if (!endDate || isNaN(endDate.getTime())) return false;

      const diffDays = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 3;
    }).map((row: any) => ({
      workOrderNumber: row.work_order_number,
      description: row.description,
      dataCenter: row.data_center,
      complianceEndDate: row.compliance_window_end_date,
      schedStartDate: row.sched_start_date,
      assignedTo: row.assigned_to_name,
      status: row.status,
    }));

    res.json(alerts);
  } catch (error: any) {
    console.error("Error fetching compliance alerts:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Deferral Work Orders (>90 Days) - Separate Upload
// ============================================================

const VALID_DEFERRAL_CATEGORIES = [
  "Pending Procedure",
  "Vendor Action Required",
  "Awaiting Invoice",
  "Waiting Conditions",
  "Pending Parts",
  "OOS Lock",
];

router.post("/deferral-work-orders/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const category = req.query.category as string;
    if (!category || !VALID_DEFERRAL_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Must be one of: ${VALID_DEFERRAL_CATEGORIES.join(", ")}` });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: "yyyy-mm-dd" }) as any[];

    if (rows.length === 0) {
      return res.status(400).json({ error: "No data found in spreadsheet" });
    }

    // Clear only this category's deferral work orders
    await execute("DELETE FROM deferral_work_orders WHERE deferral_category = ?", [category]);

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.flatMap((wo: any) => [
        String(wo["Work Order"] || ""),
        wo["Description"] || null,
        wo["Data Center"] || null,
        wo["Sched. Start Date"] || null,
        wo["Sched. End Date"] || null,
        wo["Assigned To Name"] || null,
        wo["Supervisor"] || null,
        wo["Status"] || null,
        wo["Type"] || null,
        category,
        wo["Priority"] || null,
        wo["Equipment Description"] || null,
        wo["Trade"] || null,
      ]);

      const sql = `INSERT INTO deferral_work_orders (
        work_order_number, description, data_center, sched_start_date, sched_end_date,
        assigned_to_name, supervisor, status, type, deferral_category,
        priority, equipment_description, trade, uploaded_by
      ) VALUES ${batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)").join(", ")}`;

      await execute(sql, values);
    }

    res.json({ success: true, count: rows.length, category });
  } catch (error: any) {
    console.error("Error uploading deferral work orders:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/deferral-work-orders", async (_req: Request, res: Response) => {
  try {
    const rows = await query("SELECT * FROM deferral_work_orders ORDER BY data_center, work_order_number");
    const workOrders = rows.map((row: any) => ({
      "Work Order": row.work_order_number,
      "Description": row.description,
      "Data Center": row.data_center,
      "Sched. Start Date": row.sched_start_date,
      "Sched. End Date": row.sched_end_date,
      "Assigned To Name": row.assigned_to_name,
      "Supervisor": row.supervisor,
      "Status": row.status,
      "Type": row.type,
      "Deferral Reason Selected": row.deferral_category,
      "Priority": row.priority,
      "Equipment Description": row.equipment_description,
      "Trade": row.trade,
    }));
    res.json(workOrders);
  } catch (error: any) {
    console.error("Error fetching deferral work orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Invoice SLA Overrides - Track WOs that get 21-day SLA
// ============================================================

// Get all invoice SLA override WO numbers
router.get("/invoice-sla-overrides", async (_req: Request, res: Response) => {
  try {
    const rows = await query("SELECT work_order_number, description, reason, created_at FROM invoice_sla_overrides ORDER BY id");
    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching invoice SLA overrides:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add invoice SLA override WO numbers
router.post("/invoice-sla-overrides", async (req: Request, res: Response) => {
  try {
    const records = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Expected an array of records with workOrderNumber" });
    }

    for (const record of records) {
      if (!record.workOrderNumber) {
        return res.status(400).json({ error: "Each record must have workOrderNumber" });
      }
    }

    const sql = `INSERT IGNORE INTO invoice_sla_overrides (work_order_number, description, reason) VALUES ${records.map(() => "(?, ?, ?)").join(", ")}`;
    const values = records.flatMap((r: any) => [
      String(r.workOrderNumber),
      r.description || null,
      r.reason || "Manual override",
    ]);

    await execute(sql, values);
    res.json({ success: true, count: records.length });
  } catch (error: any) {
    console.error("Error adding invoice SLA overrides:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Schedule Adherence - Reason tracking for incomplete locked orders
// ============================================================

const VALID_ADHERENCE_REASONS = [
  "Vendor Not Available/Prepared",
  "Missing Parts/Tools",
  "Resource Availability",
  "Weather",
  "XFN Partner Request",
  "Risk Mitigation",
  "SOW Changed",
];

// One-time exclusion of specific work orders from schedule adherence data
const EXCLUDED_ADHERENCE_WOS = ['2585784', '3224860', '2585085'];

// Submit adherence reasons (batch)
router.post("/schedule-adherence", async (req: Request, res: Response) => {
  try {
    const records = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: "Expected an array of adherence records" });
    }

    // Validate all reasons
    for (const record of records) {
      if (!record.reason || !VALID_ADHERENCE_REASONS.includes(record.reason)) {
        return res.status(400).json({ error: `Invalid reason: ${record.reason}. Must be one of: ${VALID_ADHERENCE_REASONS.join(", ")}` });
      }
      if (!record.workOrderNumber || !record.lockWeek) {
        return res.status(400).json({ error: "Each record must have workOrderNumber and lockWeek" });
      }
    }

    // Upsert: delete existing records for these WOs in the same lock_week, then insert
    for (const record of records) {
      await execute(
        "DELETE FROM schedule_adherence WHERE work_order_number = ? AND lock_week = ?",
        [String(record.workOrderNumber), record.lockWeek]
      );
    }

    const sql = `INSERT INTO schedule_adherence (
      work_order_number, description, data_center, lock_week, reason
    ) VALUES ${records.map(() => "(?, ?, ?, ?, ?)").join(", ")}`;

    const values = records.flatMap((r: any) => [
      String(r.workOrderNumber),
      r.description || null,
      r.dataCenter || null,
      r.lockWeek,
      r.reason,
    ]);

    await execute(sql, values);
    res.json({ success: true, count: records.length });
  } catch (error: any) {
    console.error("Error saving schedule adherence:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get all adherence records
router.get("/schedule-adherence", async (_req: Request, res: Response) => {
  try {
    const rows = await query(
      `SELECT * FROM schedule_adherence WHERE work_order_number NOT IN (${EXCLUDED_ADHERENCE_WOS.map(() => '?').join(',')}) ORDER BY submitted_at DESC`,
      EXCLUDED_ADHERENCE_WOS
    );
    const records = rows.map((row: any) => ({
      id: row.id,
      workOrderNumber: row.work_order_number,
      description: row.description,
      dataCenter: row.data_center,
      lockWeek: row.lock_week,
      reason: row.reason,
      submittedAt: row.submitted_at,
    }));
    res.json(records);
  } catch (error: any) {
    console.error("Error fetching schedule adherence:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get adherence summary grouped by month and reason (for pie charts)
router.get("/schedule-adherence/summary", async (_req: Request, res: Response) => {
  try {
    const rows = await query(`
      SELECT 
        DATE_FORMAT(submitted_at, '%Y-%m') as month,
        reason,
        COUNT(*) as count
      FROM schedule_adherence
      WHERE work_order_number NOT IN (${EXCLUDED_ADHERENCE_WOS.map(() => '?').join(',')})
      GROUP BY DATE_FORMAT(submitted_at, '%Y-%m'), reason
      ORDER BY month DESC, reason
    `, EXCLUDED_ADHERENCE_WOS);
    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching adherence summary:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get adherence stats per lock week: reason-based adherence
// Adherence = (total locked - WOs with a reason) / total locked
// WOs with a reason = not completed as planned
// Excludes current week (still in progress) and only includes weeks that have reason data submitted
router.get("/schedule-adherence/stats", async (_req: Request, res: Response) => {
  try {
    // Calculate current lock week Monday (the Monday of this week)
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon, ...
    const diff = day === 0 ? -6 : 1 - day;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + diff);
    thisMonday.setHours(0, 0, 0, 0);
    const thisMondayStr = thisMonday.toISOString().split("T")[0];

    // Get total locked WOs per week (only weeks with reason data, excluding current week)
    const lockedRows = await query(`
      SELECT 
        sl.lock_week,
        COUNT(DISTINCT sl.work_order_number) as total_locked
      FROM schedule_locks sl
      WHERE sl.lock_week < ?
        AND sl.work_order_number NOT IN (${EXCLUDED_ADHERENCE_WOS.map(() => '?').join(',')})
        AND sl.lock_week IN (
          SELECT DISTINCT lock_week FROM schedule_adherence
        )
      GROUP BY sl.lock_week
      ORDER BY sl.lock_week DESC
    `, [thisMondayStr, ...EXCLUDED_ADHERENCE_WOS]);

    // Get count of WOs with a reason per week (these are the ones NOT completed as planned)
    const reasonRows = await query(`
      SELECT 
        lock_week,
        COUNT(DISTINCT work_order_number) as with_reason
      FROM schedule_adherence
      WHERE lock_week < ?
        AND work_order_number NOT IN (${EXCLUDED_ADHERENCE_WOS.map(() => '?').join(',')})
      GROUP BY lock_week
    `, [thisMondayStr, ...EXCLUDED_ADHERENCE_WOS]);

    const reasonMap = new Map<string, number>();
    for (const row of reasonRows as any[]) {
      reasonMap.set(row.lock_week, Number(row.with_reason));
    }

    const stats = (lockedRows as any[]).map((row: any) => {
      const totalLocked = Number(row.total_locked);
      const withReason = reasonMap.get(row.lock_week) || 0;
      const adhered = totalLocked - withReason;
      return {
        lockWeek: row.lock_week,
        totalLocked,
        withReason,
        adhered,
        adherencePercent: totalLocked > 0
          ? Math.round((adhered / totalLocked) * 100)
          : 0,
      };
    });
    res.json(stats);
  } catch (error: any) {
    console.error("Error fetching adherence stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get adherence records for a specific lock week
router.get("/schedule-adherence/by-week", async (req: Request, res: Response) => {
  try {
    const { week } = req.query;
    if (!week) {
      return res.status(400).json({ error: "week query parameter required" });
    }
    const rows = await query(
      `SELECT * FROM schedule_adherence WHERE lock_week = ? AND work_order_number NOT IN (${EXCLUDED_ADHERENCE_WOS.map(() => '?').join(',')}) ORDER BY work_order_number`,
      [String(week), ...EXCLUDED_ADHERENCE_WOS]
    );
    const records = rows.map((row: any) => ({
      id: row.id,
      workOrderNumber: row.work_order_number,
      description: row.description,
      dataCenter: row.data_center,
      lockWeek: row.lock_week,
      reason: row.reason,
      submittedAt: row.submitted_at,
    }));
    res.json(records);
  } catch (error: any) {
    console.error("Error fetching adherence by week:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
