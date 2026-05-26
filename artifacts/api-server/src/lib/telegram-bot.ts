import { logger } from "./logger";
import { getSession, setSession, clearSession } from "./bot-state";
import { db, usersTable, submissionsTable, withdrawalsTable, settingsTable, broadcastsTable, pool } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { verifyGmailAccount } from "./verify-gmail";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function callApi(method: string, body: Record<string, unknown>): Promise<unknown> {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    logger.warn({ err, method }, "Telegram API call failed");
    return null;
  }
}

async function sendMessage(chatId: string, text: string, extra?: Record<string, unknown>): Promise<void> {
  if (!BOT_TOKEN) return;
  await callApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

// ── Keyboards ─────────────────────────────────────────────────────────────

function mainMenu(isLoggedIn: boolean): Record<string, unknown> {
  if (!isLoggedIn) {
    return {
      reply_markup: {
        keyboard: [[{ text: "📝 Register" }, { text: "🔑 Login" }]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };
  }
  return {
    reply_markup: {
      keyboard: [
        [{ text: "+ Register a new Gmail" }, { text: "📋 My accounts" }],
        [{ text: "💰 Balance" }, { text: "👥 My referrals" }],
        [{ text: "⚙️ Settings" }, { text: "💬 Help" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function adminMenu(): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: [
        [{ text: "⏳ Overview" }, { text: "📬 Submissions" }],
        [{ text: "💸 Withdrawals" }, { text: "👥 Users" }],
        [{ text: "📢 Broadcast" }, { text: "⚙️ Settings" }],
        [{ text: "✨ Email Pool" }, { text: "📤 Export" }],
        [{ text: "🚪 Go to User" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function cancelKeyboard(): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: [[{ text: "❌ Cancel" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function cancelRegistrationKeyboard(): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: [[{ text: "⊖ Cancel registration" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function registerChoiceKeyboard(): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: [
        [{ text: "📝 Submit my own" }, { text: "🔄 Generate new name" }],
        [{ text: "📋 Bulk submit" }],
        [{ text: "⊖ Cancel registration" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function getPricePerEmail(): Promise<number> {
  const [row] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "price_per_email"));
  return row ? parseInt(row.value, 10) : 20;
}

async function getCommissionPct(): Promise<number> {
  const [row] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "referral_commission_pct"));
  return row ? parseInt(row.value, 10) : 10;
}

function generateReferralCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

// ── Webhook setup ──────────────────────────────────────────────────────────

export async function setupWebhook(webhookUrl: string): Promise<void> {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN is not set — webhook setup skipped");
    return;
  }
  const result = await callApi("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  }) as { ok: boolean; description?: string } | null;

  if (result?.ok) {
    logger.info({ webhookUrl }, "Telegram webhook registered successfully");
  } else {
    logger.error({ webhookUrl, result }, "Failed to register Telegram webhook");
  }
  await callApi("setChatMenuButton", { menu_button: { type: "default" } });
  await callApi("setMyCommands", {
    commands: [
      { command: "start", description: "Open main menu" },
      { command: "help", description: "Help" },
      { command: "admin", description: "Admin panel" },
    ],
  });
}

// ── Update handler ─────────────────────────────────────────────────────────

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number; type: string; first_name?: string; username?: string };
    from?: { id: number; first_name: string; username?: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message?: { chat: { id: number } };
    data?: string;
  };
};

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (!BOT_TOKEN) return;

  if (update.callback_query) {
    await callApi("answerCallbackQuery", { callback_query_id: update.callback_query.id });
    return;
  }

  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  const text = (msg.text ?? "").trim();
  const session = getSession(chatId);

  // Global cancel / back
  if (text === "❌ Cancel" || text === "⊖ Cancel registration" || text === "⬅️ Back") {
    clearSession(chatId);
    if (session.isAdmin) {
      await sendMessage(chatId, "❌ Cancelled.", adminMenu());
    } else {
      await sendMessage(chatId, "Use the menu below:", mainMenu(!!session.userId));
    }
    return;
  }

  if (text === "/start") {
    clearSession(chatId);
    const firstName = msg.from?.first_name ?? "there";
    if (session.userId) {
      const [user] = await db.select({ name: usersTable.name, walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, session.userId));
      await sendMessage(chatId,
        `YOU CAN EARN FOR EACH GMAIL ACCOUNT YOU CREATE! ✅💰\n\n<b>STEP 1)</b> Register a new Gmail account using the credentials we provide.\n\n<b>STEP 2)</b> Submit the account here and get paid.\n\n👋 Welcome back, <b>${user?.name ?? firstName}</b>!\n💰 Wallet: <b>${user?.walletBalance ?? 0} ETB</b>`,
        mainMenu(true)
      );
    } else {
      await sendMessage(chatId,
        `YOU CAN EARN FOR EACH GMAIL ACCOUNT YOU CREATE! ✅💰\n\n<b>STEP 1)</b> Register a new Gmail account using the credentials we provide.\n\n<b>STEP 2)</b> Submit the account here and get paid.\n\n👋 Hello, <b>${firstName}</b>! Register or login to get started:`,
        mainMenu(false)
      );
    }
    return;
  }

  if (text === "/admin") {
    setSession(chatId, { step: "await_admin_password" });
    await sendMessage(chatId, "🔐 Enter admin password:", cancelKeyboard());
    return;
  }

  if (text === "/help") {
    await showHelp(chatId);
    return;
  }

  switch (session.step) {
    case "idle": await handleIdleMessage(chatId, text, session); break;
    case "await_register_name": await handleRegisterName(chatId, text); break;
    case "await_register_password": await handleRegisterPassword(chatId, text); break;
    case "await_register_confirm_password": await handleRegisterConfirmPassword(chatId, text); break;
    case "await_register_referral": await handleRegisterReferral(chatId, text); break;
    case "await_login_name": await handleLoginName(chatId, text); break;
    case "await_login_password": await handleLoginPassword(chatId, text); break;
    case "await_submit_email": await handleSubmitEmail(chatId, text); break;
    case "await_submit_password": await handleSubmitPassword(chatId, text); break;
    case "await_submit_recovery_email": await handleSubmitRecoveryEmail(chatId, text); break;
    case "await_bulk_submit": await handleBulkSubmit(chatId, text); break;
    case "await_withdraw_method": await handleWithdrawMethod(chatId, text); break;
    case "await_withdraw_amount": await handleWithdrawAmount(chatId, text); break;
    case "await_withdraw_telebirr_number": await handleWithdrawTelebirrNumber(chatId, text); break;
    case "await_withdraw_telebirr_name": await handleWithdrawTelebirrName(chatId, text); break;
    case "await_withdraw_bank_name": await handleWithdrawBankName(chatId, text); break;
    case "await_withdraw_bank_account_number": await handleWithdrawBankAccountNumber(chatId, text); break;
    case "await_withdraw_bank_account_name": await handleWithdrawBankAccountName(chatId, text); break;
    case "await_admin_password": await handleAdminPassword(chatId, text); break;
    case "admin_idle": await handleAdminMessage(chatId, text, session); break;
    case "await_admin_approve_id": await handleAdminApproveId(chatId, text); break;
    case "await_admin_reject_id": await handleAdminRejectId(chatId, text); break;
    case "await_admin_reject_note": await handleAdminRejectNote(chatId, text); break;
    case "await_admin_withdrawal_id": await handleAdminWithdrawalId(chatId, text); break;
    case "await_admin_withdrawal_action": await handleAdminWithdrawalAction(chatId, text); break;
    case "await_admin_ban_id": await handleAdminBanId(chatId, text); break;
    case "await_admin_broadcast_title": await handleAdminBroadcastTitle(chatId, text); break;
    case "await_admin_broadcast_message": await handleAdminBroadcastMessage(chatId, text); break;
    case "await_admin_settings_price": await handleAdminSettingsPrice(chatId, text); break;
    case "await_admin_settings_commission": await handleAdminSettingsCommission(chatId, text); break;
    case "await_admin_new_password": await handleAdminNewPassword(chatId, text); break;
    case "await_admin_email_pool": await handleAdminEmailPool(chatId, text); break;
    case "gen_email_confirm": await handleGenEmailConfirm(chatId, text, session.userId!); break;
    case "gen_email_view": await handleGenEmailAction(chatId, text, session.userId!); break;
    default:
      clearSession(chatId);
      await sendMessage(chatId, "You've been returned to the main menu. /start", mainMenu(!!session.userId));
  }
}

// ── Idle message router ────────────────────────────────────────────────────

async function handleIdleMessage(chatId: string, text: string, session: ReturnType<typeof getSession>): Promise<void> {
  if (!session.userId) {
    switch (text) {
      case "📝 Register":
        setSession(chatId, { step: "await_register_name" });
        await sendMessage(chatId, "📝 <b>Register</b>\n\nEnter a display name (e.g. Abel123):", cancelKeyboard());
        break;
      case "🔑 Login":
        setSession(chatId, { step: "await_login_name" });
        await sendMessage(chatId, "🔑 <b>Login</b>\n\nEnter your display name:", cancelKeyboard());
        break;
      default:
        await sendMessage(chatId, "👇 Register or login to get started:", mainMenu(false));
    }
    return;
  }

  switch (text) {
    // ── Main menu ──────────────────────────────────────────────────────────
    case "+ Register a new Gmail":
    case "+ Register new Gmail":
      await sendMessage(chatId,
        `Do you want us to generate a login and password for you or you already have an account?`,
        registerChoiceKeyboard()
      );
      break;

    case "📋 My accounts": await showMyAccounts(chatId, session.userId); break;
    case "💰 Balance":     await showBalance(chatId, session.userId);    break;
    case "👥 My referrals": await showReferral(chatId, session.userId);  break;
    case "⚙️ Settings":   await showSettings(chatId, session.userId);   break;
    case "💬 Help":        await showHelp(chatId);                       break;

    // ── Register choice ────────────────────────────────────────────────────
    case "📝 Submit my own":
      setSession(chatId, { step: "await_submit_email" });
      await sendMessage(chatId, "📋 Please enter your Gmail email address:", cancelRegistrationKeyboard());
      break;

    case "🔄 Generate new name":
      await handleGetEmailMenu(chatId, session.userId!);
      break;

    case "📋 Bulk submit":
      setSession(chatId, { step: "await_bulk_submit" });
      await sendMessage(chatId,
        `📋 <b>Bulk Submit</b>\n\nEnter Gmail accounts one per line:\n<code>email@gmail.com:password</code>\nor\n<code>email@gmail.com:password:recovery@email.com</code>\n\nSend your list now:`,
        cancelRegistrationKeyboard()
      );
      break;

    // ── My accounts sub-buttons ────────────────────────────────────────────
    case "🔄 Refresh":
      await showMyAccounts(chatId, session.userId);
      break;

    // ── Balance sub-buttons ────────────────────────────────────────────────
    case "💸 Withdraw":           await startWithdraw(chatId, session.userId);     break;
    case "📋 Withdrawal History": await showWithdrawals(chatId, session.userId);   break;

    // ── Settings sub-buttons ───────────────────────────────────────────────
    case "🚪 Logout":
      setSession(chatId, { step: "idle", userId: undefined, isAdmin: false });
      await sendMessage(chatId, "👋 You have been logged out. See you next time!", mainMenu(false));
      break;

    default:
      await sendMessage(chatId, "👇 Use the menu below:", mainMenu(true));
  }
}

// ── User views ─────────────────────────────────────────────────────────────

async function showBalance(chatId: string, userId: number): Promise<void> {
  const [user] = await db.select({
    name: usersTable.name, walletBalance: usersTable.walletBalance, commissionEarned: usersTable.commissionEarned,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { await sendMessage(chatId, "❌ Account not found.", mainMenu(false)); return; }

  await sendMessage(chatId,
    `💰 <b>Balance</b>\n\n👤 ${user.name}\n\n💵 Wallet: <b>${user.walletBalance} ETB</b>\n🏆 Commission earned: <b>${user.commissionEarned} ETB</b>`,
    {
      reply_markup: {
        keyboard: [[{ text: "💸 Withdraw" }, { text: "📋 Withdrawal History" }], [{ text: "⬅️ Back" }]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    }
  );
}

async function showMyAccounts(chatId: string, userId: number): Promise<void> {
  const rows = await db.select({
    email: submissionsTable.email, status: submissionsTable.status,
    pricePaid: submissionsTable.pricePaid, rejectionNote: submissionsTable.rejectionNote,
    createdAt: submissionsTable.createdAt,
  }).from(submissionsTable).where(eq(submissionsTable.userId, userId)).orderBy(desc(submissionsTable.createdAt)).limit(10);

  const total = rows.length;
  const paid    = rows.filter((r) => r.status === "approved").length;
  const pending  = rows.filter((r) => r.status === "pending").length;
  const declined = rows.filter((r) => r.status === "rejected").length;

  const icon: Record<string, string>  = { approved: "✅", pending: "🔄", rejected: "❌" };
  const label: Record<string, string> = { approved: "paid", pending: "processing", rejected: "declined" };

  const summary = total === 0
    ? "No accounts submitted yet."
    : `📊 Summary:\n✅ Paid: ${paid}  ⏳ Pending: ${pending}  ❌ Declined: ${declined}`;

  const lines = rows.map((r, i) => {
    const date = new Date(r.createdAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
    let entry = `${i + 1}. ${icon[r.status] ?? "❓"} Create account on GOOGLE\n💰 ${r.pricePaid} ETB | 📅 ${date} | ${label[r.status] ?? r.status}\n📧 <code>${r.email}</code>`;
    if (r.status === "rejected" && r.rejectionNote) entry += `\n   ↳ ${r.rejectionNote}`;
    return entry;
  });

  await sendMessage(chatId,
    `📋 <b>Your submitted accounts (${total}):</b>\n\n${summary}${lines.length ? `\n\n${lines.join("\n\n")}` : ""}`,
    {
      reply_markup: {
        keyboard: [[{ text: "🔄 Refresh" }, { text: "+ Register new Gmail" }], [{ text: "⬅️ Back" }]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    }
  );
}

async function showWithdrawals(chatId: string, userId: number): Promise<void> {
  const rows = await db.select({
    amount: withdrawalsTable.amount, paymentMethod: withdrawalsTable.paymentMethod,
    status: withdrawalsTable.status, adminNote: withdrawalsTable.adminNote,
  }).from(withdrawalsTable).where(eq(withdrawalsTable.userId, userId)).orderBy(desc(withdrawalsTable.createdAt)).limit(10);

  if (rows.length === 0) {
    await sendMessage(chatId, "💼 No withdrawal requests yet.",
      { reply_markup: { keyboard: [[{ text: "⬅️ Back" }]], resize_keyboard: true } });
    return;
  }

  const e: Record<string, string> = { pending: "⏳", completed: "✅", rejected: "❌" };
  const lines = rows.map((r) => {
    let line = `${e[r.status] ?? "❓"} <b>${r.amount} ETB</b> — ${r.paymentMethod === "telebirr" ? "Telebirr" : "Bank"}`;
    if (r.adminNote) line += `\n   ↳ ${r.adminNote}`;
    return line;
  });
  await sendMessage(chatId, `💼 <b>Withdrawal History</b> (last 10)\n\n${lines.join("\n\n")}`,
    { reply_markup: { keyboard: [[{ text: "⬅️ Back" }]], resize_keyboard: true } });
}

async function showReferral(chatId: string, userId: number): Promise<void> {
  const [user] = await db.select({ referralCode: usersTable.referralCode, commissionEarned: usersTable.commissionEarned }).from(usersTable).where(eq(usersTable.id, userId));
  const [refCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.referredBy, userId));
  const commissionPct = await getCommissionPct();
  await sendMessage(chatId,
    `👥 <b>My Referrals</b>\n\n📌 Your code: <code>${user?.referralCode}</code>\n\n👥 Friends invited: <b>${refCount?.count ?? 0}</b>\n💰 Commission earned: <b>${user?.commissionEarned ?? 0} ETB</b>\n\n📊 You earn <b>${commissionPct}%</b> commission on every approved submission from your referrals!`,
    { reply_markup: { keyboard: [[{ text: "⬅️ Back" }]], resize_keyboard: true } }
  );
}

async function showSettings(chatId: string, _userId: number): Promise<void> {
  await sendMessage(chatId,
    `⚙️ <b>Settings</b>\n\nManage your account settings below.`,
    {
      reply_markup: {
        keyboard: [[{ text: "🚪 Logout" }], [{ text: "⬅️ Back" }]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    }
  );
}

async function showHelp(chatId: string): Promise<void> {
  const rows = await db.select({ title: broadcastsTable.title, message: broadcastsTable.message })
    .from(broadcastsTable).orderBy(desc(broadcastsTable.createdAt)).limit(3);

  const announcementSection = rows.length
    ? `\n\n📢 <b>Latest Announcements</b>\n\n${rows.map((r) => `• <b>${r.title}</b>\n${r.message}`).join("\n\n")}`
    : "";

  await sendMessage(chatId,
    `💬 <b>Help</b>\n\n` +
    `+ <b>Register a new Gmail</b> — Submit a Gmail account and get paid\n` +
    `📋 <b>My accounts</b> — View your submission history\n` +
    `💰 <b>Balance</b> — Check your wallet and withdraw\n` +
    `👥 <b>My referrals</b> — Refer friends and earn commission\n\n` +
    `Technical support: @support${announcementSection}`,
    { reply_markup: { keyboard: [[{ text: "⬅️ Back" }]], resize_keyboard: true } }
  );
}

// ── Withdraw flow ──────────────────────────────────────────────────────────

async function startWithdraw(chatId: string, userId: number): Promise<void> {
  const [user] = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.walletBalance < 50) {
    await sendMessage(chatId, `💸 <b>Withdraw</b>\n\n💰 Your wallet: <b>${user?.walletBalance ?? 0} ETB</b>\n\n❌ You need at least <b>50 ETB</b> to withdraw.`,
      { reply_markup: { keyboard: [[{ text: "⬅️ Back" }]], resize_keyboard: true } });
    return;
  }
  setSession(chatId, { step: "await_withdraw_method" });
  await sendMessage(chatId, `💸 <b>Withdraw</b>\n\n💰 Your wallet: <b>${user.walletBalance} ETB</b>\n\nSelect payment method:`,
    { reply_markup: { keyboard: [[{ text: "📱 Telebirr" }, { text: "🏦 Bank" }], [{ text: "❌ Cancel" }]], resize_keyboard: true } }
  );
}

// ── Register flow ──────────────────────────────────────────────────────────

async function handleRegisterName(chatId: string, text: string): Promise<void> {
  const name = text.trim();
  if (name.length < 3 || name.length > 30) { await sendMessage(chatId, "❌ Name must be between 3 and 30 characters:"); return; }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.name, name));
  if (existing) { await sendMessage(chatId, "❌ That name is already taken. Try another one:"); return; }
  setSession(chatId, { step: "await_register_password", tempName: name });
  await sendMessage(chatId, `👤 Name: <b>${name}</b>\n\n🔐 Enter a password (at least 6 characters):`);
}

async function handleRegisterPassword(chatId: string, text: string): Promise<void> {
  if (text.length < 6) { await sendMessage(chatId, "❌ Password must be at least 6 characters:"); return; }
  setSession(chatId, { step: "await_register_confirm_password", tempPassword: text });
  await sendMessage(chatId, "🔐 Re-enter your password to confirm:");
}

async function handleRegisterConfirmPassword(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  if (text !== session.tempPassword) {
    setSession(chatId, { step: "await_register_password", tempPassword: undefined });
    await sendMessage(chatId, "❌ Passwords do not match. Enter your password again:");
    return;
  }
  setSession(chatId, { step: "await_register_referral" });
  await sendMessage(chatId, "🔗 Do you have a referral code? Enter it below, or tap <b>Skip</b>:",
    { reply_markup: { keyboard: [[{ text: "Skip" }], [{ text: "❌ Cancel" }]], resize_keyboard: true } }
  );
}

async function handleRegisterReferral(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  let referrerId: number | undefined;
  if (text !== "Skip") {
    const code = text.trim().toUpperCase();
    const [referrer] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, code));
    if (!referrer) { await sendMessage(chatId, "❌ Referral code not found. Tap Skip or enter a valid code:"); return; }
    referrerId = referrer.id;
  }

  const passwordHash = await bcrypt.hash(session.tempPassword!, 10);
  let newCode = generateReferralCode();
  for (let i = 0; i < 5; i++) {
    const [c] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, newCode));
    if (!c) break;
    newCode = generateReferralCode();
  }

  try {
    const [user] = await db.insert(usersTable).values({
      name: session.tempName!, passwordHash, referralCode: newCode,
      referredBy: referrerId, telegramChatId: chatId,
    }).returning({ id: usersTable.id, name: usersTable.name });

    setSession(chatId, { step: "idle", userId: user.id, tempName: undefined, tempPassword: undefined, isAdmin: false });
    await sendMessage(chatId,
      `✅ <b>Registration successful!</b>\n\n👤 Name: <b>${user.name}</b>\n🔗 Referral Code: <code>${newCode}</code>\n\nTap <b>+ Register a new Gmail</b> to submit your first account!`,
      mainMenu(true)
    );
  } catch {
    clearSession(chatId);
    await sendMessage(chatId, "❌ Registration failed. Please try again. /start", mainMenu(false));
  }
}

// ── Login flow ─────────────────────────────────────────────────────────────

async function handleLoginName(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_login_password", tempName: text.trim() });
  await sendMessage(chatId, "🔐 Enter your password:");
}

async function handleLoginPassword(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const [user] = await db.select({
    id: usersTable.id, name: usersTable.name, passwordHash: usersTable.passwordHash,
    isBanned: usersTable.isBanned, walletBalance: usersTable.walletBalance,
  }).from(usersTable).where(eq(usersTable.name, session.tempName!));

  if (!user) {
    setSession(chatId, { step: "await_login_name", tempName: undefined });
    await sendMessage(chatId, "❌ Name not found. Try again:", cancelKeyboard());
    return;
  }
  if (user.isBanned) { clearSession(chatId); await sendMessage(chatId, "⛔ Your account has been banned.", mainMenu(false)); return; }

  const valid = await bcrypt.compare(text, user.passwordHash);
  if (!valid) { await sendMessage(chatId, "❌ Incorrect password. Try again:"); return; }

  await db.update(usersTable).set({ telegramChatId: chatId }).where(eq(usersTable.id, user.id));
  setSession(chatId, { step: "idle", userId: user.id, tempName: undefined, isAdmin: false });
  await sendMessage(chatId, `✅ <b>Logged in!</b>\n\n👤 <b>${user.name}</b>\n💰 Wallet: <b>${user.walletBalance} ETB</b>`, mainMenu(true));
}

// ── Submit own email flow ──────────────────────────────────────────────────

async function handleSubmitEmail(chatId: string, text: string): Promise<void> {
  const email = text.trim().toLowerCase();
  if (!email.endsWith("@gmail.com")) {
    await sendMessage(chatId, "❌ Please enter a valid Gmail address (@gmail.com only):", cancelRegistrationKeyboard());
    return;
  }
  const [existing] = await db.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.email, email));
  if (existing) {
    await sendMessage(chatId, "❌ This email has already been submitted. Try another one:", cancelRegistrationKeyboard());
    return;
  }
  setSession(chatId, { step: "await_submit_password", tempEmail: email });
  await sendMessage(chatId, `🔒 Please enter your password:`, cancelRegistrationKeyboard());
}

async function handleSubmitPassword(chatId: string, text: string): Promise<void> {
  const password = text.trim();
  if (password.length < 6) {
    await sendMessage(chatId, "❌ Password must be at least 6 characters:", cancelRegistrationKeyboard());
    return;
  }
  setSession(chatId, { step: "await_submit_recovery_email", tempPassword: password });
  await sendMessage(chatId,
    `📋 Please enter your recovery email address:\n<i>(or type <b>Skip</b> to skip)</i>`,
    { reply_markup: { keyboard: [[{ text: "Skip" }], [{ text: "⊖ Cancel registration" }]], resize_keyboard: true } }
  );
}

async function handleSubmitRecoveryEmail(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const email = session.tempEmail!;
  const password = session.tempPassword!;
  const recoveryEmail = text === "Skip" ? null : text.trim().toLowerCase();

  if (recoveryEmail !== null && !recoveryEmail.includes("@")) {
    await sendMessage(chatId, "❌ Please enter a valid email address or tap Skip:",
      { reply_markup: { keyboard: [[{ text: "Skip" }], [{ text: "⊖ Cancel registration" }]], resize_keyboard: true } });
    return;
  }

  await sendMessage(chatId, `🔍 Checking if credentials are unique...`);

  // Re-check uniqueness
  const [existing] = await db.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.email, email));
  if (existing) {
    clearSession(chatId);
    await sendMessage(chatId, "❌ This email has already been submitted by someone else.", mainMenu(true));
    return;
  }

  // IMAP verification
  const verifyResult = await verifyGmailAccount(email, password);
  if (verifyResult.verified === false && verifyResult.reason === "not_registered") {
    clearSession(chatId);
    await sendMessage(chatId,
      `❌ <b>Gmail account not found!</b>\n\n📧 <code>${email}</code>\n\n⚠️ This email does not exist on Gmail or the password is incorrect.\n\n👉 Please create the Gmail account first, then submit again.`,
      mainMenu(true)
    );
    return;
  }
  if (verifyResult.verified === false && verifyResult.reason === "network_error") {
    logger.warn({ chatId, email }, "Gmail IMAP network error in bot — allowing");
  }

  const price = await getPricePerEmail();
  const [row] = await db.insert(submissionsTable).values({
    userId: session.userId!, email, password,
    recoveryEmail: recoveryEmail ?? undefined,
    status: "pending", pricePaid: price,
  }).returning({ id: submissionsTable.id, email: submissionsTable.email, pricePaid: submissionsTable.pricePaid });

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, session.userId!));
  notifyAdminNewSubmission({
    submissionId: row.id, submittedEmail: row.email, submittedPassword: password,
    userId: session.userId!, userName: user?.name ?? null, userEmail: null, pricePaid: row.pricePaid,
  }).catch(() => {});

  clearSession(chatId);
  await sendMessage(chatId,
    `✅ <b>Submission received!</b>\n\n📧 Email: <code>${row.email}</code>\n💰 Price: <b>${row.pricePaid} ETB</b> (added once approved)\n\n⏳ You will be notified once it is reviewed!`,
    mainMenu(true)
  );
}

// ── Bulk submit flow ───────────────────────────────────────────────────────

async function handleBulkSubmit(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const lines = text.trim().split("\n").filter(Boolean);

  const parsed: { email: string; password: string; recovery: string | null }[] = [];
  for (const line of lines) {
    const parts = line.split(":").map((p) => p.trim());
    if (parts.length >= 2 && parts[0].includes("@gmail.com")) {
      parsed.push({ email: parts[0].toLowerCase(), password: parts[1], recovery: parts[2] ?? null });
    }
  }

  if (parsed.length === 0) {
    await sendMessage(chatId,
      `❌ No valid entries found.\n\nFormat:\n<code>email@gmail.com:password</code>\nor\n<code>email@gmail.com:password:recovery@email.com</code>`,
      cancelRegistrationKeyboard()
    );
    return;
  }

  await sendMessage(chatId, `🔍 Processing ${parsed.length} email(s)...`);

  const price = await getPricePerEmail();
  let added = 0;
  let skipped = 0;

  for (const entry of parsed) {
    try {
      const [existing] = await db.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.email, entry.email));
      if (existing) { skipped++; continue; }

      const [row] = await db.insert(submissionsTable).values({
        userId: session.userId!, email: entry.email, password: entry.password,
        recoveryEmail: entry.recovery ?? undefined,
        status: "pending", pricePaid: price,
      }).returning({ id: submissionsTable.id, email: submissionsTable.email, pricePaid: submissionsTable.pricePaid });

      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, session.userId!));
      notifyAdminNewSubmission({
        submissionId: row.id, submittedEmail: row.email, submittedPassword: entry.password,
        userId: session.userId!, userName: user?.name ?? null, userEmail: null, pricePaid: price,
      }).catch(() => {});

      added++;
    } catch {
      skipped++;
    }
  }

  clearSession(chatId);
  await sendMessage(chatId,
    `✅ <b>Bulk submit done!</b>\n\n✅ Submitted: <b>${added}</b>\n❌ Skipped (duplicates/errors): <b>${skipped}</b>\n\n💰 Each approved account will add <b>${price} ETB</b> to your wallet.`,
    mainMenu(true)
  );
}

// ── Generated Email flow ───────────────────────────────────────────────────

function genEmailClaimedKeyboard(emailOpened: boolean): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: emailOpened
        ? [[{ text: "📤 Submit" }], [{ text: "↩️ Return Email" }, { text: "⊖ Cancel registration" }]]
        : [[{ text: "📧 I Opened Gmail" }], [{ text: "↩️ Return Email" }, { text: "⊖ Cancel registration" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function genEmailConfirmKeyboard(): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: [[{ text: "✅ Take it" }, { text: "⊖ Cancel registration" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

type GenEmailRow = {
  id: number; name: string | null; email: string;
  password: string; status: string; email_opened: boolean;
};

async function getClaimedEmail(userId: number): Promise<GenEmailRow | null> {
  const { rows } = await pool.query(
    `SELECT id, name, email, password, status, email_opened FROM generated_emails
     WHERE claimed_by = $1 AND status = 'claimed' LIMIT 1`,
    [userId]
  );
  return (rows[0] as GenEmailRow) ?? null;
}

function buildClaimedEmailMessage(row: GenEmailRow): string {
  const nameLine = row.name ? `\nFirst name: <code>${row.name}</code>` : "";
  const openedStatus = row.email_opened
    ? "✅ Gmail opened — you can now submit!"
    : "🔒 Be sure to use the specified data, otherwise the account will not be paid.";
  return (
    `Register a Gmail account using the specified data and get paid!\n\n` +
    `${nameLine}\n` +
    `Email: <code>${row.email}</code>\n` +
    `Password: <code>${row.password}</code>\n\n` +
    `${openedStatus}\n\n` +
    `<b>Steps:</b>\n` +
    `1️⃣ Copy the email and password above\n` +
    `2️⃣ Go to accounts.google.com → Create account\n` +
    `3️⃣ After signing up, tap <b>"📧 I Opened Gmail"</b>\n` +
    `4️⃣ Tap <b>"📤 Submit"</b>`
  );
}

async function handleGetEmailMenu(chatId: string, userId: number): Promise<void> {
  const existing = await getClaimedEmail(userId);
  if (existing) {
    setSession(chatId, { step: "gen_email_view" });
    await sendMessage(chatId, buildClaimedEmailMessage(existing), genEmailClaimedKeyboard(existing.email_opened));
    return;
  }

  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM generated_emails WHERE status = 'available'"
  );
  const count = (rows[0] as { count: number }).count;

  if (count === 0) {
    await sendMessage(chatId, `😔 <b>No emails available right now.</b>\n\nPlease check back later.`, mainMenu(true));
    return;
  }

  setSession(chatId, { step: "gen_email_confirm" });
  await sendMessage(chatId,
    `✨ <b>Generate new name</b>\n\n📦 Available: <b>${count}</b>\n\n⚠️ <b>Warning — please read before continuing!</b>\n\n• You must complete a <b>real Gmail sign-up</b> with the assigned credentials\n• Submitting without opening Gmail will get your <b>account banned!</b>\n\nTap <b>"✅ Take it"</b> to claim your credentials.`,
    genEmailConfirmKeyboard()
  );
}

async function handleGenEmailConfirm(chatId: string, text: string, userId: number): Promise<void> {
  if (text !== "✅ Take it") {
    clearSession(chatId);
    await sendMessage(chatId, "Use the menu below:", mainMenu(true));
    return;
  }

  const existing = await getClaimedEmail(userId);
  if (existing) {
    setSession(chatId, { step: "gen_email_view" });
    await sendMessage(chatId, buildClaimedEmailMessage(existing), genEmailClaimedKeyboard(existing.email_opened));
    return;
  }

  const { rows } = await pool.query(
    `UPDATE generated_emails
     SET status = 'claimed', claimed_by = $1, claimed_at = NOW()
     WHERE id = (
       SELECT id FROM generated_emails WHERE status = 'available'
       ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
     )
     RETURNING id, name, email, password, status, email_opened`,
    [userId]
  );

  if (rows.length === 0) {
    clearSession(chatId);
    await sendMessage(chatId, "😔 <b>No email available.</b> Someone else just took it — please try again.", mainMenu(true));
    return;
  }

  const row = rows[0] as GenEmailRow;
  setSession(chatId, { step: "gen_email_view" });
  await sendMessage(chatId, `Wait a moment...\n\n${buildClaimedEmailMessage(row)}`, genEmailClaimedKeyboard(row.email_opened));
}

async function handleGenEmailAction(chatId: string, text: string, userId: number): Promise<void> {
  const row = await getClaimedEmail(userId);
  if (!row) {
    clearSession(chatId);
    await sendMessage(chatId, "⚠️ Email not found. Please try again.", mainMenu(true));
    return;
  }

  if (text === "📧 I Opened Gmail") {
    await pool.query(
      "UPDATE generated_emails SET email_opened = TRUE WHERE id = $1 AND claimed_by = $2",
      [row.id, userId]
    );
    await sendMessage(chatId,
      `✅ <b>Confirmed!</b>\n\nEmail: <code>${row.email}</code>\nPassword: <code>${row.password}</code>\n\n✅ Gmail opened — now tap <b>"📤 Submit"</b>!`,
      genEmailClaimedKeyboard(true)
    );
    return;
  }

  if (text === "↩️ Return Email") {
    await pool.query(
      `UPDATE generated_emails SET status = 'available', claimed_by = NULL,
       claimed_at = NULL, email_opened = FALSE WHERE id = $1 AND claimed_by = $2`,
      [row.id, userId]
    );
    clearSession(chatId);
    await sendMessage(chatId, "↩️ Email returned successfully.", mainMenu(true));
    return;
  }

  if (text === "📤 Submit") {
    if (!row.email_opened) {
      await sendMessage(chatId,
        `⚠️ <b>You must open Gmail first!</b>\n\nTap <b>"📧 I Opened Gmail"</b> after signing up, then submit.`,
        genEmailClaimedKeyboard(false)
      );
      return;
    }

    await sendMessage(chatId, `🔍 Checking if credentials are unique...`);

    const verifyResult = await verifyGmailAccount(row.email.toLowerCase(), row.password);

    if (verifyResult.verified === false && verifyResult.reason === "not_registered") {
      await sendMessage(chatId,
        `❌ <b>Gmail account not found!</b>\n\n📧 <code>${row.email}</code>\n\nThis email was not registered on Gmail or the password is incorrect.\n\n👉 Complete the Gmail sign-up, then tap <b>"📧 I Opened Gmail"</b> and try submitting again.`,
        genEmailClaimedKeyboard(false)
      );
      await pool.query("UPDATE generated_emails SET email_opened = FALSE WHERE id = $1", [row.id]);
      return;
    }

    if (verifyResult.verified === false && verifyResult.reason === "network_error") {
      logger.warn({ chatId, emailId: row.id }, "Gmail IMAP network error in gen_email bot flow — allowing");
    }

    const { rows: existingSub } = await pool.query("SELECT id FROM submissions WHERE email = $1", [row.email.toLowerCase()]);
    if (existingSub.length > 0) {
      await pool.query("UPDATE generated_emails SET status = 'submitted' WHERE id = $1", [row.id]);
      clearSession(chatId);
      await sendMessage(chatId, "⚠️ This email has already been submitted.", mainMenu(true));
      return;
    }

    const price = await getPricePerEmail();
    const { rows: subRows } = await pool.query(
      `INSERT INTO submissions (user_id, email, password, status, price_paid)
       VALUES ($1, $2, $3, 'pending', $4)
       RETURNING id, email, price_paid`,
      [userId, row.email.toLowerCase(), row.password, price]
    );
    await pool.query("UPDATE generated_emails SET status = 'submitted' WHERE id = $1", [row.id]);

    const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    notifyAdminNewSubmission({
      submissionId: subRows[0].id, submittedEmail: subRows[0].email,
      submittedPassword: row.password, userId,
      userName: user?.name ?? null, userEmail: null, pricePaid: price,
    }).catch(() => {});

    clearSession(chatId);
    await sendMessage(chatId,
      `✅ <b>Submission received!</b>\n\n📧 <code>${subRows[0].email}</code>\n💰 Price: <b>${price} ETB</b> (added once approved)\n\n⏳ You will be notified once it is reviewed!`,
      mainMenu(true)
    );
    return;
  }

  await sendMessage(chatId, buildClaimedEmailMessage(row), genEmailClaimedKeyboard(row.email_opened));
}

// ── Withdraw flow ──────────────────────────────────────────────────────────

async function handleWithdrawMethod(chatId: string, text: string): Promise<void> {
  if (text === "📱 Telebirr") {
    setSession(chatId, { step: "await_withdraw_amount", tempWithdrawMethod: "telebirr" });
    await sendMessage(chatId, "💸 How much ETB would you like to withdraw? (Minimum 50 ETB):", cancelKeyboard());
  } else if (text === "🏦 Bank") {
    setSession(chatId, { step: "await_withdraw_amount", tempWithdrawMethod: "bank" });
    await sendMessage(chatId, "💸 How much ETB would you like to withdraw? (Minimum 50 ETB):", cancelKeyboard());
  } else {
    await sendMessage(chatId, "Please select 📱 Telebirr or 🏦 Bank:");
  }
}

async function handleWithdrawAmount(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const amount = parseInt(text, 10);
  if (isNaN(amount) || amount < 50) { await sendMessage(chatId, "❌ Please enter at least 50 ETB:"); return; }
  const [user] = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, session.userId!));
  if (!user || user.walletBalance < amount) {
    clearSession(chatId);
    await sendMessage(chatId, `❌ Insufficient balance. Your wallet: <b>${user?.walletBalance ?? 0} ETB</b>`, mainMenu(true));
    return;
  }
  setSession(chatId, { tempWithdrawAmount: amount });
  if (session.tempWithdrawMethod === "telebirr") {
    setSession(chatId, { step: "await_withdraw_telebirr_number" });
    await sendMessage(chatId, "📱 Enter your Telebirr phone number (e.g. 0912345678):");
  } else {
    setSession(chatId, { step: "await_withdraw_bank_name" });
    await sendMessage(chatId, "🏦 Enter your bank name (e.g. CBE, Awash, Abyssinia):");
  }
}

async function handleWithdrawTelebirrNumber(chatId: string, text: string): Promise<void> {
  const num = text.trim().replace(/\s/g, "");
  if (!/^0[79]\d{8}$/.test(num) && !/^\+2519\d{8}$/.test(num)) {
    await sendMessage(chatId, "❌ Please enter a valid phone number (e.g. 0912345678):"); return;
  }
  setSession(chatId, { step: "await_withdraw_telebirr_name", tempWithdrawTelebirrNumber: num });
  await sendMessage(chatId, "👤 Enter your full name (as registered on Telebirr):");
}

async function handleWithdrawTelebirrName(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  if (text.trim().length < 2) { await sendMessage(chatId, "❌ Please enter a valid name:"); return; }
  await finalizeWithdrawal(chatId, {
    userId: session.userId!, amount: session.tempWithdrawAmount!, paymentMethod: "telebirr",
    telebirrNumber: session.tempWithdrawTelebirrNumber!, telebirrName: text.trim(),
  });
}

async function handleWithdrawBankName(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_withdraw_bank_account_number", tempWithdrawBankName: text.trim() });
  await sendMessage(chatId, "💳 Enter your bank account number:");
}

async function handleWithdrawBankAccountNumber(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_withdraw_bank_account_name", tempWithdrawBankAccountNumber: text.trim() });
  await sendMessage(chatId, "👤 Enter your full name (as registered at the bank):");
}

async function handleWithdrawBankAccountName(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  if (text.trim().length < 2) { await sendMessage(chatId, "❌ Please enter a valid name:"); return; }
  await finalizeWithdrawal(chatId, {
    userId: session.userId!, amount: session.tempWithdrawAmount!, paymentMethod: "bank",
    bankName: session.tempWithdrawBankName, bankAccountNumber: session.tempWithdrawBankAccountNumber,
    bankAccountName: text.trim(),
  });
}

async function finalizeWithdrawal(chatId: string, data: {
  userId: number; amount: number; paymentMethod: "telebirr" | "bank";
  telebirrNumber?: string; telebirrName?: string;
  bankName?: string; bankAccountNumber?: string; bankAccountName?: string;
}): Promise<void> {
  const [user] = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, data.userId));
  if (!user || user.walletBalance < data.amount) {
    clearSession(chatId); await sendMessage(chatId, `❌ Insufficient balance.`, mainMenu(true)); return;
  }
  await db.update(usersTable).set({ walletBalance: user.walletBalance - data.amount }).where(eq(usersTable.id, data.userId));
  await db.insert(withdrawalsTable).values({
    userId: data.userId, amount: data.amount, paymentMethod: data.paymentMethod,
    telebirrNumber: data.telebirrNumber ?? "", telebirrName: data.telebirrName ?? "",
    bankName: data.bankName, bankAccountNumber: data.bankAccountNumber,
    bankAccountName: data.bankAccountName, status: "pending",
  });
  clearSession(chatId);
  const payInfo = data.paymentMethod === "telebirr"
    ? `📱 Telebirr: <code>${data.telebirrNumber}</code>`
    : `🏦 Bank: ${data.bankName} — <code>${data.bankAccountNumber}</code>`;
  await sendMessage(chatId,
    `✅ <b>Withdrawal request submitted!</b>\n\n💰 Amount: <b>${data.amount} ETB</b>\n${payInfo}\n\n⏳ You will be notified once the admin processes it!`,
    mainMenu(true)
  );
}

// ── Admin: login ───────────────────────────────────────────────────────────

async function handleAdminPassword(chatId: string, text: string): Promise<void> {
  const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mailtrade@admin2024";
  const [row] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "admin_password_hash"));
  const valid = row ? await bcrypt.compare(text, row.value) : text === DEFAULT_ADMIN_PASSWORD;
  if (!valid) {
    clearSession(chatId);
    const s = getSession(chatId);
    await sendMessage(chatId, "❌ Incorrect password.", mainMenu(!!s.userId));
    return;
  }
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `🔐 <b>Admin Panel</b>\n\nWelcome!`, adminMenu());
}

// ── Admin: message router ──────────────────────────────────────────────────

async function handleAdminMessage(chatId: string, text: string, session: ReturnType<typeof getSession>): Promise<void> {
  switch (text) {
    case "⏳ Overview": await showAdminStats(chatId); break;
    case "📬 Submissions": await showAdminSubmissions(chatId); break;
    case "✅ Approve":
      setSession(chatId, { step: "await_admin_approve_id" });
      await sendMessage(chatId, "✅ Enter the submission ID to approve:", cancelKeyboard()); break;
    case "❌ Reject":
      setSession(chatId, { step: "await_admin_reject_id" });
      await sendMessage(chatId, "❌ Enter the submission ID to reject:", cancelKeyboard()); break;
    case "💸 Withdrawals": await showAdminWithdrawals(chatId); break;
    case "💳 Manage Withdrawal":
      setSession(chatId, { step: "await_admin_withdrawal_id" });
      await sendMessage(chatId, "💳 Enter withdrawal ID:", cancelKeyboard()); break;
    case "👥 Users": await showAdminUsers(chatId); break;
    case "🚫 Ban/Unban User":
      setSession(chatId, { step: "await_admin_ban_id" });
      await sendMessage(chatId, "🚫 Enter the user ID to ban or unban:", cancelKeyboard()); break;
    case "📢 Broadcast":
      setSession(chatId, { step: "await_admin_broadcast_title" });
      await sendMessage(chatId, "📢 Enter the broadcast title:", cancelKeyboard()); break;
    case "⚙️ Settings": await showAdminSettings(chatId); break;
    case "💰 Change Price":
      setSession(chatId, { step: "await_admin_settings_price" });
      await sendMessage(chatId, "💰 Enter the new price in ETB:", cancelKeyboard()); break;
    case "📊 Change Commission":
      setSession(chatId, { step: "await_admin_settings_commission" });
      await sendMessage(chatId, "📊 Enter the new referral commission % (e.g. 10):", cancelKeyboard()); break;
    case "🔑 Change Password":
      setSession(chatId, { step: "await_admin_new_password" });
      await sendMessage(chatId, "🔑 Enter the new admin password (at least 8 characters):", cancelKeyboard()); break;
    case "✨ Email Pool": await showAdminEmailPool(chatId); break;
    case "📤 Export": await showAdminExport(chatId); break;
    case "📋 All Submissions": await exportData(chatId, "submissions"); break;
    case "✅ Approved Submissions": await exportData(chatId, "approved-submissions"); break;
    case "💸 Export Withdrawals": await exportData(chatId, "withdrawals"); break;
    case "👥 Export Users": await exportData(chatId, "users"); break;
    case "🚪 Go to User":
      setSession(chatId, { step: "idle", isAdmin: false });
      await sendMessage(chatId, "👤 Switched to user mode.", mainMenu(!!session.userId)); break;
    case "🚪 Back to Menu":
      setSession(chatId, { step: "admin_idle", isAdmin: true });
      await sendMessage(chatId, "🔐 Admin Panel:", adminMenu()); break;
    default:
      await sendMessage(chatId, "Use the menu below:", adminMenu());
  }
}

// ── Admin: stats ───────────────────────────────────────────────────────────

async function showAdminStats(chatId: string): Promise<void> {
  const [userCount] = await db.select({
    count: sql<number>`count(*)::int`,
    botUsers: sql<number>`count(*) filter (where ${usersTable.telegramChatId} is not null)::int`,
  }).from(usersTable);
  const [subStats] = await db.select({
    total: sql<number>`count(*)::int`,
    pending: sql<number>`count(*) filter (where ${submissionsTable.status} = 'pending')::int`,
    approved: sql<number>`count(*) filter (where ${submissionsTable.status} = 'approved')::int`,
    totalPayout: sql<number>`coalesce(sum(${submissionsTable.pricePaid}) filter (where ${submissionsTable.status} = 'approved'), 0)::int`,
  }).from(submissionsTable);
  const [wdStats] = await db.select({ pending: sql<number>`count(*) filter (where ${withdrawalsTable.status} = 'pending')::int` }).from(withdrawalsTable);

  await sendMessage(chatId,
    `⏳ <b>Overview</b>\n\n👥 Users: <b>${userCount.count}</b> (${userCount.botUsers} via bot)\n\n📬 Submissions:\n• Total: ${subStats.total}\n• ⏳ Pending: ${subStats.pending}\n• ✅ Approved: ${subStats.approved}\n• 💰 Total Paid: ${subStats.totalPayout} ETB\n\n💸 ⏳ Pending Withdrawals: <b>${wdStats.pending}</b>`,
    adminMenu()
  );
}

// ── Admin: submissions ─────────────────────────────────────────────────────

async function showAdminSubmissions(chatId: string): Promise<void> {
  const rows = await db.select({
    id: submissionsTable.id, userName: usersTable.name,
    email: submissionsTable.email, password: submissionsTable.password,
    status: submissionsTable.status, pricePaid: submissionsTable.pricePaid,
  }).from(submissionsTable).leftJoin(usersTable, eq(submissionsTable.userId, usersTable.id))
    .where(eq(submissionsTable.status, "pending")).orderBy(submissionsTable.createdAt).limit(10);

  if (rows.length === 0) { await sendMessage(chatId, "✅ No pending submissions!", adminMenu()); return; }

  const lines = rows.map((r) =>
    `🆔 <b>#${r.id}</b> | 👤 ${r.userName ?? "?"}\n📧 <code>${r.email}</code>\n🔑 <code>${r.password}</code>\n💰 ${r.pricePaid} ETB`
  );
  await sendMessage(chatId,
    `📬 <b>Pending Submissions (${rows.length})</b>\n\n${lines.join("\n\n─────────────────\n\n")}`,
    { reply_markup: { keyboard: [[{ text: "✅ Approve" }, { text: "❌ Reject" }], [{ text: "📬 Submissions" }, { text: "🚪 Back to Menu" }]], resize_keyboard: true } }
  );
}

async function handleAdminApproveId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ Please enter a valid ID:"); return; }
  const [existing] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!existing) { await sendMessage(chatId, `❌ Submission #${id} not found:`); return; }
  if (existing.status === "approved") {
    setSession(chatId, { step: "admin_idle", isAdmin: true });
    await sendMessage(chatId, `ℹ️ Submission #${id} is already approved.`, adminMenu()); return;
  }
  const [owner] = await db.select({ telegramChatId: usersTable.telegramChatId, referredBy: usersTable.referredBy }).from(usersTable).where(eq(usersTable.id, existing.userId));
  await db.update(usersTable).set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.pricePaid}` }).where(eq(usersTable.id, existing.userId));
  if (owner?.referredBy) {
    const pct = await getCommissionPct();
    const commission = Math.floor(existing.pricePaid * pct / 100);
    if (commission > 0) {
      await db.update(usersTable).set({
        walletBalance: sql`${usersTable.walletBalance} + ${commission}`,
        commissionEarned: sql`${usersTable.commissionEarned} + ${commission}`,
      }).where(eq(usersTable.id, owner.referredBy));
    }
  }
  await db.update(submissionsTable).set({ status: "approved", rejectionNote: null }).where(eq(submissionsTable.id, id));
  notifySubmissionApproved(owner?.telegramChatId, existing.email, existing.pricePaid).catch(() => {});
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `✅ Submission #${id} approved! <b>${existing.pricePaid} ETB</b> added to the user's wallet.`, adminMenu());
}

