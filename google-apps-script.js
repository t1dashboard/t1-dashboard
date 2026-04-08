/**
 * Google Apps Script - Auto-sync Google Sheet to T1 Dashboard
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Update the WEBHOOK_URL below with your dashboard URL
 * 5. Update the SHEET_CONFIG with your sheet tab names and data types
 * 6. Click Save (Ctrl+S)
 * 7. To set up automatic triggers:
 *    - Click the clock icon (Triggers) in the left sidebar
 *    - Click "+ Add Trigger"
 *    - Choose function: "syncAllSheets" (or "syncWorkOrders" for a single sheet)
 *    - Choose event source: "Time-driven"
 *    - Choose type: "Minutes timer" > "Every 5 minutes" (or your preferred interval)
 *    - Click Save
 * 8. You can also run "syncAllSheets" manually from the Run menu to test
 */

// ============================================================
// CONFIGURATION - Update these values
// ============================================================

const WEBHOOK_URL = 'https://t1dash-jdx475rz.manus.space/api/webhook/sheets-update';

// Map each sheet tab name to its data type
// Data types: "work_orders", "scheduled_labor", "comments"
const SHEET_CONFIG = {
  'Sheet1': 'work_orders',           // Change 'Sheet1' to your actual tab name for work orders
  // 'Scheduled Labor': 'scheduled_labor',  // Uncomment and rename if you have a scheduled labor tab
  // 'Comments': 'comments',                // Uncomment and rename if you have a comments tab
};

// ============================================================
// SYNC FUNCTIONS
// ============================================================

/**
 * Sync all configured sheets to the dashboard
 */
function syncAllSheets() {
  const results = [];
  
  for (const [sheetName, dataType] of Object.entries(SHEET_CONFIG)) {
    try {
      const result = syncSheet(sheetName, dataType);
      results.push({ sheet: sheetName, ...result });
      Logger.log(`✅ ${sheetName} (${dataType}): Synced ${result.count} rows`);
    } catch (error) {
      results.push({ sheet: sheetName, error: error.message });
      Logger.log(`❌ ${sheetName} (${dataType}): ${error.message}`);
    }
  }
  
  return results;
}

/**
 * Sync a single sheet tab to the dashboard
 */
function syncSheet(sheetName, dataType) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  
  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }
  
  const data = sheet.getDataRange().getValues();
  
  if (data.length < 2) {
    throw new Error(`Sheet "${sheetName}" has no data rows`);
  }
  
  // Convert to CSV
  const csv = data.map(function(row) {
    return row.map(function(cell) {
      // Handle dates
      if (cell instanceof Date) {
        return Utilities.formatDate(cell, Session.getScriptTimeZone(), 'MM/dd/yyyy');
      }
      // Escape commas and quotes in CSV
      var str = String(cell);
      if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',');
  }).join('\n');
  
  // Send to webhook
  const payload = {
    csvData: csv,
    tableName: dataType,
  };
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };
  
  const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
  const responseCode = response.getResponseCode();
  const responseBody = JSON.parse(response.getContentText());
  
  if (responseCode !== 200) {
    throw new Error(`HTTP ${responseCode}: ${responseBody.error || 'Unknown error'}`);
  }
  
  return responseBody;
}

// ============================================================
// CONVENIENCE FUNCTIONS - Call these individually if needed
// ============================================================

/**
 * Sync just work orders
 */
function syncWorkOrders() {
  for (const [sheetName, dataType] of Object.entries(SHEET_CONFIG)) {
    if (dataType === 'work_orders') {
      const result = syncSheet(sheetName, dataType);
      Logger.log(`Synced ${result.count} work orders from "${sheetName}"`);
      return result;
    }
  }
  Logger.log('No work_orders sheet configured');
}

/**
 * Sync just scheduled labor
 */
function syncScheduledLabor() {
  for (const [sheetName, dataType] of Object.entries(SHEET_CONFIG)) {
    if (dataType === 'scheduled_labor') {
      const result = syncSheet(sheetName, dataType);
      Logger.log(`Synced ${result.count} scheduled labor records from "${sheetName}"`);
      return result;
    }
  }
  Logger.log('No scheduled_labor sheet configured');
}

/**
 * Sync just comments
 */
function syncComments() {
  for (const [sheetName, dataType] of Object.entries(SHEET_CONFIG)) {
    if (dataType === 'comments') {
      const result = syncSheet(sheetName, dataType);
      Logger.log(`Synced ${result.count} comments from "${sheetName}"`);
      return result;
    }
  }
  Logger.log('No comments sheet configured');
}

// ============================================================
// TRIGGER SETUP HELPER
// ============================================================

/**
 * Run this once to set up an automatic trigger that syncs every 5 minutes
 * You can also set up triggers manually via the Triggers UI
 */
function setupAutoSync() {
  // Remove existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncAllSheets') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger - runs every 5 minutes
  ScriptApp.newTrigger('syncAllSheets')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  Logger.log('✅ Auto-sync trigger created: syncAllSheets will run every 5 minutes');
}

/**
 * Remove the auto-sync trigger
 */
function removeAutoSync() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'syncAllSheets') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });
  Logger.log(`Removed ${removed} auto-sync trigger(s)`);
}
