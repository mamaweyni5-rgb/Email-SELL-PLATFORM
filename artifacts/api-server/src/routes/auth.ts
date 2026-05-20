import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { RegisterBody, LoginBody, LoginResponse, GetMeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, name, password, referralCode: inputCode } = parsed.data;

  const normalizedEmail = email?.trim() ? email.trim().toLowerCase() : null;
  const normalizedName = name?.trim() ? name.trim() : null;

  if (!normalizedEmail && !normalizedName) {
    res.status(400).json({ error: "Please provide either an email or a display name." });
    return;
  }

  if (normalizedEmail) {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail));
    if (existing) {
      res.status(409).json({ error: "This email is already registered." });
      return;
    }
  }

  if (normalizedName) {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.name, normalizedName));
    if (existing) {
      res.status(409).json({ error: "This display name is already taken." });
      return;
    }
  }

  let referrerId: number | null = null;
  if (inputCode) {
    const [referrer] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, inputCode.toUpperCase()));
    if (referrer) {
      referrerId = referrer.id;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  let newCode = generateReferralCode();
  let attempts = 0;
  while (attempts < 5) {
    const conflict = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.referralCode, newCode));
    if (conflict.length === 0) break;
    newCode = generateReferralCode();
    attempts++;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail ?? undefined,
      name: normalizedName ?? undefined,
      passwordHash,
      referralCode: newCode,
      referredBy: referrerId ?? undefined,
    })
    .returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name, walletBalance: usersTable.walletBalance });

  req.session.userId = user.id;
  req.log.info({ userId: user.id, referrerId, hasEmail: !!normalizedEmail, hasName: !!normalizedName }, "User registered");
  res.status(201).json(LoginResponse.parse(user));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { identifier, password } = parsed.data;

  const looksLikeEmail = identifier.includes("@");

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      looksLikeEmail
        ? eq(usersTable.email, identifier.toLowerCase())
        : or(eq(usersTable.email, identifier.toLowerCase()), eq(usersTable.name, identifier))
    );

  if (!user) {
    res.status(401).json({ error: "Invalid email/name or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email/name or password" });
    return;
  }

  req.session.userId = user.id;
  req.log.info({ userId: user.id }, "User logged in");
  res.json(LoginResponse.parse({ id: user.id, email: user.email, name: user.name, walletBalance: user.walletBalance }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy(() => {});
  res.sendStatus(204);
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, email: usersTable.email, walletBalance: usersTable.walletBalance })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json(GetMeResponse.parse(user));
});

export default router;
