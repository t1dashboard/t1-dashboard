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
  workOrderNumber: string | number;
}

export interface PMCode {
  "PM Codes": string;
  "Description": string;
  "Status": string;
  "Date Approved": string;
  "Perform Every": number;
  "Period UOM": string;
  "LOTO Required": string;
  "PTW Required": string;
}
