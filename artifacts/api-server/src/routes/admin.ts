import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, submissionsTable, withdrawalsTable, settingsTable } from "@workspace/db";
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
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/admin/submissions", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: submissionsTable.id,
      userId: submissionsTable.userId,
      userEmail: usersTable.email,
      email: submissionsTable.email,
      password: submissionsTable.password,
      status: submissionsTable.status,
      pricePaid: submissionsTable.pricePaid,
      createdAt: submissionsTable.createdAt,
    })
    .from(submissionsTable)
    .leftJoin(usersTable, eq(submissionsTable.userId, usersTable.id))
    .orderBy(submissionsTable.createdAt);

  res.json(AdminListSubmissionsResponse.parse(rows.map(r => ({ ...r, userEmail: r.userEmail ?? "" }))));
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

  const { status } = body.data;
  const { id } = params.data;

  const [existing] = await db
    .select()
    .from(submissionsTable)
    .where(eq(submissionsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Submission not found" });
    return;
  }

  if (status === "approved" && existing.status !== "approved") {
    await db
      .update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.pricePaid}` })
      .where(eq(usersTable.id, existing.userId));
  }

  if (status === "rejected" && existing.status === "approved") {
    await db
      .update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} - ${existing.pricePaid}` })
      .where(eq(usersTable.id, existing.userId));
  }

  await db.update(submissionsTable).set({ status }).where(eq(submissionsTable.id, id));

  const [updated] = await db
    .select({
      id: submissionsTable.id,
      userId: submissionsTable.userId,
      userEmail: usersTable.email,
      email: submissionsTable.email,
      password: submissionsTable.password,
      status: submissionsTable.status,
      pricePaid: submissionsTable.pricePaid,
      createdAt: submissionsTable.createdAt,
    })
    .from(submissionsTable)
    .leftJoin(usersTable, eq(submissionsTable.userId, usersTable.id))
    .where(eq(submissionsTable.id, id));

  req.log.info({ id, status }, "Submission status updated");
  res.json(AdminUpdateSubmissionResponse.parse({ ...updated, userEmail: updated.userEmail ?? "" }));
});

router.get("/admin/withdrawals", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: withdrawalsTable.id,
      userId: withdrawalsTable.userId,
      userEmail: usersTable.email,
      amount: withdrawalsTable.amount,
      telebirrNumber: withdrawalsTable.telebirrNumber,
      telebirrName: withdrawalsTable.telebirrName,
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

  if (status === "rejected" && existing.status === "pending") {
    await db
      .update(usersTable)
      .set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.amount}` })
      .where(eq(usersTable.id, existing.userId));
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
      telebirrNumber: withdrawalsTable.telebirrNumber,
      telebirrName: withdrawalsTable.telebirrName,
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

router.get("/admin/users", async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      walletBalance: usersTable.walletBalance,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  const usersWithStats = await Promise.all(
    users.map(async (user) => {
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

  res.json(AdminListUsersResponse.parse(usersWithStats));
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

  const { pricePerEmail } = body.data;

  await db
    .insert(settingsTable)
    .values({ key: "price_per_email", value: String(pricePerEmail) })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value: String(pricePerEmail) } });

  req.log.info({ pricePerEmail }, "Settings updated");
  res.json(AdminUpdateSettingsResponse.parse({ pricePerEmail }));
});

export default router;