async function handleAdminRejectId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ Please enter a valid ID:"); return; }
  const [existing] = await db.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!existing) { await sendMessage(chatId, `❌ Submission #${id} not found:`); return; }
  setSession(chatId, { step: "await_admin_reject_note", tempRejectId: id });
  await sendMessage(chatId, `❌ Why are you rejecting submission #${id}?\n(Enter a reason or tap <b>Skip</b>)`,
    { reply_markup: { keyboard: [[{ text: "Skip" }], [{ text: "❌ Cancel" }]], resize_keyboard: true } }
  );
}

async function handleAdminRejectNote(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const id = session.tempRejectId!;
  const note = text === "Skip" ? null : text.trim();
  const [existing] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!existing) { setSession(chatId, { step: "admin_idle", isAdmin: true }); await sendMessage(chatId, "❌ Not found.", adminMenu()); return; }
  const [owner] = await db.select({ telegramChatId: usersTable.telegramChatId }).from(usersTable).where(eq(usersTable.id, existing.userId));
  if (existing.status === "approved") {
    await db.update(usersTable).set({ walletBalance: sql`${usersTable.walletBalance} - ${existing.pricePaid}` }).where(eq(usersTable.id, existing.userId));
  }
  await db.execute(sql`UPDATE generated_emails SET status = 'available', claimed_by = NULL, claimed_at = NULL, email_opened = FALSE WHERE lower(email) = lower(${existing.email}) AND status = 'submitted'`);
  await db.update(submissionsTable).set({ status: "rejected", rejectionNote: note }).where(eq(submissionsTable.id, id));
  notifySubmissionRejected(owner?.telegramChatId, existing.email).catch(() => {});
  setSession(chatId, { step: "admin_idle", isAdmin: true, tempRejectId: undefined });
  await sendMessage(chatId, `❌ Submission #${id} rejected${note ? `: ${note}` : "."}`, adminMenu());
}

