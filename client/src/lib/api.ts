import { WorkOrder, ScheduledLabor, PMCode } from "@/types/workOrder";

const API_BASE = "/api";

// ============================================================
// Work Orders
// ============================================================

export async function uploadWorkOrders(workOrders: WorkOrder[]): Promise<{ success: boolean; count: number }> {
  // First, clear existing work orders
  const clearRes = await fetch(`${API_BASE}/work-orders/clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!clearRes.ok) throw new Error(await clearRes.text());

  // Upload in batches of 500 to avoid payload size limits
  const batchSize = 500;
  let totalUploaded = 0;

  for (let i = 0; i < workOrders.length; i += batchSize) {
    const batch = workOrders.slice(i, i + batchSize);
    const res = await fetch(`${API_BASE}/work-orders/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(await res.text());
    const result = await res.json();
    totalUploaded += result.count;
  }

  return { success: true, count: totalUploaded };
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const res = await fetch(`${API_BASE}/work-orders`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ============================================================
// Scheduled Labor
// ============================================================

export async function uploadScheduledLabor(labor: ScheduledLabor[]): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${API_BASE}/scheduled-labor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(labor),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getScheduledLabor(): Promise<ScheduledLabor[]> {
  const res = await fetch(`${API_BASE}/scheduled-labor`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ============================================================
// PM Codes
// ============================================================

export async function uploadPMCodes(pmCodes: PMCode[]): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${API_BASE}/pm-codes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pmCodes),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getPMCodes(): Promise<PMCode[]> {
  const res = await fetch(`${API_BASE}/pm-codes`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ============================================================
// Schedule Locks
// ============================================================

export interface ScheduleLock {
  id?: number;
  workOrderNumber: string;
  description: string | null;
  dataCenter: string | null;
  schedStartDate: string | null;
  assignedTo: string | null;
  status: string | null;
  type: string | null;
  equipmentDescription: string | null;
  priority: string | null;
  shift: string | null;
  lockWeek: string;
  lockedAt?: string;
}

export async function lockWorkOrders(locks: ScheduleLock[]): Promise<{ success: boolean; count: number }> {
  const res = await fetch(`${API_BASE}/schedule-locks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(locks),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getScheduleLocks(): Promise<ScheduleLock[]> {
  const res = await fetch(`${API_BASE}/schedule-locks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function unlockWorkOrders(workOrderNumbers: string[]): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/schedule-locks/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workOrderNumbers }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
