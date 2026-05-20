import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, withdrawalsTable, usersTable } from "@workspace/db";
import { CreateWithdrawalBody, ListWithdrawalsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rows = await db
    .select({
      id: withdrawalsTable.id,
      amount: withdrawalsTable.amount,
      paymentMethod: withdrawalsTable.paymentMethod,
      telebirrNumber: withdrawalsTable.telebirrNumber,
      telebirrName: withdrawalsTable.telebirrName,
      bankName: withdrawalsTable.bankName,
      bankAccountNumber: withdrawalsTable.bankAccountNumber,
      bankAccountName: withdrawalsTable.bankAccountName,
      status: withdrawalsTable.status,
      adminNote: withdrawalsTable.adminNote,
      createdAt: withdrawalsTable.createdAt,
    })
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, userId))
    .orderBy(withdrawalsTable.createdAt);
  res.json(ListWithdrawalsResponse.parse(rows));
});

router.post("/withdrawals", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const parsed = CreateWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  const [user] = await db
    .select({ walletBalance: usersTable.walletBalance })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user || user.walletBalance < data.amount) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  await db
    .update(usersTable)
    .set({ walletBalance: user.walletBalance - data.amount })
    .where(eq(usersTable.id, userId));

  const insertValues =
    data.paymentMethod === "telebirr"
      ? {
          userId,
          amount: data.amount,
          paymentMethod: "telebirr" as const,
          telebirrNumber: data.telebirrNumber,
          telebirrName: data.telebirrName,
          status: "pending" as const,
        }
      : {
          userId,
          amount: data.amount,
          paymentMethod: "bank" as const,
          telebirrNumber: "",
          telebirrName: "",
          bankName: data.bankName,
          bankAccountNumber: data.bankAccountNumber,
          bankAccountName: data.bankAccountName,
          status: "pending" as const,
        };

  const [row] = await db
    .insert(withdrawalsTable)
    .values(insertValues)
    .returning({
      id: withdrawalsTable.id,
      amount: withdrawalsTable.amount,
      paymentMethod: withdrawalsTable.paymentMethod,
      telebirrNumber: withdrawalsTable.telebirrNumber,
      telebirrName: withdrawalsTable.telebirrName,
      bankName: withdrawalsTable.bankName,
      bankAccountNumber: withdrawalsTable.bankAccountNumber,
      bankAccountName: withdrawalsTable.bankAccountName,
      status: withdrawalsTable.status,
      adminNote: withdrawalsTable.adminNote,
      createdAt: withdrawalsTable.createdAt,
    });

  req.log.info({ userId, withdrawalId: row.id, amount: data.amount, paymentMethod: data.paymentMethod }, "Withdrawal requested");
  res.status(201).json(row);
});

export default router;
