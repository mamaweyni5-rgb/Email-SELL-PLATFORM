import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  telebirrNumber: text("telebirr_number").notNull(),
  telebirrName: text("telebirr_name").notNull(),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Withdrawal = typeof withdrawalsTable.$inferSelect;
