import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique(),
  name: text("name").unique(),
  passwordHash: text("password_hash").notNull(),
  walletBalance: integer("wallet_balance").notNull().default(0),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  commissionEarned: integer("commission_earned").notNull().default(0),
  telegramChatId: text("telegram_chat_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
