import { Router, type IRouter } from "express";
import { eq, sql, ilike, or, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, submissionsTable, withdrawalsTable, settingsTable, broadcastsTable, messagesTable } from "@workspace/db";
import { getSettingValue, getSettingString } from "./settings";
import { createSystemMessage } from "./messages";
import {
  notifySubmissionApproved,
  notifySubmissionRejected,
  notifyWithdrawalCompleted,
  notifyWithdrawalRejected,
  sendBroadcastMessage,
} from "../lib/telegram-bot";
import {
  AdminListSubmissionsResponse,
  AdminUpdateSubmissionParams,
  AdminUpdateSubmissionBody,
  AdminUpdateSubmissionResponse,
  AdminListWithdrawalsResponse,
  AdminUpdateWithdrawalParams,
  AdminUpdateWithdrawalBody,
  AdminUpdateWithdrawalResponse,
  AdminListUsersResponse,
  AdminGetStatsResponse,
  AdminUpdateSettingsBody,
  AdminUpdateSettingsResponse,
  AdminVerifyPasswordBody,
  AdminVerifyPasswordResponse,
  AdminChangePasswordBody,
  AdminSendBroadcastBody,
} from "@workspace/api-zod";

const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mailtrade@admin2024";

async function getAdminPasswordHash(): Promise<string> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "admin_password_hash"));
  if (row) return row.value;
  return bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
}

const router: IRouter = Router();

router.get("/admin/submissions", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: submissionsTable.id,
      userId: submissionsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      email: submissionsTable.email,
      password: submissionsTable.password,
      status: submissionsTable.status,
      pricePaid: submissionsTable.pricePaid,
      rejectionNote: submissionsTable.rejectionNote,
      createdAt: submissionsTable.createdAt,
    })
    .from(submissionsTable)
    .leftJoin(usersTable, eq(submissionsTable.userId, usersTable.id))
    .orderBy(submissionsTable.createdAt);

  res.json(AdminListSubmissionsResponse.parse(rows.map((r: typeof rows[number]) => ({ ...r, userEmail: r.userEmail ?? "", userName: r.userName ?? "" }))));
});

