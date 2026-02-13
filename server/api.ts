import { Router, Request, Response } from "express";
import { query, execute } from "./db.js";

const router = Router();

// ============================================================
// Work Orders
// ============================================================

// Upload work orders (replaces all existing)
router.post("/work-orders", async (req: Request, res: Response) => {
  try {
    const workOrders = req.body;
    if (!Array.isArray(workOrders) || workOrders.length === 0) {
      return res.status(400).json({ error: "Expected an array of work orders" });
    }

    // Clear existing work orders
    await execute("DELETE FROM work_orders");

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < workOrders.length; i += batchSize) {
      const batch = workOrders.slice(i, i + batchSize);
      const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)").join(", ");
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
        wo["Sched. End Date"] || null,
        wo["Production Impact"] != null ? String(wo["Production Impact"]) : null,
      ]);

      // Fix: only use the correct 31 values per row
      const fixedValues = batch.flatMap((wo: any) => [
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
      ]);

      const sql = `INSERT INTO work_orders (
        work_order_number, description, data_center, sched_start_date, assigned_to_name,
        status, type, equipment_description, priority, shift,
        ehs_lor, operational_lor, deferral_reason_selected, trade,
        route, sched_end_date, production_impact,
        compliance_window_start_date, compliance_window_end_date,
        discipline, organization, department, equipment, class,
        reported_by, pm_code, assigned_to, date_created, uploaded_by
      ) VALUES ${batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)").join(", ")}`;

      await execute(sql, fixedValues);
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
    // Map DB columns back to the frontend WorkOrder interface format
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
    }));
    res.json(workOrders);
  } catch (error: any) {
    console.error("Error fetching work orders:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Scheduled Labor
// ============================================================

// Upload scheduled labor (replaces all existing)
router.post("/scheduled-labor", async (req: Request, res: Response) => {
  try {
    const laborData = req.body;
    if (!Array.isArray(laborData) || laborData.length === 0) {
      return res.status(400).json({ error: "Expected an array of scheduled labor records" });
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

// Get all scheduled labor
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
// PM Codes
// ============================================================

// Upload PM codes (replaces all existing)
router.post("/pm-codes", async (req: Request, res: Response) => {
  try {
    const pmCodes = req.body;
    if (!Array.isArray(pmCodes) || pmCodes.length === 0) {
      return res.status(400).json({ error: "Expected an array of PM codes" });
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

// Get all PM codes
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

// Lock work orders
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

// Get all schedule locks
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

// Unlock (delete) schedule locks
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

export default router;
