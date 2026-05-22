import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { notifyAdminNewSubmission } from "../lib/telegram-bot";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

async function getPricePerEmail(): Promise<number> {
  const { rows } = await pool.query(
    "SELECT value FROM app_settings WHERE key = 'price_per_email'"
  );
  return rows.length > 0 ? parseInt(rows[0].value, 10) : 20;
}

router.get("/generated-emails/available-count", async (_req, res): Promise<void> => {
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM generated_emails WHERE status = 'available'"
  );
  res.json({ count: rows[0]?.count ?? 0 });
});

router.get("/generated-emails/my-claim", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { rows } = await pool.query(
    `SELECT id, name, email, password, status, claimed_at
     FROM generated_emails
     WHERE claimed_by = $1 AND status = 'claimed'
     LIMIT 1`,
    [userId]
  );
  res.json(rows[0] ?? null);
});

router.post("/generated-emails/claim", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const existing = await pool.query(
    "SELECT id FROM generated_emails WHERE claimed_by = $1 AND status = 'claimed'",
    [userId]
  );
  if (existing.rows.length > 0) {
    res.status(409).json({ error: "You already have a claimed email. Submit or return it first." });
    return;
  }

  const { rows } = await pool.query(
    `UPDATE generated_emails
     SET status = 'claimed', claimed_by = $1, claimed_at = NOW()
     WHERE id = (
       SELECT id FROM generated_emails
       WHERE status = 'available'
       ORDER BY created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id, name, email, password, status, claimed_at`,
    [userId]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "No emails available right now. Please try again later." });
    return;
  }

  req.log.info({ userId, genEmailId: rows[0].id }, "Generated email claimed");
  res.json(rows[0]);
});

router.delete("/generated-emails/claim", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const { rows } = await pool.query(
    `UPDATE generated_emails
     SET status = 'available', claimed_by = NULL, claimed_at = NULL
     WHERE claimed_by = $1 AND status = 'claimed'
     RETURNING id`,
    [userId]
  );

  if (rows.length === 0) {
    res.status(404).json({ error: "No claimed email found" });
    return;
  }

  req.log.info({ userId }, "Generated email returned");
  res.json({ success: true });
});

router.post("/generated-emails/:id/submit", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const emailId = parseInt(req.params.id, 10);

  if (isNaN(emailId)) {
    res.status(400).json({ error: "Invalid email ID" });
    return;
  }

  const { rows: emailRows } = await pool.query(
    `SELECT id, email, password FROM generated_emails
     WHERE id = $1 AND claimed_by = $2 AND status = 'claimed'`,
    [emailId, userId]
  );

  if (emailRows.length === 0) {
    res.status(404).json({ error: "Email not found or not claimed by you" });
    return;
  }

  const genEmail = emailRows[0] as { id: number; email: string; password: string };
  const normalizedEmail = genEmail.email.toLowerCase();

  const { rows: existingSub } = await pool.query(
    "SELECT id FROM submissions WHERE email = $1",
    [normalizedEmail]
  );
  if (existingSub.length > 0) {
    res.status(409).json({ error: "This email has already been submitted" });
    return;
  }

  const price = await getPricePerEmail();

  const { rows: subRows } = await pool.query(
    `INSERT INTO submissions (user_id, email, password, status, price_paid)
     VALUES ($1, $2, $3, 'pending', $4)
     RETURNING id, email, status, price_paid AS "pricePaid", created_at AS "createdAt"`,
    [userId, normalizedEmail, genEmail.password, price]
  );

  await pool.query(
    "UPDATE generated_emails SET status = 'submitted' WHERE id = $1",
    [emailId]
  );

  req.log.info({ userId, genEmailId: emailId, submissionId: subRows[0].id }, "Generated email submitted");

  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  notifyAdminNewSubmission({
    submissionId: subRows[0].id,
    submittedEmail: normalizedEmail,
    submittedPassword: genEmail.password,
    userId,
    userName: user?.name ?? null,
    userEmail: user?.email ?? null,
    pricePaid: price,
  }).catch(() => {});

  res.status(201).json(subRows[0]);
});

router.get("/admin/generated-emails", async (_req, res): Promise<void> => {
  const { rows } = await pool.query(
    `SELECT ge.id, ge.name, ge.email, ge.password, ge.status, ge.claimed_at, ge.created_at,
            u.name AS claimed_by_name
     FROM generated_emails ge
     LEFT JOIN users u ON u.id = ge.claimed_by
     ORDER BY ge.created_at DESC`
  );
  res.json(rows);
});

router.post("/admin/generated-emails", async (req, res): Promise<void> => {
  const { emails } = req.body as { emails: { name?: string; email: string; password: string }[] };

  if (!Array.isArray(emails) || emails.length === 0) {
    res.status(400).json({ error: "Provide an array of { name, email, password } objects" });
    return;
  }

  const added: number[] = [];
  const skipped: string[] = [];

  for (const entry of emails) {
    if (!entry.email || !entry.password) continue;
    try {
      const { rows } = await pool.query(
        `INSERT INTO generated_emails (name, email, password)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [entry.name?.trim() ?? null, entry.email.toLowerCase().trim(), entry.password.trim()]
      );
      if (rows.length > 0) {
        added.push(rows[0].id as number);
      } else {
        skipped.push(entry.email);
      }
    } catch {
      skipped.push(entry.email);
    }
  }

  res.status(201).json({ added: added.length, skipped: skipped.length, skippedEmails: skipped });
});

router.delete("/admin/generated-emails/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const { rowCount } = await pool.query(
    "DELETE FROM generated_emails WHERE id = $1",
    [id]
  );
  if ((rowCount ?? 0) === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
