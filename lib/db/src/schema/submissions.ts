import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  status: text("status").notNull().default("pending"),
  pricePaid: integer("price_paid").notNull().default(0),
  rejectionNote: text("rejection_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Submission = typeof submissionsTable.$inferSelect;
