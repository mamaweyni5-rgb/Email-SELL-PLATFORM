import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, broadcastsTable } from "@workspace/db";
import { ListBroadcastsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/broadcasts", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(broadcastsTable)
    .orderBy(desc(broadcastsTable.createdAt))
    .limit(20);

  res.json(ListBroadcastsResponse.parse(rows));
});

export default router;