// ── Admin: withdrawals ─────────────────────────────────────────────────────

async function showAdminWithdrawals(chatId: string): Promise<void> {
  const rows = await db.select({
    id: withdrawalsTable.id, userName: usersTable.name, amount: withdrawalsTable.amount,
    paymentMethod: withdrawalsTable.paymentMethod, telebirrNumber: withdrawalsTable.telebirrNumber,
    telebirrName: withdrawalsTable.telebirrName, bankName: withdrawalsTable.bankName,
    bankAccountNumber: withdrawalsTable.bankAccountNumber, bankAccountName: withdrawalsTable.bankAccountName,
    status: withdrawalsTable.status,
  }).from(withdrawalsTable).leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(eq(withdrawalsTable.status, "pending")).orderBy(withdrawalsTable.createdAt).limit(10);

  if (rows.length === 0) { await sendMessage(chatId, "✅ No pending withdrawals!", adminMenu()); return; }

  const lines = rows.map((r) => {
    const payInfo = r.paymentMethod === "telebirr"
      ? `📱 Telebirr: <code>${r.telebirrNumber}</code> (${r.telebirrName})`
      : `🏦 ${r.bankName}: <code>${r.bankAccountNumber}</code> (${r.bankAccountName})`;
    return `🆔 <b>#${r.id}</b> | 👤 ${r.userName ?? "?"}\n💰 ${r.amount} ETB\n${payInfo}`;
  });
  await sendMessage(chatId,
    `💸 <b>Pending Withdrawals (${rows.length})</b>\n\n${lines.join("\n\n─────────────────\n\n")}`,
    { reply_markup: { keyboard: [[{ text: "💳 Manage Withdrawal" }, { text: "💸 Withdrawals" }], [{ text: "🚪 Back to Menu" }]], resize_keyboard: true } }
  );
}

