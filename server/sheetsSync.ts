/**
 * Google Sheets Pull Sync Module
 * 
 * Reads data from a Google Sheet using the Google Sheets REST API directly
 * (with the GOOGLE_WORKSPACE_CLI_TOKEN OAuth token) and syncs it into the database.
 * Runs on a timer and can be triggered manually.
 * 
 * Sheet: https://docs.google.com/spreadsheets/d/1dRpuEeq0uaIeXDOjV1kV9FLDupU3uzlkkGtQSksggTE/edit
 * Tabs:
 *   - "Active Work Orders" → work_orders table
 *   - "Scheduled Labor" → scheduled_labor table
 *   - "Comments" → work_order_comments table
 */

import { query, execute } from "./db.js";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SPREADSHEET_ID = "1dRpuEeq0uaIeXDOjV1kV9FLDupU3uzlkkGtQSksggTE";
const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

type SyncResult = {
  tableName: string;
  rowCount: number;
  durationMs: number;
  error?: string;
};

type FullSyncResult = {
  success: boolean;
  results: SyncResult[];
  totalDurationMs: number;
  timestamp: string;
};

// Track sync state
let isSyncing = false;
let lastSyncResult: FullSyncResult | null = null;
let syncTimerId: ReturnType<typeof setInterval> | null = null;

// Token file path — written by the sync-token helper script
// Use absolute path since process.cwd() may differ between Vite and API server
const TOKEN_FILE = path.resolve("/home/ubuntu/t1-dashboard", ".google-token");

/**
 * Get a fresh OAuth token. Tries multiple sources:
 * 1. Environment variable (if available in the process)
 * 2. Token file on disk (written by a helper cron/script)
 * 3. Shell environment fallback
 */
