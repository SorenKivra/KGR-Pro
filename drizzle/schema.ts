import { boolean, double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const kgrBatches = mysqlTable("kgr_batches", {
  id: varchar("id", { length: 36 }).primaryKey(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  queryMode: mysqlEnum("queryMode", ["quoted", "unquoted"]).notNull(),
  exactProvider: mysqlEnum("exactProvider", ["scrapingdog", "scrapingbee"]).notNull(),
  keywordCount: int("keywordCount").notNull(),
  exactCount: int("exactCount").notNull().default(0),
  hotCount: int("hotCount").notNull().default(0),
  status: mysqlEnum("status", ["completed", "partial", "failed"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const kgrResults = mysqlTable("kgr_results", {
  id: int("id").autoincrement().primaryKey(),
  batchId: varchar("batchId", { length: 36 }).notNull(),
  visitorId: varchar("visitorId", { length: 64 }).notNull(),
  keyword: varchar("keyword", { length: 240 }).notNull(),
  monthlySearchVolume: int("monthlySearchVolume").notNull(),
  allintitleCount: int("allintitleCount"),
  kgr: double("kgr"),
  tier: mysqlEnum("tier", ["hot", "ok", "competitive", "unavailable"]).notNull(),
  classicEligible: boolean("classicEligible").notNull().default(false),
  status: mysqlEnum("status", ["exact", "unavailable"]).notNull(),
  reason: text("reason"),
  source: varchar("source", { length: 120 }).notNull(),
  queriedAt: timestamp("queriedAt").defaultNow().notNull(),
});

export type KgrBatch = typeof kgrBatches.$inferSelect;
export type InsertKgrBatch = typeof kgrBatches.$inferInsert;
export type KgrResultRow = typeof kgrResults.$inferSelect;
export type InsertKgrResult = typeof kgrResults.$inferInsert;