async function handleAdminWithdrawalId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ Please enter a valid ID:"); return; }
  const [existing] = await db.select({ id: withdrawalsTable.id, amount: withdrawalsTable.amount, status: withdrawalsTable.status }).from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!existing) { await sendMessage(chatId, `❌ Withdrawal #${id} not found:`); return; }
  setSession(chatId, { step: "await_admin_withdrawal_action", tempWithdrawalId: id });
  await sendMessage(chatId, `💳 Withdrawal #${id} — <b>${existing.amount} ETB</b> (${existing.status})\n\nWhat would you like to do?`,
    { reply_markup: { keyboard: [[{ text: "✅ Complete" }, { text: "❌ Reject" }], [{ text: "❌ Cancel" }]], resize_keyboard: true } }
  );
}

async function handleAdminWithdrawalAction(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const id = session.tempWithdrawalId!;
  const [existing] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!existing) { setSession(chatId, { step: "admin_idle", isAdmin: true }); await sendMessage(chatId, "❌ Not found.", adminMenu()); return; }
  const [owner] = await db.select({ telegramChatId: usersTable.telegramChatId }).from(usersTable).where(eq(usersTable.id, existing.userId));

  if (text === "✅ Complete") {
    await db.update(withdrawalsTable).set({ status: "completed" }).where(eq(withdrawalsTable.id, id));
    notifyWithdrawalCompleted(owner?.telegramChatId, existing.amount, existing.telebirrNumber).catch(() => {});
    setSession(chatId, { step: "admin_idle", isAdmin: true, tempWithdrawalId: undefined });
    await sendMessage(chatId, `✅ Withdrawal #${id} completed! <b>${existing.amount} ETB</b> sent.`, adminMenu());
  } else if (text === "❌ Reject") {
    await db.update(usersTable).set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.amount}` }).where(eq(usersTable.id, existing.userId));
    await db.update(withdrawalsTable).set({ status: "rejected" }).where(eq(withdrawalsTable.id, id));
    notifyWithdrawalRejected(owner?.telegramChatId, existing.amount, null).catch(() => {});
    setSession(chatId, { step: "admin_idle", isAdmin: true, tempWithdrawalId: undefined });
    await sendMessage(chatId, `❌ Withdrawal #${id} rejected! <b>${existing.amount} ETB</b> returned to wallet.`, adminMenu());
  } else {
    await sendMessage(chatId, "Please select ✅ Complete or ❌ Reject:");
  }
}

