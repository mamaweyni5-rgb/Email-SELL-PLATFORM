import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { GetSettingsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

export async function getSettingValue(key: string, defaultVal: number): Promise<number> {
  const [row] = await db
    .select({ value: settingsTable.value })
    .from(settingsTable)
    .where(eq(settingsTable.key, key));
  return row ? parseInt(row.value, 10) : defaultVal;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const pricePerEmail = await getSettingValue("price_per_email", 20);
  const referralCommissionPct = await getSettingValue("referral_commission_pct", 10);
  res.json(GetSettingsResponse.parse({ pricePerEmail, referralCommissionPct }));
});

export default router;
