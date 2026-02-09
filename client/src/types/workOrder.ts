// Database schema types (from API)
export interface WorkOrderDB {
  id: number;
  workOrderNumber: string;
  description: string | null;
  dataCenter: string | null;
  schedStartDate: string | null;
  assignedToName: string | null;
  status: string | null;
  type: string | null;
  equipmentDescription: string | null;
  priority: string | null;
  shift: string | null;
  ehsLor: string | null;
  operationalLor: string | null;
  deferralReasonSelected: string | null;
  trade: string | null;
  uploadedBy: number;
  uploadedAt: Date;
}

// Excel upload format (legacy format for compatibility with existing components)
export interface WorkOrder {
  "Work Order": number;
  "Status": string;
  "Type": string;
  "Priority": string;
  "Data Center": string;
  "Description": string;
  "Route": string;
  "Sched. Start Date": string;
  "Sched. End Date": string;
  "Shift": string;
  "Assigned To Name": string;
  "Operational LOR": string;
  "EHS LOR": string;
  "Production Impact": number;
  "Compliance Window Start Date": string;
  "Compliance Window End Date": string;
  "Discipline": string;
  "Equipment Description": string;
  "Organization": string;
  "Department": string;
  "Equipment": string;
  "Class": string;
  "Reported By": number;
  "PM Code": string;
  "Assigned To": string;
  "Date Created": string;

  "Deferral Reason Selected": string;
  "Trade"?: string;
}

export interface ScheduledLabor {
  workOrderNumber: number;
}

export interface ScheduledLaborDB {
  id: number;
  workOrderNumber: string;
  uploadedBy: number;
  uploadedAt: Date;
}

// Helper function to convert database format to legacy format
export function dbToWorkOrder(db: WorkOrderDB): WorkOrder {
  return {
    "Work Order": parseInt(db.workOrderNumber) || 0,
    "Status": db.status || "",
    "Type": db.type || "",
    "Priority": db.priority || "",
    "Data Center": db.dataCenter || "",
    "Description": db.description || "",
    "Route": "",
    "Sched. Start Date": db.schedStartDate || "",
    "Sched. End Date": "",
    "Shift": db.shift || "",
    "Assigned To Name": db.assignedToName || "",
    "Operational LOR": db.operationalLor || "",
    "EHS LOR": db.ehsLor || "",
    "Production Impact": 0,
    "Compliance Window Start Date": "",
    "Compliance Window End Date": "",
    "Discipline": "",
    "Equipment Description": db.equipmentDescription || "",
    "Organization": "",
    "Department": "",
    "Equipment": "",
    "Class": "",
    "Reported By": 0,
    "PM Code": "",
    "Assigned To": "",
    "Date Created": "",
    "Deferral Reason Selected": db.deferralReasonSelected || "",
    "Trade": db.trade || "",
  };
}

// Helper function to convert database format to legacy scheduled labor format
export function dbToScheduledLabor(db: ScheduledLaborDB): ScheduledLabor {
  return {
    workOrderNumber: parseInt(db.workOrderNumber) || 0,
  };
}
