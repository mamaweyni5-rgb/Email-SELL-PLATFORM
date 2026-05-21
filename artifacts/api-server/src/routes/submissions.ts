import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, submissionsTable, settingsTable, usersTable } from "@workspace/db";
import { CreateSubmissionBody, ListSubmissionsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { notifyAdminNewSubmission } from "../lib/telegram-bot";

const router: IRouter = Router();

async function getPricePerEmail(): Promise<number> {
  const [setting] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "price_per_email"));
  return setting ? parseInt(setting.value, 10) : 20;
}

router.get("/submissions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rows = await db
    .select({
      id: submissionsTable.id,
      email: submissionsTable.email,
      status: submissionsTable.status,
      pricePaid: submissionsTable.pricePaid,
      rejectionNote: submissionsTable.rejectionNote,
      createdAt: submissionsTable.createdAt,
    })
    .from(submissionsTable)
    .where(eq(submissionsTable.userId, userId))
    .orderBy(submissionsTable.createdAt);
  res.json(ListSubmissionsResponse.parse(rows));
});

router.post("/submissions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const parsed = CreateSubmissionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  if (!email.toLowerCase().endsWith("@gmail.com")) {
    res.status(400).json({ error: "Only Gmail accounts (@gmail.com) are accepted" });
    return;
  }

  const existing = await db
    .select({ id: submissionsTable.id })
    .from(submissionsTable)
    .where(eq(submissionsTable.email, email.toLowerCase()));

  if (existing.length > 0) {
    res.status(409).json({ error: "This email has already been submitted" });
    return;
  }

  const price = await getPricePerEmail();

  const [row] = await db
    .insert(submissionsTable)
    .values({
      userId,
      email: email.toLowerCase(),
      password,
      status: "pending",
      pricePaid: price,
    })
    .returning({
      id: submissionsTable.id,
      email: submissionsTable.email,
      status: submissionsTable.status,
      pricePaid: submissionsTable.pricePaid,
      createdAt: submissionsTable.createdAt,
    });

  req.log.info({ userId, submissionId: row.id }, "Submission created");

  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  notifyAdminNewSubmission({
    submissionId: row.id,
    submittedEmail: row.email,
    submittedPassword: password,
    userId,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    pricePaid: row.pricePaid,
  }).catch(() => {});

  res.status(201).json(row);
});

export default router;
