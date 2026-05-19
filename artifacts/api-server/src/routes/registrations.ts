import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, registrationsTable } from "@workspace/db";
import {
  CreateRegistrationBody,
  DeleteRegistrationParams,
  ListRegistrationsResponse,
  GetRegistrationStatsResponse,
} from "@workspace/api-zod";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

router.get("/registrations", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: registrationsTable.id,
      email: registrationsTable.email,
      password: registrationsTable.password,
      createdAt: registrationsTable.createdAt,
    })
    .from(registrationsTable)
    .orderBy(registrationsTable.createdAt);
  res.json(ListRegistrationsResponse.parse(rows));
});

router.post("/registrations", async (req, res): Promise<void> => {
  const parsed = CreateRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const existing = await db
    .select({ id: registrationsTable.id })
    .from(registrationsTable)
    .where(eq(registrationsTable.email, email.toLowerCase()));

  if (existing.length > 0) {
    res.status(409).json({ error: "This email is already registered" });
    return;
  }

  const [row] = await db
    .insert(registrationsTable)
    .values({
      email: email.toLowerCase(),
      password: password,
      passwordHash: hashPassword(password),
    })
    .returning({
      id: registrationsTable.id,
      email: registrationsTable.email,
      password: registrationsTable.password,
      createdAt: registrationsTable.createdAt,
    });

  req.log.info({ id: row.id }, "New registration created");
  res.status(201).json(row);
});

router.get("/registrations/stats", async (_req, res): Promise<void> => {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrationsTable);

  const [todayRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrationsTable)
    .where(sql`${registrationsTable.createdAt} >= ${startOfDay.toISOString()}`);

  const [weekRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(registrationsTable)
    .where(sql`${registrationsTable.createdAt} >= ${startOfWeek.toISOString()}`);

  res.json(
    GetRegistrationStatsResponse.parse({
      total: totalRow.count,
      todayCount: todayRow.count,
      weekCount: weekRow.count,
    })
  );
});

router.delete("/registrations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteRegistrationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(registrationsTable)
    .where(eq(registrationsTable.id, params.data.id))
    .returning({ id: registrationsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Registration not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
