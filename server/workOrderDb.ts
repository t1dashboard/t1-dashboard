import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { workOrders, scheduledLabor, scheduleLocks, InsertWorkOrder, InsertScheduledLabor, InsertScheduleLock } from "../drizzle/schema";

/**
 * Upload work orders - replaces all existing work orders
 */
export async function uploadWorkOrders(orders: InsertWorkOrder[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete existing work orders
  await db.delete(workOrders);
  
  // Insert new work orders in batches
  if (orders.length > 0) {
    const batchSize = 100;
    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      await db.insert(workOrders).values(batch);
    }
  }
}

/**
 * Get all work orders
 */
export async function getAllWorkOrders() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(workOrders);
}

/**
 * Upload scheduled labor - replaces all existing records
 */
export async function uploadScheduledLabor(labor: InsertScheduledLabor[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete existing scheduled labor
  await db.delete(scheduledLabor);
  
  // Insert new scheduled labor
  if (labor.length > 0) {
    await db.insert(scheduledLabor).values(labor);
  }
}

/**
 * Get all scheduled labor records
 */
export async function getAllScheduledLabor() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(scheduledLabor);
}

/**
 * Lock work orders for a specific week
 */
export async function lockWorkOrders(locks: InsertScheduleLock[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (locks.length > 0) {
    // Check for existing locks and only insert new ones
    for (const lock of locks) {
      const existing = await db.select().from(scheduleLocks)
        .where(eq(scheduleLocks.workOrderNumber, lock.workOrderNumber));
      
      if (existing.length === 0) {
        await db.insert(scheduleLocks).values(lock);
      }
    }
  }
}

/**
 * Get all schedule locks
 */
export async function getAllScheduleLocks() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.select().from(scheduleLocks);
}

/**
 * Unlock specific work orders
 */
export async function unlockWorkOrders(workOrderNumbers: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete locks for the specified work order numbers
  for (const woNumber of workOrderNumbers) {
    await db.delete(scheduleLocks).where(eq(scheduleLocks.workOrderNumber, woNumber));
  }
}
