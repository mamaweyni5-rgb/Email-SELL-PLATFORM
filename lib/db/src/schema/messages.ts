import { pgTable, serial, integer, boolean, text, timestamp } from "drizzle-orm/pg-core";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  fromAdmin: boolean("from_admin").notNull().default(false),
  body: text("body").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Message = typeof messagesTable.$inferSelect;
