import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, messagesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.userId, userId))
    .orderBy(messagesTable.createdAt);
  res.json(msgs);
});

router.post("/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { body } = req.body;
  if (!body || typeof body !== "string" || !body.trim()) {
    res.status(400).json({ error: "Message body is required" });
    return;
  }
  const [msg] = await db
    .insert(messagesTable)
    .values({ userId, fromAdmin: false, body: body.trim() })
    .returning();
  res.status(201).json(msg);
});

router.patch("/messages/:id/read", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(and(eq(messagesTable.id, id), eq(messagesTable.userId, userId)));
  res.sendStatus(204);
});

export default router;

export async function createSystemMessage(userId: number, body: string): Promise<void> {
  await db.insert(messagesTable).values({ userId, fromAdmin: true, body });
}