router.patch("/admin/submissions/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminUpdateSubmissionParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdminUpdateSubmissionBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { status, rejectionNote } = body.data;
  const { id } = params.data;

  const [existing] = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  const [owner] = await db
    .select({ telegramChatId: usersTable.telegramChatId, referredBy: usersTable.referredBy })
    .from(usersTable)
    .where(eq(usersTable.id, existing.userId));

  if (status === "approved" && existing.status !== "approved") {
    await db
      .update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.pricePaid}` })
      .where(eq(usersTable.id, existing.userId));

    if (owner?.referredBy) {
      const commissionPct = await getSettingValue("referral_commission_pct", 10);
      const commission = Math.floor(existing.pricePaid * commissionPct / 100);
      if (commission > 0) {
        await db
          .update(usersTable)
          .set({
            walletBalance: sql`${usersTable.walletBalance} + ${commission}`,
            commissionEarned: sql`${usersTable.commissionEarned} + ${commission}`,
          })
          .where(eq(usersTable.id, owner.referredBy));
        req.log.info({ referrerId: owner.referredBy, commission }, "Referral commission paid");
      }
    }

    notifySubmissionApproved(owner?.telegramChatId, existing.email, existing.pricePaid).catch(() => {});
  }

  if (status === "rejected" && existing.status !== "rejected") {
    if (existing.status === "approved") {
      await db
        .update(usersTable)
        .set({ walletBalance: sql`${usersTable.walletBalance} - ${existing.pricePaid}` })
        .where(eq(usersTable.id, existing.userId));
    }
    notifySubmissionRejected(owner?.telegramChatId, existing.email).catch(() => {});
  }

  await db
    .update(submissionsTable)
    .set({ status, rejectionNote: status === "rejected" ? (rejectionNote ?? null) : null })
    .where(eq(submissionsTable.id, id));

  const [updated] = await db
    .select({
      id: submissionsTable.id,
      userId: submissionsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      email: submissionsTable.email,
      password: submissionsTable.password,
      status: submissionsTable.status,
      pricePaid: submissionsTable.pricePaid,
      rejectionNote: submissionsTable.rejectionNote,
      createdAt: submissionsTable.createdAt,
    })
    .from(submissionsTable)
    .leftJoin(usersTable, eq(submissionsTable.userId, usersTable.id))
    .where(eq(submissionsTable.id, id));

  req.log.info({ id, status }, "Submission status updated");
  res.json(AdminUpdateSubmissionResponse.parse({ ...updated, userEmail: (updated as any).userEmail ?? "", userName: (updated as any).userName ?? "" }));
});

router.get("/admin/withdrawals", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: withdrawalsTable.id,
      userId: withdrawalsTable.userId,
      userEmail: usersTable.email,
      amount: withdrawalsTable.amount,
      paymentMethod: withdrawalsTable.paymentMethod,
      telebirrNumber: withdrawalsTable.telebirrNumber,
      telebirrName: withdrawalsTable.telebirrName,
      bankName: withdrawalsTable.bankName,
      bankAccountNumber: withdrawalsTable.bankAccountNumber,
      bankAccountName: withdrawalsTable.bankAccountName,
      status: withdrawalsTable.status,
      adminNote: withdrawalsTable.adminNote,
      createdAt: withdrawalsTable.createdAt,
    })
    .from(withdrawalsTable)
    .leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .orderBy(withdrawalsTable.createdAt);

  res.json(AdminListWithdrawalsResponse.parse(rows.map(r => ({ ...r, userEmail: r.userEmail ?? "" }))));
});

router.patch("/admin/withdrawals/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AdminUpdateWithdrawalParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = AdminUpdateWithdrawalBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { status, adminNote } = body.data;
  const { id } = params.data;

  const [existing] = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  const [wdOwner] = await db
    .select({ telegramChatId: usersTable.telegramChatId })
    .from(usersTable)
    .where(eq(usersTable.id, existing.userId));

  if (status === "rejected" && existing.status === "pending") {
    await db
      .update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.amount}` })
      .where(eq(usersTable.id, existing.userId));
    notifyWithdrawalRejected(wdOwner?.telegramChatId, existing.amount, adminNote).catch(() => {});
  }

  if (status === "completed" && existing.status !== "completed") {
    notifyWithdrawalCompleted(wdOwner?.telegramChatId, existing.amount, existing.telebirrNumber).catch(() => {});
    const dest = existing.paymentMethod === "bank"
      ? `${existing.bankName ?? ""} - ${existing.bankAccountNumber ?? ""}`
      : existing.telebirrNumber;
    createSystemMessage(existing.userId, `💸 ዊዝድሮዎ ተፈጽሟል!\n\nወደ ${dest} ${existing.amount} ETB ተልኳል። ✅`).catch(() => {});
  }

  if (status === "rejected" && existing.status !== "rejected") {
    const note = adminNote ? `\n\nምክንያት: ${adminNote}` : "";
    createSystemMessage(existing.userId, `❌ የዊዝድሮ ጥያቄዎ ተቀባይነት አላገኘም።${note}\n\nብሩ ወደ ዋሌትዎ ተመልሷል።`).catch(() => {});
  }

  await db
    .update(withdrawalsTable)
    .set({ status, adminNote: adminNote ?? null })
    .where(eq(withdrawalsTable.id, id));

  const [updated] = await db
    .select({
      id: withdrawalsTable.id,
      userId: withdrawalsTable.userId,
      userEmail: usersTable.email,
      amount: withdrawalsTable.amount,
      paymentMethod: withdrawalsTable.paymentMethod,
      telebirrNumber: withdrawalsTable.telebirrNumber,
      telebirrName: withdrawalsTable.telebirrName,
      bankName: withdrawalsTable.bankName,
      bankAccountNumber: withdrawalsTable.bankAccountNumber,
      bankAccountName: withdrawalsTable.bankAccountName,
      status: withdrawalsTable.status,
      adminNote: withdrawalsTable.adminNote,
      createdAt: withdrawalsTable.createdAt,
    })
    .from(withdrawalsTable)
    .leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(eq(withdrawalsTable.id, id));

  req.log.info({ id, status }, "Withdrawal status updated");
  res.json(AdminUpdateWithdrawalResponse.parse({ ...updated, userEmail: updated.userEmail ?? "" }));
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const search = req.query.search as string | undefined;

  const baseQuery = db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      walletBalance: usersTable.walletBalance,
      isBanned: usersTable.isBanned,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable);

  const users = search
    ? await baseQuery.where(
        or(
          ilike(usersTable.name, `%${search}%`),
          ilike(usersTable.email, `%${search}%`)
        )
      ).orderBy(usersTable.createdAt)
    : await baseQuery.orderBy(usersTable.createdAt);

  const usersWithStats = await Promise.all(
    users.map(async (user: typeof users[number]) => {
      const [stats] = await db
        .select({
          total: sql<number>`count(*)::int`,
          approved: sql<number>`count(*) filter (where ${submissionsTable.status} = 'approved')::int`,
        })
        .from(submissionsTable)
        .where(eq(submissionsTable.userId, user.id));
      return {
        ...user,
        totalSubmissions: stats.total,
        approvedSubmissions: stats.approved,
      };
    }),
  );

  res.json(AdminListUsersResponse.parse(usersWithStats.map((u: any) => ({ ...u }))));
});

