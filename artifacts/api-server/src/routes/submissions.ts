import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, submissionsTable, settingsTable } from "@workspace/db";
import { CreateSubmissionBody, ListSubmissionsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

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
  res.status(201).json(row);
});

export default router;