// ── Admin: users ───────────────────────────────────────────────────────────

async function showAdminUsers(chatId: string): Promise<void> {
  const users = await db.select({
    id: usersTable.id, name: usersTable.name, walletBalance: usersTable.walletBalance, isBanned: usersTable.isBanned,
  }).from(usersTable).orderBy(desc(usersTable.createdAt)).limit(15);

  const lines = users.map((u) => `🆔 #${u.id} | ${u.isBanned ? "🚫" : "✅"} <b>${u.name ?? "?"}</b> — ${u.walletBalance} ETB`);
  await sendMessage(chatId, `👥 <b>Users (last 15)</b>\n\n${lines.join("\n")}`,
    { reply_markup: { keyboard: [[{ text: "🚫 Ban/Unban User" }, { text: "👥 Users" }], [{ text: "🚪 Back to Menu" }]], resize_keyboard: true } }
  );
}

async function handleAdminBanId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ Please enter a valid ID:"); return; }
  const [user] = await db.select({ name: usersTable.name, isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { await sendMessage(chatId, `❌ User #${id} not found:`); return; }
  const newBanned = !user.isBanned;
  await db.update(usersTable).set({ isBanned: newBanned }).where(eq(usersTable.id, id));
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `${newBanned ? "🚫" : "✅"} User <b>${user.name}</b> (#${id}) has been ${newBanned ? "banned!" : "unbanned!"}`, adminMenu());
}