router.get("/admin/users/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [user] = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      walletBalance: usersTable.walletBalance,
      isBanned: usersTable.isBanned,
      telegramJoined: usersTable.telegramJoined,
      telegramChatId: usersTable.telegramChatId,
      commissionEarned: usersTable.commissionEarned,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${submissionsTable.status} = 'approved')::int`,
    })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, id));

  res.json({ ...user, totalSubmissions: stats.total, approvedSubmissions: stats.approved });
});

router.patch("/admin/users/:id/ban", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const [user] = await db.select({ isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const newBanned = !user.isBanned;
  await db.update(usersTable).set({ isBanned: newBanned }).where(eq(usersTable.id, id));
  res.json({ isBanned: newBanned });
});

router.get("/admin/messages", async (_req, res): Promise<void> => {
  const users = await db.select({ id: usersTable.id, name: usersTable.name, email: usersTable.email }).from(usersTable);
  const conversations = await Promise.all(
    users.map(async (u: { id: number; name: string | null; email: string | null }) => {
      const [last] = await db.select().from(messagesTable).where(eq(messagesTable.userId, u.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
      if (!last) return null;
      const [{ unread }] = await db.select({ unread: sql<number>`count(*)::int` }).from(messagesTable).where(eq(messagesTable.userId, u.id));
      return { userId: u.id, userName: u.name ?? "", userEmail: u.email ?? "", lastMessage: last.body, lastMessageAt: last.createdAt, unreadCount: unread };
    })
  );
  res.json(conversations.filter(Boolean).sort((a: any, b: any) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()));
});

router.get("/admin/messages/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  const msgs = await db.select().from(messagesTable).where(eq(messagesTable.userId, userId)).orderBy(messagesTable.createdAt);
  res.json(msgs);
});

router.post("/admin/messages/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  const { body } = req.body;
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "Message body is required" });
    return;
  }
  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const [msg] = await db.insert(messagesTable).values({ userId, fromAdmin: true, body: body.trim() }).returning();
  res.status(201).json(msg);
});

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [userCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable);

  const [subStats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${submissionsTable.status} = 'pending')::int`,
      approved: sql<number>`count(*) filter (where ${submissionsTable.status} = 'approved')::int`,
      totalPayout: sql<number>`coalesce(sum(${submissionsTable.pricePaid}) filter (where ${submissionsTable.status} = 'approved'), 0)::int`,
    })
    .from(submissionsTable);

  const [wdStats] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${withdrawalsTable.status} = 'pending')::int`,
    })
    .from(withdrawalsTable);

  res.json(
    AdminGetStatsResponse.parse({
      totalUsers: userCount.count,
      totalSubmissions: subStats.total,
      pendingSubmissions: subStats.pending,
      approvedSubmissions: subStats.approved,
      totalEmailsBought: subStats.approved,
      totalPayoutsBirr: subStats.totalPayout,
      pendingWithdrawals: wdStats.pending,
    }),
  );
});

router.patch("/admin/settings", async (req, res): Promise<void> => {
  const body = AdminUpdateSettingsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { pricePerEmail, referralCommissionPct, telegramBotUsername } = body.data;

  await db
    .insert(settingsTable)
    .values({ key: "price_per_email", value: String(pricePerEmail) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(pricePerEmail) } });

  await db
    .insert(settingsTable)
    .values({ key: "referral_commission_pct", value: String(referralCommissionPct) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(referralCommissionPct) } });

  if (telegramBotUsername !== undefined) {
    await db
      .insert(settingsTable)
      .values({ key: "telegram_bot_username", value: telegramBotUsername })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: telegramBotUsername } });
  }

  const savedBotUsername = await getSettingString("telegram_bot_username", "");
  req.log.info({ pricePerEmail, referralCommissionPct }, "Settings updated");
  res.json(AdminUpdateSettingsResponse.parse({ pricePerEmail, referralCommissionPct, telegramBotUsername: savedBotUsername }));
});

router.post("/admin/broadcast", async (req, res): Promise<void> => {
  const parsed = AdminSendBroadcastBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { title, message } = parsed.data;

  const [broadcast] = await db
    .insert(broadcastsTable)
    .values({ title, message })
    .returning();

  const users = await db
    .select({ telegramChatId: usersTable.telegramChatId })
    .from(usersTable);

  const telegramUsers = users.filter((u) => u.telegramChatId);
  req.log.info({ count: telegramUsers.length, broadcastId: broadcast!.id }, "Sending broadcast via Telegram");

  await Promise.allSettled(
    telegramUsers.map((u) =>
      sendBroadcastMessage(u.telegramChatId!, title, message).catch(() => {})
    )
  );

  req.log.info({ broadcastId: broadcast!.id, telegramCount: telegramUsers.length }, "Broadcast sent");
  res.status(201).json(broadcast);
});

router.post("/admin/verify-password", async (req, res): Promise<void> => {
  const parsed = AdminVerifyPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const hash = await getAdminPasswordHash();
  const valid = await bcrypt.compare(parsed.data.password, hash);
  res.json(AdminVerifyPasswordResponse.parse({ valid }));
});

router.patch("/admin/change-password", async (req, res): Promise<void> => {
  const parsed = AdminChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const hash = await getAdminPasswordHash();
  const valid = await bcrypt.compare(currentPassword, hash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db
    .insert(settingsTable)
    .values({ key: "admin_password_hash", value: newHash })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: newHash } });

  req.log.info("Admin password changed");
  res.json(AdminVerifyPasswordResponse.parse({ valid: true }));
});

export default router;
