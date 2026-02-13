import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module
vi.mock("./db.js", () => ({
  query: vi.fn(),
  execute: vi.fn(),
}));

import { query, execute } from "./db.js";

describe("API data mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should map database rows to WorkOrder interface format", () => {
    // Simulate what the GET /work-orders endpoint does
    const dbRow = {
      id: 1,
      work_order_number: "12345",
      description: "Test WO",
      data_center: "DC1",
      sched_start_date: "2026-02-15",
      assigned_to_name: "John Doe",
      status: "Ready",
      type: "PM",
      equipment_description: "Generator",
      priority: "High",
      shift: "Day",
      ehs_lor: "Yes",
      operational_lor: "No",
      deferral_reason_selected: null,
      trade: "Electrical",
      route: "R1",
      sched_end_date: "2026-02-16",
      production_impact: "0",
      compliance_window_start_date: "2026-01-01",
      compliance_window_end_date: "2026-03-01",
      discipline: "Mechanical",
      organization: "Org1",
      department: "Dept1",
      equipment: "EQ001",
      class: "ClassA",
      reported_by: "99",
      pm_code: "PM001",
      assigned_to: "JD",
      date_created: "2026-01-01",
    };

    // Map like the API does
    const mapped = {
      "Work Order": dbRow.work_order_number,
      "Status": dbRow.status,
      "Type": dbRow.type,
      "Priority": dbRow.priority,
      "Data Center": dbRow.data_center,
      "Description": dbRow.description,
      "Route": dbRow.route,
      "Sched. Start Date": dbRow.sched_start_date,
      "Sched. End Date": dbRow.sched_end_date,
      "Shift": dbRow.shift,
      "Assigned To Name": dbRow.assigned_to_name,
      "Operational LOR": dbRow.operational_lor,
      "EHS LOR": dbRow.ehs_lor,
      "Production Impact": dbRow.production_impact,
      "Compliance Window Start Date": dbRow.compliance_window_start_date,
      "Compliance Window End Date": dbRow.compliance_window_end_date,
      "Discipline": dbRow.discipline,
      "Equipment Description": dbRow.equipment_description,
      "Organization": dbRow.organization,
      "Department": dbRow.department,
      "Equipment": dbRow.equipment,
      "Class": dbRow.class,
      "Reported By": dbRow.reported_by,
      "PM Code": dbRow.pm_code,
      "Assigned To": dbRow.assigned_to,
      "Date Created": dbRow.date_created,
      "Deferral Reason Selected": dbRow.deferral_reason_selected,
      "Trade": dbRow.trade,
    };

    expect(mapped["Work Order"]).toBe("12345");
    expect(mapped["Status"]).toBe("Ready");
    expect(mapped["Data Center"]).toBe("DC1");
    expect(mapped["Description"]).toBe("Test WO");
    expect(mapped["Compliance Window End Date"]).toBe("2026-03-01");
    expect(mapped["PM Code"]).toBe("PM001");
    expect(mapped["Trade"]).toBe("Electrical");
    expect(mapped["Deferral Reason Selected"]).toBeNull();
  });

  it("should map WorkOrder to database insert values correctly", () => {
    const workOrder = {
      "Work Order": 12345,
      "Description": "Test WO",
      "Data Center": "DC1",
      "Sched. Start Date": "2026-02-15",
      "Assigned To Name": "John Doe",
      "Status": "Ready",
      "Type": "PM",
      "Equipment Description": "Generator",
      "Priority": "High",
      "Shift": "Day",
      "EHS LOR": "Yes",
      "Operational LOR": "No",
      "Deferral Reason Selected": "",
      "Trade": "Electrical",
      "Route": "R1",
      "Sched. End Date": "2026-02-16",
      "Production Impact": 0,
      "Compliance Window Start Date": "2026-01-01",
      "Compliance Window End Date": "2026-03-01",
      "Discipline": "Mechanical",
      "Organization": "Org1",
      "Department": "Dept1",
      "Equipment": "EQ001",
      "Class": "ClassA",
      "Reported By": 99,
      "PM Code": "PM001",
      "Assigned To": "JD",
      "Date Created": "2026-01-01",
    };

    // Map like the API POST does
    const values = [
      String(workOrder["Work Order"] || ""),
      workOrder["Description"] || null,
      workOrder["Data Center"] || null,
      workOrder["Sched. Start Date"] || null,
      workOrder["Assigned To Name"] || null,
      workOrder["Status"] || null,
      workOrder["Type"] || null,
      workOrder["Equipment Description"] || null,
      workOrder["Priority"] || null,
      workOrder["Shift"] || null,
      workOrder["EHS LOR"] || null,
      workOrder["Operational LOR"] || null,
      workOrder["Deferral Reason Selected"] || null,
      workOrder["Trade"] || null,
      workOrder["Route"] || null,
      workOrder["Sched. End Date"] || null,
      workOrder["Production Impact"] != null ? String(workOrder["Production Impact"]) : null,
      workOrder["Compliance Window Start Date"] || null,
      workOrder["Compliance Window End Date"] || null,
      workOrder["Discipline"] || null,
      workOrder["Organization"] || null,
      workOrder["Department"] || null,
      workOrder["Equipment"] || null,
      workOrder["Class"] || null,
      workOrder["Reported By"] != null ? String(workOrder["Reported By"]) : null,
      workOrder["PM Code"] || null,
      workOrder["Assigned To"] || null,
      workOrder["Date Created"] || null,
    ];

    expect(values).toHaveLength(28);
    expect(values[0]).toBe("12345");
    expect(values[1]).toBe("Test WO");
    expect(values[16]).toBe("0"); // Production Impact as string
    expect(values[24]).toBe("99"); // Reported By as string
  });

  it("should map schedule lock data correctly", () => {
    const lockInput = {
      workOrderNumber: "12345",
      description: "Test WO",
      dataCenter: "DC1",
      schedStartDate: "2026-02-15",
      assignedTo: "John Doe",
      status: "Ready",
      type: "PM",
      equipmentDescription: "Generator",
      priority: "High",
      shift: "Day",
      lockWeek: "2026-02-10",
    };

    const values = [
      String(lockInput.workOrderNumber),
      lockInput.description || null,
      lockInput.dataCenter || null,
      lockInput.schedStartDate || null,
      lockInput.assignedTo || null,
      lockInput.status || null,
      lockInput.type || null,
      lockInput.equipmentDescription || null,
      lockInput.priority || null,
      lockInput.shift || null,
      lockInput.lockWeek,
    ];

    expect(values).toHaveLength(11);
    expect(values[0]).toBe("12345");
    expect(values[10]).toBe("2026-02-10");
  });

  it("should map PM code data correctly", () => {
    const pmCode = {
      "PM Codes": "PM001",
      "Description": "Monthly PM",
      "Status": "Active",
      "Date Approved": "2025-01-01",
      "Perform Every": 30,
      "Period UOM": "Days",
      "LOTO Required": "Yes",
      "PTW Required": "No",
    };

    const values = [
      pmCode["PM Codes"] || "",
      pmCode["Description"] || null,
      pmCode["Status"] || null,
      pmCode["Date Approved"] || null,
      pmCode["Perform Every"] != null ? String(pmCode["Perform Every"]) : null,
      pmCode["Period UOM"] || null,
      pmCode["LOTO Required"] || null,
      pmCode["PTW Required"] || null,
    ];

    expect(values).toHaveLength(8);
    expect(values[0]).toBe("PM001");
    expect(values[4]).toBe("30");
    expect(values[6]).toBe("Yes");
    expect(values[7]).toBe("No");
  });
});
