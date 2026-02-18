import { WorkOrder, ScheduledLabor, PMCode } from "@/types/workOrder";

const API_BASE = "/api";

// ============================================================
// Work Orders
// ============================================================

export async function uploadWorkOrdersFile(file: File): Promise<{ success: boolean; count: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/work-orders/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed with status ${res.status}`);
  }
  return res.json();
}

export async function getWorkOrders(): Promise<WorkOrder[]> {
  const res = await fetch(`${API_BASE}/work-orders`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ============================================================
// Scheduled Labor
// ============================================================

export async function uploadScheduledLaborFile(file: File): Promise<{ success: boolean; count: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/scheduled-labor/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed with status ${res.status}`);
  }
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

export async function uploadPMCodesFile(file: File): Promise<{ success: boolean; count: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/pm-codes/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed with status ${res.status}`);
  }
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

export async function getScheduleLockWeeks(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/schedule-locks/weeks`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getScheduleLocksByWeek(week: string): Promise<ScheduleLock[]> {
  const res = await fetch(`${API_BASE}/schedule-locks/by-week?week=${encodeURIComponent(week)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface UploadMetadata {
  workOrders: string | null;
  scheduledLabor: string | null;
  pmCodes: string | null;
}

export async function getUploadMetadata(): Promise<UploadMetadata> {
  const res = await fetch(`${API_BASE}/upload-metadata`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export interface ComplianceAlert {
  workOrderNumber: string;
  description: string;
  dataCenter: string;
  complianceEndDate: string;
  schedStartDate: string;
  assignedTo: string;
  status: string;
}

export async function getComplianceAlerts(): Promise<ComplianceAlert[]> {
  const res = await fetch(`${API_BASE}/compliance-alerts`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ============================================================
// Deferral Work Orders (>90 Days)
// ============================================================

export interface DeferralWorkOrder {
  "Work Order": string;
  "Description": string;
  "Data Center": string;
  "Sched. Start Date": string;
  "Sched. End Date": string;
  "Assigned To Name": string;
  "Supervisor": string;
  "Status": string;
  "Type": string;
  "Deferral Reason Selected": string;
  "Priority": string;
  "Equipment Description": string;
  "Trade": string;
}

export type DeferralCategory = 
  | "Pending Procedure"
  | "Vendor Action Required"
  | "Awaiting Invoice"
  | "Waiting Conditions"
  | "Pending Parts"
  | "OOS Lock";

export async function uploadDeferralWorkOrdersFile(file: File, category: DeferralCategory): Promise<{ success: boolean; count: number; category: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/deferral-work-orders/upload?category=${encodeURIComponent(category)}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed with status ${res.status}`);
  }
  return res.json();
}

export async function getDeferralWorkOrders(): Promise<DeferralWorkOrder[]> {
  const res = await fetch(`${API_BASE}/deferral-work-orders`);
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
