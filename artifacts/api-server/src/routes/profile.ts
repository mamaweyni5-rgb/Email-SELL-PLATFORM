import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, submissionsTable } from "@workspace/db";
import { GetProfileResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/profile", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, walletBalance: usersTable.walletBalance })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      approved: sql<number>`count(*) filter (where ${submissionsTable.status} = 'approved')::int`,
      pending: sql<number>`count(*) filter (where ${submissionsTable.status} = 'pending')::int`,
    })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, userId));

  res.json(
    GetProfileResponse.parse({
      id: user.id,
      email: user.email,
      walletBalance: user.walletBalance,
      totalSubmissions: stats.total,
      approvedSubmissions: stats.approved,
      pendingSubmissions: stats.pending,
    }),
  );
});

export default router;
