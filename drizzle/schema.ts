import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Work orders table - stores all uploaded work order data
 * Shared across all users
 */
export const workOrders = mysqlTable("work_orders", {
  id: int("id").autoincrement().primaryKey(),
  workOrderNumber: varchar("work_order_number", { length: 64 }).notNull(),
  description: text("description"),
  dataCenter: varchar("data_center", { length: 128 }),
  schedStartDate: varchar("sched_start_date", { length: 64 }),
  assignedToName: varchar("assigned_to_name", { length: 256 }),
  status: varchar("status", { length: 64 }),
  type: varchar("type", { length: 128 }),
  equipmentDescription: text("equipment_description"),
  priority: varchar("priority", { length: 64 }),
  shift: varchar("shift", { length: 64 }),
  ehsLor: varchar("ehs_lor", { length: 64 }),
  operationalLor: varchar("operational_lor", { length: 64 }),
  deferralReasonSelected: varchar("deferral_reason_selected", { length: 16 }),
  trade: varchar("trade", { length: 64 }),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: int("uploaded_by").notNull(),
});

/**
 * Scheduled labor table - tracks work orders marked as "No" for LOTO review
 */
export const scheduledLabor = mysqlTable("scheduled_labor", {
  id: int("id").autoincrement().primaryKey(),
  workOrderNumber: varchar("work_order_number", { length: 64 }).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: int("uploaded_by").notNull(),
});

/**
 * Schedule locks table - stores locked work orders by week
 */
export const scheduleLocks = mysqlTable("schedule_locks", {
  id: int("id").autoincrement().primaryKey(),
  workOrderNumber: varchar("work_order_number", { length: 64 }).notNull(),
  description: text("description"),
  dataCenter: varchar("data_center", { length: 128 }),
  schedStartDate: varchar("sched_start_date", { length: 64 }),
  assignedToName: varchar("assigned_to_name", { length: 256 }),
  status: varchar("status", { length: 64 }),
  type: varchar("type", { length: 128 }),
  equipmentDescription: text("equipment_description"),
  priority: varchar("priority", { length: 64 }),
  shift: varchar("shift", { length: 64 }),
  lockWeek: varchar("lock_week", { length: 16 }).notNull(), // Monday date as YYYY-MM-DD
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  lockedBy: int("locked_by").notNull(),
});

export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = typeof workOrders.$inferInsert;
export type ScheduledLabor = typeof scheduledLabor.$inferSelect;
export type InsertScheduledLabor = typeof scheduledLabor.$inferInsert;
export type ScheduleLock = typeof scheduleLocks.$inferSelect;
export type InsertScheduleLock = typeof scheduleLocks.$inferInsert;