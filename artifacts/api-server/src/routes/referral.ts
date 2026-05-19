import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/referral", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [user] = await db
    .select({
      referralCode: usersTable.referralCode,
      commissionEarned: usersTable.commissionEarned,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(usersTable)
    .where(eq(usersTable.referredBy, userId));

  res.json({
    referralCode: user.referralCode ?? "",
    referralCount: countResult.count,
    commissionEarned: user.commissionEarned,
  });
});

export default router;