// ── Admin: broadcast ───────────────────────────────────────────────────────

async function handleAdminBroadcastTitle(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_admin_broadcast_message", tempBroadcastTitle: text.trim() });
  await sendMessage(chatId, `📢 Title: <b>${text.trim()}</b>\n\nEnter the broadcast message:`, cancelKeyboard());
}

async function handleAdminBroadcastMessage(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const title = session.tempBroadcastTitle!;
  await db.insert(broadcastsTable).values({ title, message: text.trim() });
  const users = await db.select({ telegramChatId: usersTable.telegramChatId }).from(usersTable);
  const telegramUsers = users.filter((u) => u.telegramChatId);
  await Promise.allSettled(telegramUsers.map((u) => sendBroadcastMessage(u.telegramChatId!, title, text.trim()).catch(() => {})));
  setSession(chatId, { step: "admin_idle", isAdmin: true, tempBroadcastTitle: undefined });
  await sendMessage(chatId, `✅ Broadcast sent to <b>${telegramUsers.length}</b> users!`, adminMenu());
}

// ── Admin: settings ────────────────────────────────────────────────────────

async function showAdminSettings(chatId: string): Promise<void> {
  const price = await getPricePerEmail();
  const commission = await getCommissionPct();
  await sendMessage(chatId, `⚙️ <b>Settings</b>\n\n💰 Price per email: <b>${price} ETB</b>\n📊 Referral commission: <b>${commission}%</b>`,
    { reply_markup: { keyboard: [[{ text: "💰 Change Price" }, { text: "📊 Change Commission" }], [{ text: "🔑 Change Password" }, { text: "🚪 Back to Menu" }]], resize_keyboard: true } }
  );
}

