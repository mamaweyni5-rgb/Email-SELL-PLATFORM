import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { handleUpdate, type TelegramUpdate } from "../lib/telegram-bot";

const router: IRouter = Router();

router.post("/auth/telegram-id", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { telegramChatId } = req.body as { telegramChatId?: unknown };
  if (!telegramChatId || typeof telegramChatId !== "string") {
    res.status(400).json({ error: "Invalid chat id" });
    return;
  }

  await db
    .update(usersTable)
    .set({ telegramChatId })
    .where(eq(usersTable.id, req.session.userId));

  res.json({ ok: true });
});

router.post("/telegram/webhook", async (req, res): Promise<void> => {
  res.sendStatus(200);
  const update = req.body as TelegramUpdate;
  handleUpdate(update).catch(() => {});
});

export default router;