function getToken(): string {
  // 1. Direct env var
  const envToken = process.env.GOOGLE_WORKSPACE_CLI_TOKEN || process.env.GOOGLE_DRIVE_TOKEN;
  if (envToken) return envToken;

  // 2. Token file on disk
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const fileToken = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
      if (fileToken) return fileToken;
    }
  } catch (e) {
    // ignore
  }

  // 3. Try to read from a login shell (picks up env vars set in .bashrc/.profile)
  try {
    const result = execSync('bash -lc "echo \\$GOOGLE_WORKSPACE_CLI_TOKEN"', {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (result) {
      // Cache it to the token file for next time
      try { fs.writeFileSync(TOKEN_FILE, result); } catch (e) { /* ignore */ }
      return result;
    }
  } catch (e) {
    // ignore
  }

  throw new Error("No Google OAuth token available. GOOGLE_WORKSPACE_CLI_TOKEN is not set and no token file found.");
}

/**
 * Read a sheet tab using the Google Sheets REST API directly.
 * Returns an array of rows, where each row is an array of cell values.
 */
async function readSheetTab(sheetName: string): Promise<string[][]> {
  const token = getToken();
  const range = encodeURIComponent(sheetName);
  const url = `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/${range}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Convert array of arrays (with header row) into array of objects
 */
function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, i) => {
      obj[header] = (row[i] || "").trim();
    });
    return obj;
  });
}

/**
 * Process Active Work Orders tab into the work_orders table
 */
async function syncWorkOrders(): Promise<SyncResult> {
  const start = Date.now();
  const tableName = "work_orders";

  try {
    const rawRows = await readSheetTab("Active Work Orders");
    const rows = rowsToObjects(rawRows);

    if (rows.length === 0) {
      return { tableName, rowCount: 0, durationMs: Date.now() - start, error: "No data found" };
    }

    console.log(`[SheetsSync] Parsed ${rows.length} work orders. Headers: ${Object.keys(rows[0]).join(", ")}`);

    // Filter out MEC (Multiple Equipment Child) work orders — they are sub-WOs and not needed
    const filteredRows = rows.filter(wo => {
      const woType = (wo["Type"] || "").toLowerCase();
      return woType !== "multiple equipment child";
    });
    console.log(`[SheetsSync] Filtered out ${rows.length - filteredRows.length} MEC work orders. Remaining: ${filteredRows.length}`);

    // Clear existing work orders
    await execute("DELETE FROM work_orders");

    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < filteredRows.length; i += batchSize) {
      const batch = filteredRows.slice(i, i + batchSize);
      const values = batch.flatMap((wo) => [
        wo["Work Order"] || "",
        wo["Description"] || null,
        wo["Data Center"] || null,
        wo["Sched Start Date"] || wo["Sched. Start Date"] || null,
        wo["Assigned To"] || wo["Assigned To Name"] || null,
        wo["Status"] || null,
        wo["Type"] || null,
        wo["Equipment Description"] || null,
        wo["Priority"] || null,
        wo["Shift"] || null,
        null, // ehs_lor
        null, // operational_lor
        null, // deferral_reason_selected — INTENTIONALLY ignored from Google Sheets (inaccurate); only populated via manual Excel upload
        null, // trade
        null, // route
        null, // sched_end_date
        null, // production_impact
        null, // compliance_window_start_date
        null, // compliance_window_end_date
        null, // discipline
        wo["Organization"] || null,
        null, // department
        null, // equipment
        null, // class
        null, // reported_by
        null, // pm_code
        null, // assigned_to (code)
        null, // date_created
        wo["Supervisor"] || null,
        null, // date_completed
        null, // facops_suite
        null, // type_code
        null, // estimated_hours
        null, // hours_remaining
        null, // asset_id
        null, // last_saved
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
      totalInserted += batch.length;
    }

    return { tableName, rowCount: totalInserted, durationMs: Date.now() - start };
  } catch (error: any) {
    console.error(`[SheetsSync] Error syncing work orders:`, error);
    return { tableName, rowCount: 0, durationMs: Date.now() - start, error: error.message };
  }
}

/**
 * Process Scheduled Labor tab into the scheduled_labor table
 */
async function syncScheduledLabor(): Promise<SyncResult> {
  const start = Date.now();
  const tableName = "scheduled_labor";

  try {
    const rawRows = await readSheetTab("Scheduled Labor");
    const rows = rowsToObjects(rawRows);

    if (rows.length === 0) {
      return { tableName, rowCount: 0, durationMs: Date.now() - start, error: "No data found" };
    }

    console.log(`[SheetsSync] Parsed ${rows.length} scheduled labor records`);

    // Clear existing
    await execute("DELETE FROM scheduled_labor");

    // Extract work order numbers
    const laborData = rows
      .map((row) => String(row["Work Order"] || "").trim())
      .filter((wo) => wo);

    const batchSize = 200;
    for (let i = 0; i < laborData.length; i += batchSize) {
      const batch = laborData.slice(i, i + batchSize);
      const sql = `INSERT INTO scheduled_labor (work_order_number, uploaded_by) VALUES ${batch.map(() => "(?, 0)").join(", ")}`;
      await execute(sql, batch);
    }

    return { tableName, rowCount: laborData.length, durationMs: Date.now() - start };
  } catch (error: any) {
    console.error(`[SheetsSync] Error syncing scheduled labor:`, error);
    return { tableName, rowCount: 0, durationMs: Date.now() - start, error: error.message };
  }
}

/**
 * Process Comments tab into the work_order_comments table
 */
async function syncComments(): Promise<SyncResult> {
  const start = Date.now();
  const tableName = "comments";

  try {
    const rawRows = await readSheetTab("Comments");
    const rows = rowsToObjects(rawRows);

    if (rows.length === 0) {
      return { tableName, rowCount: 0, durationMs: Date.now() - start, error: "No data found" };
    }

    console.log(`[SheetsSync] Parsed ${rows.length} comments`);

    // Ensure table exists
    await execute(`CREATE TABLE IF NOT EXISTS work_order_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_order_number VARCHAR(50) NOT NULL,
      latest_comment MEDIUMTEXT,
      comment_date VARCHAR(50),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_wo (work_order_number)
    )`);
    try { await execute(`ALTER TABLE work_order_comments ADD COLUMN comment_date VARCHAR(50)`); } catch (e) { /* exists */ }

    // Clear existing
    await execute("DELETE FROM work_order_comments");

    // Parse comments
    const comments = rows.map((row) => {
      let woNum = String(row["Work Order"] || "").trim();
      if (woNum.match(/^\d+\.0$/)) woNum = woNum.replace(/\.0$/, "");

      let comment = String(row["Most Recent Comment"] || row["Latest Comment"] || row["Comment"] || "").trim();
      // Filter out eamprod hyperlinks — these are just WO reference links, not real comments
      if (/eamprod\.thefacebook\.com/i.test(comment)) comment = "";

      const commentDate = String(row["Last Comment Date"] || row["Comment Date"] || "").trim();

      return { workOrderNumber: woNum, comment, commentDate };
    }).filter(c => c.workOrderNumber && c.comment);

    const batchSize = 200;
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize);
      const values = batch.flatMap(c => [c.workOrderNumber, c.comment, c.commentDate || null]);
      const sql = `INSERT INTO work_order_comments (work_order_number, latest_comment, comment_date) VALUES ${batch.map(() => "(?, ?, ?)").join(", ")} ON DUPLICATE KEY UPDATE latest_comment = VALUES(latest_comment), comment_date = VALUES(comment_date), uploaded_at = CURRENT_TIMESTAMP`;
      await execute(sql, values);
    }

    return { tableName, rowCount: comments.length, durationMs: Date.now() - start };
  } catch (error: any) {
    console.error(`[SheetsSync] Error syncing comments:`, error);
    return { tableName, rowCount: 0, durationMs: Date.now() - start, error: error.message };
  }
}

/**
 * Update the upload_metadata table to record sync timestamps
 */
async function updateSyncMetadata(dataType: string): Promise<void> {
  await execute(`CREATE TABLE IF NOT EXISTS upload_metadata (
    data_type VARCHAR(50) PRIMARY KEY,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await execute(
    `INSERT INTO upload_metadata (data_type, uploaded_at) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE uploaded_at = NOW()`,
    [dataType]
  );
}

/**
 * Run a full sync of all 3 tabs
 */
export async function runFullSync(): Promise<FullSyncResult> {
  if (isSyncing) {
    console.log("[SheetsSync] Sync already in progress, skipping");
    return {
      success: false,
      results: [],
      totalDurationMs: 0,
      timestamp: new Date().toISOString(),
    };
  }

  isSyncing = true;
  const start = Date.now();
  const results: SyncResult[] = [];

  try {
    console.log("[SheetsSync] Starting full sync from Google Sheets...");

    // Sync work orders
    const woResult = await syncWorkOrders();
    results.push(woResult);
    if (!woResult.error) {
      await updateSyncMetadata("work_orders");
      console.log(`[SheetsSync] ✓ Work orders: ${woResult.rowCount} rows in ${woResult.durationMs}ms`);
    } else {
      console.error(`[SheetsSync] ✗ Work orders error: ${woResult.error}`);
    }

    // NOTE: Scheduled Labor is NOT auto-synced from Google Sheets.
    // The sheet data may be inaccurate, so scheduled labor relies on manual Excel upload only.

    // Sync comments
    const cmResult = await syncComments();
    results.push(cmResult);
    if (!cmResult.error) {
      await updateSyncMetadata("comments");
      console.log(`[SheetsSync] ✓ Comments: ${cmResult.rowCount} rows in ${cmResult.durationMs}ms`);
    } else {
      console.error(`[SheetsSync] ✗ Comments error: ${cmResult.error}`);
    }

    const totalDurationMs = Date.now() - start;
    const hasErrors = results.some(r => r.error);

    lastSyncResult = {
      success: !hasErrors,
      results,
      totalDurationMs,
      timestamp: new Date().toISOString(),
    };

    console.log(`[SheetsSync] Full sync completed in ${totalDurationMs}ms. Errors: ${hasErrors}`);
    return lastSyncResult;
  } catch (error: any) {
    console.error("[SheetsSync] Full sync failed:", error);
    lastSyncResult = {
      success: false,
      results,
      totalDurationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
    return lastSyncResult;
  } finally {
    isSyncing = false;
  }
}

/**
 * Get the current sync status
 */
export function getSyncStatus() {
  return {
    isSyncing,
    lastSyncResult,
    nextScheduledSync: getNextScheduledSync(),
    timerActive: syncTimerId !== null,
  };
}

/**
 * Calculate the next scheduled sync time
 */
function getNextScheduledSync(): string | null {
  if (!syncTimerId) return null;
  const now = new Date();
  const next4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return next4h.toISOString();
}

/**
 * Start the automatic sync timer
 * - Every 4 hours
 */
export function startSyncTimer(): void {
  if (syncTimerId) {
    console.log("[SheetsSync] Timer already running");
    return;
  }

  const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

  // Run initial sync after a short delay (let server start up first)
  setTimeout(() => {
    console.log("[SheetsSync] Running initial sync...");
    runFullSync().catch(err => console.error("[SheetsSync] Initial sync error:", err));
  }, 10_000);

  // Set up 4-hour interval
  syncTimerId = setInterval(() => {
    console.log("[SheetsSync] Running scheduled 4-hour sync...");
    runFullSync().catch(err => console.error("[SheetsSync] Scheduled sync error:", err));
  }, FOUR_HOURS_MS);

  console.log("[SheetsSync] Sync timer started: every 4 hours");
}

/**
 * Stop the automatic sync timer
 */
export function stopSyncTimer(): void {
  if (syncTimerId) {
    clearInterval(syncTimerId);
    syncTimerId = null;
    console.log("[SheetsSync] Sync timer stopped");
  }
}