async function handleAdminSettingsPrice(chatId: string, text: string): Promise<void> {
  const price = parseInt(text, 10);
  if (isNaN(price) || price < 1) { await sendMessage(chatId, "❌ Please enter a valid price:"); return; }
  await db.insert(settingsTable).values({ key: "price_per_email", value: String(price) }).onConflictDoUpdate({ target: settingsTable.key, set: { value: String(price) } });
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `✅ Price updated to <b>${price} ETB</b>!`, adminMenu());
}

async function handleAdminSettingsCommission(chatId: string, text: string): Promise<void> {
  const pct = parseInt(text, 10);
  if (isNaN(pct) || pct < 0 || pct > 100) { await sendMessage(chatId, "❌ Please enter a valid % (0–100):"); return; }
  await db.insert(settingsTable).values({ key: "referral_commission_pct", value: String(pct) }).onConflictDoUpdate({ target: settingsTable.key, set: { value: String(pct) } });
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `✅ Referral commission updated to <b>${pct}%</b>!`, adminMenu());
}

async function handleAdminNewPassword(chatId: string, text: string): Promise<void> {
  if (text.length < 8) { await sendMessage(chatId, "❌ Password must be at least 8 characters:"); return; }
  const hash = await bcrypt.hash(text, 10);
  await db.insert(settingsTable).values({ key: "admin_password_hash", value: hash }).onConflictDoUpdate({ target: settingsTable.key, set: { value: hash } });
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, "✅ Admin password updated!", adminMenu());
}

// ── Admin: email pool ──────────────────────────────────────────────────────

