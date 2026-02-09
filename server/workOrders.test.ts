import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import { workOrders, scheduledLabor, scheduleLocks } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Work Orders API", () => {
  const mockUserId = 1;
  const mockContext = {
    user: { id: mockUserId, openId: "test-user", name: "Test User", role: "user" as const },
    req: {} as any,
    res: {} as any,
  };

  const caller = appRouter.createCaller(mockContext);

  beforeAll(async () => {
    // Clean up test data
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(workOrders).where(eq(workOrders.uploadedBy, mockUserId));
    await db.delete(scheduledLabor).where(eq(scheduledLabor.uploadedBy, mockUserId));
    await db.delete(scheduleLocks).where(eq(scheduleLocks.lockedBy, mockUserId));
  });

  afterAll(async () => {
    // Clean up test data
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(workOrders).where(eq(workOrders.uploadedBy, mockUserId));
    await db.delete(scheduledLabor).where(eq(scheduledLabor.uploadedBy, mockUserId));
    await db.delete(scheduleLocks).where(eq(scheduleLocks.lockedBy, mockUserId));
  });

  describe("Work Orders", () => {
    it("should upload work orders", async () => {
      const testOrders = [
        {
          workOrderNumber: "12345",
          description: "Test Work Order 1",
          dataCenter: "DC1",
          schedStartDate: "2026-02-10",
          assignedToName: "John Doe",
          status: "Ready",
          type: "Corrective Maintenance",
          equipmentDescription: "Server 1",
          priority: "High",
          shift: "GNSF",
          ehsLor: "Low",
          operationalLor: "Medium",
          deferralReasonSelected: "NO",
          trade: "IT",
        },
        {
          workOrderNumber: "12346",
          description: "Test Work Order 2",
          dataCenter: "DC2",
          schedStartDate: "2026-02-11",
          assignedToName: "Jane Smith",
          status: "Planning",
          type: "Preventive Maintenance",
          equipmentDescription: "Server 2",
          priority: "Medium",
          shift: "GNSD",
          ehsLor: "Low",
          operationalLor: "Low",
          deferralReasonSelected: "YES",
          trade: "Electrical",
        },
      ];

      const result = await caller.workOrders.upload({ workOrders: testOrders });

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it("should list work orders", async () => {
      const result = await caller.workOrders.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toHaveProperty("workOrderNumber");
      expect(result[0]).toHaveProperty("description");
      expect(result[0]).toHaveProperty("dataCenter");
    });

    it("should replace existing work orders on new upload", async () => {
      const newOrders = [
        {
          workOrderNumber: "99999",
          description: "Replacement Work Order",
          dataCenter: "DC3",
          schedStartDate: "2026-02-12",
          assignedToName: "Bob Johnson",
          status: "Ready",
          type: "Corrective Maintenance",
          equipmentDescription: "Server 3",
          priority: "Low",
          shift: "GNSF",
          ehsLor: "Low",
          operationalLor: "Low",
          deferralReasonSelected: "NO",
          trade: "Mechanical",
        },
      ];

      const result = await caller.workOrders.upload({ workOrders: newOrders });
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const list = await caller.workOrders.list();
      expect(list.length).toBe(1);
      expect(list[0].workOrderNumber).toBe("99999");
    });
  });

  describe("Scheduled Labor", () => {
    it("should upload scheduled labor", async () => {
      const testLabor = [
        { workOrderNumber: "12345" },
        { workOrderNumber: "12346" },
      ];

      const result = await caller.scheduledLabor.upload({ labor: testLabor });

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });

    it("should list scheduled labor", async () => {
      const result = await caller.scheduledLabor.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result[0]).toHaveProperty("workOrderNumber");
    });

    it("should replace existing scheduled labor on new upload", async () => {
      const newLabor = [{ workOrderNumber: "99999" }];

      const result = await caller.scheduledLabor.upload({ labor: newLabor });
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const list = await caller.scheduledLabor.list();
      expect(list.length).toBe(1);
      expect(list[0].workOrderNumber).toBe("99999");
    });
  });

  describe("Schedule Locks", () => {
    beforeAll(async () => {
      // Upload a work order for locking tests
      await caller.workOrders.upload({
        workOrders: [
          {
            workOrderNumber: "54321",
            description: "Lock Test Work Order",
            dataCenter: "DC1",
            schedStartDate: "2026-02-10",
            assignedToName: "Test User",
            status: "Ready",
            type: "Corrective Maintenance",
            equipmentDescription: "Test Equipment",
            priority: "High",
            shift: "GNSF",
            ehsLor: "Low",
            operationalLor: "Low",
            deferralReasonSelected: "NO",
            trade: "IT",
          },
        ],
      });
    });

    it("should lock work orders", async () => {
      const testLocks = [
        {
          workOrderNumber: "54321",
          description: "Lock Test Work Order",
          dataCenter: "DC1",
          schedStartDate: "2026-02-10",
          assignedTo: "Test User",
          status: "Ready",
          type: "Corrective Maintenance",
          equipmentDescription: "Test Equipment",
          priority: "High",
          shift: "GNSF",
          lockWeek: "2026-02-10",
        },
      ];

      const result = await caller.scheduleLocks.lock({ locks: testLocks });

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it("should list locked work orders", async () => {
      const result = await caller.scheduleLocks.list();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0]).toHaveProperty("workOrderNumber");
      expect(result[0]).toHaveProperty("lockWeek");
    });

    it("should unlock work orders", async () => {
      const result = await caller.scheduleLocks.unlock({
        workOrderNumbers: ["54321"],
      });

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      const list = await caller.scheduleLocks.list();
      const locked = list.find((lock) => lock.workOrderNumber === "54321");
      expect(locked).toBeUndefined();
    });

    it("should handle locking the same work order multiple times", async () => {
      const testLocks = [
        {
          workOrderNumber: "54321",
          description: "Lock Test Work Order",
          dataCenter: "DC1",
          schedStartDate: "2026-02-10",
          assignedTo: "Test User",
          status: "Ready",
          type: "Corrective Maintenance",
          equipmentDescription: "Test Equipment",
          priority: "High",
          shift: "GNSF",
          lockWeek: "2026-02-10",
        },
      ];

      // Lock first time
      await caller.scheduleLocks.lock({ locks: testLocks });

      // Lock second time - should not create duplicate
      const result = await caller.scheduleLocks.lock({ locks: testLocks });

      expect(result.success).toBe(true);

      const list = await caller.scheduleLocks.list();
      const matchingLocks = list.filter(
        (lock) => lock.workOrderNumber === "54321" && lock.lockWeek === "2026-02-10"
      );
      expect(matchingLocks.length).toBe(1);
    });
  });
});
