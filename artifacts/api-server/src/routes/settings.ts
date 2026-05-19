import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { GetSettingsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const [setting] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, "price_per_email"));

  const pricePerEmail = setting ? parseInt(setting.value, 10) : 20;
  res.json(GetSettingsResponse.parse({ pricePerEmail }));
});

export default router;