async function showAdminEmailPool(chatId: string): Promise<void> {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'available')::int AS available,
       COUNT(*) FILTER (WHERE status = 'claimed')::int   AS claimed,
       COUNT(*) FILTER (WHERE status = 'submitted')::int AS submitted,
       COUNT(*)::int                                      AS total
     FROM generated_emails`
  );
  const s = rows[0] as { available: number; claimed: number; submitted: number; total: number };

  setSession(chatId, { step: "await_admin_email_pool" });
  await sendMessage(chatId,
    `✨ <b>Email Pool</b>\n\n` +
    `📦 Available: <b>${s.available}</b>\n` +
    `🔒 Claimed:   <b>${s.claimed}</b>\n` +
    `✅ Submitted: <b>${s.submitted}</b>\n` +
    `📊 Total:     <b>${s.total}</b>\n\n` +
    `➕ <b>Add emails — one per line:</b>\n` +
    `<code>email@gmail.com:password</code>\n` +
    `<code>Name:email@gmail.com:password</code>\n\n` +
    `Send your list now, or tap Cancel.`,
    cancelKeyboard()
  );
}

async function handleAdminEmailPool(chatId: string, text: string): Promise<void> {
  const lines = text.trim().split("\n").filter(Boolean);

  const parsed: { name: string | null; email: string; password: string }[] = [];
  for (const line of lines) {
    const parts = line.split(":").map((p) => p.trim());
    if (parts.length === 3 && parts[1].includes("@")) {
      parsed.push({ name: parts[0] || null, email: parts[1].toLowerCase(), password: parts[2] });
    } else if (parts.length === 2 && parts[0].includes("@")) {
      parsed.push({ name: null, email: parts[0].toLowerCase(), password: parts[1] });
    }
  }

  if (parsed.length === 0) {
    await sendMessage(chatId,
      `❌ No valid entries found.\n\nUse format:\n<code>email@gmail.com:password</code>\nor\n<code>Name:email@gmail.com:password</code>`,
      cancelKeyboard()
    );
    return;
  }

  let added = 0;
  let skipped = 0;
  for (const entry of parsed) {
    try {
      const { rowCount } = await pool.query(
        `INSERT INTO generated_emails (name, email, password)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [entry.name, entry.email, entry.password]
      );
      if ((rowCount ?? 0) > 0) added++; else skipped++;
    } catch {
      skipped++;
    }
  }

  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId,
    `✅ <b>Done!</b>\n\n➕ Added: <b>${added}</b>\n⏭️ Skipped (duplicates): <b>${skipped}</b>`,
    adminMenu()
  );
}

// ── Admin: export ──────────────────────────────────────────────────────────

async function showAdminExport(chatId: string): Promise<void> {
  await sendMessage(chatId, "📤 <b>Export</b>\n\nWhat would you like to export?",
    {
      reply_markup: {
        keyboard: [
          [{ text: "📋 All Submissions" }, { text: "✅ Approved Submissions" }],
          [{ text: "💸 Export Withdrawals" }, { text: "👥 Export Users" }],
          [{ text: "🚪 Back to Menu" }],
        ],
        resize_keyboard: true,
      },
    }
  );
}

async function exportData(chatId: string, type: string): Promise<void> {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const toCSV = (headers: string[], rows: (string | number | null | undefined)[][]) =>
    "\uFEFF" + [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");

  let csv = "", filename = "", caption = "";

  if (type === "submissions" || type === "approved-submissions") {
    const rows = await db.select({
      id: submissionsTable.id, userName: usersTable.name, email: submissionsTable.email,
      password: submissionsTable.password, pricePaid: submissionsTable.pricePaid,
      createdAt: submissionsTable.createdAt, status: submissionsTable.status,
    }).from(submissionsTable).leftJoin(usersTable, eq(submissionsTable.userId, usersTable.id)).orderBy(submissionsTable.createdAt);
    const filtered = type === "approved-submissions" ? rows.filter((r) => r.status === "approved") : rows;
    if (!filtered.length) { await sendMessage(chatId, "❌ No data found.", adminMenu()); return; }
    csv = toCSV(["ID", "Seller", "Email", "Password", "Price(ETB)", "Date", "Status"],
      filtered.map((r) => [r.id, r.userName, r.email, r.password, r.pricePaid, new Date(r.createdAt).toISOString().slice(0, 16), r.status]));
    filename = `${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    caption = `📋 <b>${type === "approved-submissions" ? "Approved" : "All"} Submissions</b>\n${filtered.length} records`;
  } else if (type === "withdrawals") {
    const rows = await db.select({
      id: withdrawalsTable.id, userEmail: usersTable.email, paymentMethod: withdrawalsTable.paymentMethod,
      telebirrNumber: withdrawalsTable.telebirrNumber, telebirrName: withdrawalsTable.telebirrName,
      bankName: withdrawalsTable.bankName, bankAccountNumber: withdrawalsTable.bankAccountNumber,
      bankAccountName: withdrawalsTable.bankAccountName, amount: withdrawalsTable.amount,
      createdAt: withdrawalsTable.createdAt, status: withdrawalsTable.status,
    }).from(withdrawalsTable).leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id)).orderBy(withdrawalsTable.createdAt);
    if (!rows.length) { await sendMessage(chatId, "❌ No data found.", adminMenu()); return; }
    csv = toCSV(["ID", "User", "Method", "Number", "Name", "Bank", "Amount(ETB)", "Date", "Status"],
      rows.map((r) => [r.id, r.userEmail, r.paymentMethod,
        r.paymentMethod === "bank" ? r.bankAccountNumber : r.telebirrNumber,
        r.paymentMethod === "bank" ? r.bankAccountName : r.telebirrName,
        r.bankName ?? "", r.amount, new Date(r.createdAt).toISOString().slice(0, 16), r.status]));
    filename = `withdrawals-${new Date().toISOString().slice(0, 10)}.csv`;
    caption = `💸 <b>Withdrawals Export</b>\n${rows.length} records`;
  } else if (type === "users") {
    const users = await db.select({
      id: usersTable.id, name: usersTable.name, email: usersTable.email,
      walletBalance: usersTable.walletBalance, isBanned: usersTable.isBanned, createdAt: usersTable.createdAt,
    }).from(usersTable).orderBy(usersTable.createdAt);
    if (!users.length) { await sendMessage(chatId, "❌ No data found.", adminMenu()); return; }
    csv = toCSV(["ID", "Name", "Email", "Wallet(ETB)", "Banned", "Joined"],
      users.map((u) => [u.id, u.name ?? "", u.email ?? "", u.walletBalance, u.isBanned ? "Yes" : "No", new Date(u.createdAt).toISOString().slice(0, 16)]));
    filename = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    caption = `👥 <b>Users Export</b>\n${users.length} records`;
  }

  const result = await sendDocumentToAdmin(filename, csv, caption);
  if (result.ok) {
    await sendMessage(chatId, `✅ <b>${filename}</b> sent to admin Telegram!`, adminMenu());
  } else {
    await sendMessage(chatId, `❌ Export failed: ${result.error}`, adminMenu());
  }
}

// ── Notification helpers ───────────────────────────────────────────────────

export async function notifySubmissionApproved(chatId: string | null | undefined, email: string, amount: number): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `✅ <b>Submission approved!</b>\n\n📧 Email: <code>${email}</code>\n💰 Payment: <b>${amount} ETB</b> has been added to your wallet!\n\n📊 Tap <b>💰 Balance</b> to check your wallet.`);
}

export async function notifySubmissionRejected(chatId: string | null | undefined, email: string): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `❌ <b>Submission not approved</b>\n\n📧 Email: <code>${email}</code>\n\nThis may be because the credentials could not be verified. You can submit another account.`);
}

export async function notifyWithdrawalCompleted(chatId: string | null | undefined, amount: number, telebirrNumber: string): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `💸 <b>Payment sent!</b>\n\n💰 Amount: <b>${amount} ETB</b>\n📱 Number: <code>${telebirrNumber}</code>`);
}

export async function notifyWithdrawalRejected(chatId: string | null | undefined, amount: number, note?: string | null): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `❌ <b>Withdrawal request rejected</b>\n\n💰 Amount: <b>${amount} ETB</b> has been returned to your wallet.${note ? `\n📝 Reason: ${note}` : ""}`);
}

export async function notifyAdminNewSubmission(opts: {
  submissionId: number; submittedEmail: string; submittedPassword: string;
  userId: number; userName: string | null; userEmail: string | null; pricePaid: number;
}): Promise<void> {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;
  const userLabel = opts.userName ?? opts.userEmail ?? `ID: ${opts.userId}`;
  await sendMessage(adminChatId,
    `📬 <b>New Submission #${opts.submissionId}</b>\n\n👤 <b>User:</b> ${userLabel}\n📧 <b>Email:</b> <code>${opts.submittedEmail}</code>\n🔑 <b>Password:</b> <code>${opts.submittedPassword}</code>\n💰 <b>Price:</b> ${opts.pricePaid} ETB\n⏰ ${new Date().toLocaleString("en-US", { timeZone: "Africa/Addis_Ababa" })}`
  );
}

export async function sendBroadcastMessage(chatId: string, title: string, message: string): Promise<void> {
  await sendMessage(chatId, `📢 <b>${title}</b>\n\n${message}`);
}

export async function sendDocumentToAdmin(filename: string, csvContent: string, caption: string): Promise<{ ok: boolean; error?: string }> {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!adminChatId) return { ok: false, error: "ADMIN_TELEGRAM_CHAT_ID not set" };
  try {
    const form = new FormData();
    form.append("chat_id", adminChatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append("document", new Blob([csvContent], { type: "text/csv;charset=utf-8" }), filename);
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, { method: "POST", body: form });
    const json = await res.json() as { ok: boolean; description?: string };
    if (!json.ok) return { ok: false, error: json.description ?? "Telegram error" };
    return { ok: true };
  } catch (err) {
    logger.warn({ err }, "Telegram sendDocument failed");
    return { ok: false, error: String(err) };
  }
}
