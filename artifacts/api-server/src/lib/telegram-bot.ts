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

function mainMenu(isLoggedIn: boolean): Record<string, unknown> {
  if (!isLoggedIn) {
    return {
      reply_markup: {
        keyboard: [[{ text: "📝 ምዝገባ" }, { text: "🔑 ግባ" }]],
        resize_keyboard: true,
        one_time_keyboard: false,
      },
    };
  }
  return {
    reply_markup: {
      keyboard: [
        [{ text: "📊 መረጃዬ" }, { text: "📧 ኢሜይል አስገባ" }],
        [{ text: "✨ ኢሜይል ውሰድ" }, { text: "💸 ወጪ አውጣ" }],
        [{ text: "📋 ሁኔታዎቼ" }, { text: "💼 ወጪዎቼ" }],
        [{ text: "🔗 ሪፈራል" }, { text: "📢 ማስታወቂያዎች" }],
        [{ text: "🚪 ውጣ" }],
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
        [{ text: "⏳ ጠቅላላ ሁኔታ" }, { text: "📬 ሰብሚሽኖች" }],
        [{ text: "💸 የወጪ ጥያቄዎች" }, { text: "👥 ዩዘሮች" }],
        [{ text: "📢 ብሮድካስት" }, { text: "⚙️ ቅንብሮች" }],
        [{ text: "📤 ኤክስፖርት" }, { text: "🚪 ወደ ዩዘር ሂድ" }],
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function cancelKeyboard(): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: [[{ text: "❌ ሰርዝ" }]],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

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
      { command: "start", description: "ዋና ምናሌ ክፈት" },
      { command: "help", description: "እርዳታ" },
      { command: "admin", description: "አድሚን ፓነል" },
    ],
  });
}

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

  if (text === "❌ ሰርዝ") {
    clearSession(chatId);
    if (session.isAdmin) {
      await sendMessage(chatId, "❌ ተሰርዟል።", adminMenu());
    } else {
      await sendMessage(chatId, "❌ ተሰርዟል።", mainMenu(!!session.userId));
    }
    return;
  }

  if (text === "/start") {
    clearSession(chatId);
    const firstName = msg.from?.first_name ?? "ወዳጄ";
    if (session.userId) {
      const [user] = await db.select({ name: usersTable.name, walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, session.userId));
      await sendMessage(chatId,
        `👋 <b>ሰላም ${user?.name ?? firstName}!</b>\n\n💰 ቦርሳ: <b>${user?.walletBalance ?? 0} ETB</b>\n\nምን ማድረግ ትፈልጋለህ?`,
        mainMenu(true)
      );
    } else {
      await sendMessage(chatId,
        `👋 <b>ሰላም ${firstName}!</b>\n\n🌟 <b>ሜል ማርት</b> እንኳን ደህና መጡ!\n\n💡 ያልተጠቀሙበት Gmail አካውንት ወደ ገንዘብ ይቀይሩ — ለእያንዳንዱ ኢሜይል <b>ተከፋይ ይሁኑ</b>.\n\n👇 ለመጀመር ምዝገባ ወይም ግባ:`,
        mainMenu(false)
      );
    }
    return;
  }

  if (text === "/admin") {
    setSession(chatId, { step: "await_admin_password" });
    await sendMessage(chatId, "🔐 አድሚን ፓስወርድ ያስገቡ:", cancelKeyboard());
    return;
  }

  if (text === "/help") {
    await sendMessage(chatId,
      `ℹ️ <b>እርዳታ</b>\n\n📝 <b>ምዝገባ</b> — አዲስ አካውንት ፍጠር\n🔑 <b>ግባ</b> — ወደ አካውንትህ ግባ\n📧 <b>ኢሜይል አስገባ</b> — Gmail አስገባ ለሽያጭ\n💸 <b>ወጪ አውጣ</b> — ገንዘብ ወጪ አድርግ\n📊 <b>መረጃዬ</b> — ቦርሳ እና ስታቲስቲክስ\n\n/start — ወደ ዋና ምናሌ ተመለስ`,
      mainMenu(!!session.userId)
    );
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
    case "gen_email_confirm": await handleGenEmailConfirm(chatId, text, session.userId!); break;
    case "gen_email_view": await handleGenEmailAction(chatId, text, session.userId!); break;
    default:
      clearSession(chatId);
      await sendMessage(chatId, "ወደ ዋና ምናሌ ተመለሰሃል። /start", mainMenu(!!session.userId));
  }
}

async function handleIdleMessage(chatId: string, text: string, session: ReturnType<typeof getSession>): Promise<void> {
  if (!session.userId) {
    switch (text) {
      case "📝 ምዝገባ":
        setSession(chatId, { step: "await_register_name" });
        await sendMessage(chatId, "📝 <b>ምዝገባ</b>\n\nየማሳያ ስምህን ያስገባ (ለምሳሌ: Abel123):", cancelKeyboard());
        break;
      case "🔑 ግባ":
        setSession(chatId, { step: "await_login_name" });
        await sendMessage(chatId, "🔑 <b>ግባ</b>\n\nየማሳያ ስምህን ያስገባ:", cancelKeyboard());
        break;
      default:
        await sendMessage(chatId, "👇 ለመጀመር ምዝገባ ወይም ግባ:", mainMenu(false));
    }
    return;
  }
  switch (text) {
    case "📊 መረጃዬ": await showProfile(chatId, session.userId); break;
    case "📧 ኢሜይል አስገባ":
      setSession(chatId, { step: "await_submit_email" });
      await sendMessage(chatId, `📧 <b>Gmail አስገባ</b>\n\nየ Gmail አድራሻህን ያስገባ:\n<i>ምሳሌ: example@gmail.com</i>`, cancelKeyboard());
      break;
    case "✨ ኢሜይል ውሰድ": await handleGetEmailMenu(chatId, session.userId!); break;
    case "💸 ወጪ አውጣ": await startWithdraw(chatId, session.userId); break;
    case "📋 ሁኔታዎቼ": await showSubmissions(chatId, session.userId); break;
    case "💼 ወጪዎቼ": await showWithdrawals(chatId, session.userId); break;
    case "🔗 ሪፈራል": await showReferral(chatId, session.userId); break;
    case "📢 ማስታወቂያዎች": await showBroadcasts(chatId); break;
    case "🚪 ውጣ":
      setSession(chatId, { step: "idle", userId: undefined, isAdmin: false });
      await sendMessage(chatId, "👋 ወጥተሃል። እስከሚቀጥለው!", mainMenu(false));
      break;
    default:
      await sendMessage(chatId, "👇 ምናሌ ተጠቀም:", mainMenu(true));
  }
}

async function showProfile(chatId: string, userId: number): Promise<void> {
  const [user] = await db.select({
    name: usersTable.name, walletBalance: usersTable.walletBalance,
    referralCode: usersTable.referralCode, commissionEarned: usersTable.commissionEarned,
  }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { await sendMessage(chatId, "❌ አካውንት አልተገኘም።", mainMenu(false)); return; }

  const [stats] = await db.select({
    total: sql<number>`count(*)::int`,
    approved: sql<number>`count(*) filter (where ${submissionsTable.status} = 'approved')::int`,
    pending: sql<number>`count(*) filter (where ${submissionsTable.status} = 'pending')::int`,
  }).from(submissionsTable).where(eq(submissionsTable.userId, userId));

  await sendMessage(chatId,
    `📊 <b>የእኔ መረጃ</b>\n\n👤 ስም: <b>${user.name}</b>\n💰 ቦርሳ: <b>${user.walletBalance} ETB</b>\n🏆 ኮሚሽን: <b>${user.commissionEarned} ETB</b>\n\n📧 <b>ሰብሚሽኖች</b>\n• ጠቅላላ: ${stats?.total ?? 0}\n• ✅ ጸድቋል: ${stats?.approved ?? 0}\n• ⏳ በጥበቃ: ${stats?.pending ?? 0}\n\n🔗 ሪፈራል ኮድ: <code>${user.referralCode}</code>`,
    mainMenu(true)
  );
}

async function showSubmissions(chatId: string, userId: number): Promise<void> {
  const rows = await db.select({
    email: submissionsTable.email, status: submissionsTable.status,
    pricePaid: submissionsTable.pricePaid, rejectionNote: submissionsTable.rejectionNote,
  }).from(submissionsTable).where(eq(submissionsTable.userId, userId)).orderBy(desc(submissionsTable.createdAt)).limit(10);

  if (rows.length === 0) { await sendMessage(chatId, "📋 እስካሁን ምንም ሰብሚሽን አላቀረብህም።", mainMenu(true)); return; }

  const e: Record<string, string> = { pending: "⏳", approved: "✅", rejected: "❌" };
  const lines = rows.map((r) => {
    let line = `${e[r.status] ?? "❓"} <code>${r.email}</code> — ${r.pricePaid} ETB`;
    if (r.status === "rejected" && r.rejectionNote) line += `\n   ↳ ${r.rejectionNote}`;
    return line;
  });
  await sendMessage(chatId, `📋 <b>ሰብሚሽኖቼ</b> (የቅርቡ 10)\n\n${lines.join("\n\n")}`, mainMenu(true));
}

async function showWithdrawals(chatId: string, userId: number): Promise<void> {
  const rows = await db.select({
    amount: withdrawalsTable.amount, paymentMethod: withdrawalsTable.paymentMethod,
    status: withdrawalsTable.status, adminNote: withdrawalsTable.adminNote,
  }).from(withdrawalsTable).where(eq(withdrawalsTable.userId, userId)).orderBy(desc(withdrawalsTable.createdAt)).limit(10);

  if (rows.length === 0) { await sendMessage(chatId, "💼 እስካሁን ምንም የወጪ ጥያቄ አላቀረብህም።", mainMenu(true)); return; }

  const e: Record<string, string> = { pending: "⏳", completed: "✅", rejected: "❌" };
  const lines = rows.map((r) => {
    let line = `${e[r.status] ?? "❓"} <b>${r.amount} ETB</b> — ${r.paymentMethod === "telebirr" ? "ቴሌብር" : "ባንክ"}`;
    if (r.adminNote) line += `\n   ↳ ${r.adminNote}`;
    return line;
  });
  await sendMessage(chatId, `💼 <b>ወጪዎቼ</b> (የቅርቡ 10)\n\n${lines.join("\n\n")}`, mainMenu(true));
}

async function showReferral(chatId: string, userId: number): Promise<void> {
  const [user] = await db.select({ referralCode: usersTable.referralCode, commissionEarned: usersTable.commissionEarned }).from(usersTable).where(eq(usersTable.id, userId));
  const [refCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.referredBy, userId));
  const commissionPct = await getCommissionPct();
  await sendMessage(chatId,
    `🔗 <b>ሪፈራል ፕሮግራም</b>\n\n📌 ሪፈራል ኮድ: <code>${user?.referralCode}</code>\n\n👥 የተጋበዙ ወዳጆች: <b>${refCount?.count ?? 0}</b>\n💰 ኮሚሽን: <b>${user?.commissionEarned ?? 0} ETB</b>\n\n📊 ለእያንዳንዱ ጸድቆ ሰብሚሽን <b>${commissionPct}%</b> ኮሚሽን ታገኛለህ!`,
    mainMenu(true)
  );
}

async function showBroadcasts(chatId: string): Promise<void> {
  const rows = await db.select({ title: broadcastsTable.title, message: broadcastsTable.message, createdAt: broadcastsTable.createdAt }).from(broadcastsTable).orderBy(desc(broadcastsTable.createdAt)).limit(5);
  if (rows.length === 0) { await sendMessage(chatId, "📢 አሁን ምንም ማስታወቂያ የለም።", mainMenu(true)); return; }
  const lines = rows.map((r) => `📢 <b>${r.title}</b>\n${r.message}\n<i>${new Date(r.createdAt).toLocaleDateString("am-ET")}</i>`);
  await sendMessage(chatId, `📢 <b>ማስታወቂያዎች</b>\n\n${lines.join("\n\n─────────────\n\n")}`, mainMenu(true));
}

async function startWithdraw(chatId: string, userId: number): Promise<void> {
  const [user] = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.walletBalance < 50) {
    await sendMessage(chatId, `💸 <b>ወጪ አውጣ</b>\n\n💰 ቦርሳህ: <b>${user?.walletBalance ?? 0} ETB</b>\n\n❌ ቢያንስ <b>50 ETB</b> ሊኖርህ ይገባል።`, mainMenu(true));
    return;
  }
  setSession(chatId, { step: "await_withdraw_method" });
  await sendMessage(chatId, `💸 <b>ወጪ አውጣ</b>\n\n💰 ቦርሳህ: <b>${user.walletBalance} ETB</b>\n\nየክፍያ ዘዴ ምረጥ:`,
    { reply_markup: { keyboard: [[{ text: "📱 ቴሌብር" }, { text: "🏦 ባንክ" }], [{ text: "❌ ሰርዝ" }]], resize_keyboard: true } }
  );
}

async function handleRegisterName(chatId: string, text: string): Promise<void> {
  const name = text.trim();
  if (name.length < 3 || name.length > 30) { await sendMessage(chatId, "❌ ስም ከ3 እስከ 30 ፊደላት ሊሆን ይገባል:"); return; }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.name, name));
  if (existing) { await sendMessage(chatId, "❌ ይህ ስም ተወስዷል። ሌላ ስም ሞክር:"); return; }
  setSession(chatId, { step: "await_register_password", tempName: name });
  await sendMessage(chatId, `👤 ስም: <b>${name}</b>\n\n🔐 ፓስወርድ ያስገባ (ቢያንስ 6 ፊደል):`);
}

async function handleRegisterPassword(chatId: string, text: string): Promise<void> {
  if (text.length < 6) { await sendMessage(chatId, "❌ ፓስወርድ ቢያንስ 6 ፊደል ሊሆን ይገባል:"); return; }
  setSession(chatId, { step: "await_register_confirm_password", tempPassword: text });
  await sendMessage(chatId, "🔐 ፓስወርድ ደግሞ ያስገባ (ለማረጋገጥ):");
}

async function handleRegisterConfirmPassword(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  if (text !== session.tempPassword) {
    setSession(chatId, { step: "await_register_password", tempPassword: undefined });
    await sendMessage(chatId, "❌ ፓስወርዱ አልተዛመደም። ፓስወርድ ዳግም ያስገባ:");
    return;
  }
  setSession(chatId, { step: "await_register_referral" });
  await sendMessage(chatId, "🔗 ሪፈራል ኮድ አለህ? ካለህ ያስገባ። ከሌለህ <b>ዝለል</b> ተጫን:",
    { reply_markup: { keyboard: [[{ text: "ዝለል" }], [{ text: "❌ ሰርዝ" }]], resize_keyboard: true } }
  );
}

async function handleRegisterReferral(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  let referrerId: number | undefined;
  if (text !== "ዝለል") {
    const code = text.trim().toUpperCase();
    const [referrer] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, code));
    if (!referrer) { await sendMessage(chatId, "❌ ሪፈራል ኮዱ አልተገኘም። ዝለል ተጫን ወይም ትክክለኛ ኮድ ያስገባ:"); return; }
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
      `✅ <b>ምዝገባ ተሳካ!</b>\n\n👤 ስም: <b>${user.name}</b>\n🔗 ሪፈራል ኮድ: <code>${newCode}</code>\n\nአሁን Gmail አካውንት ማስገባት ትችላለህ!`,
      mainMenu(true)
    );
  } catch {
    clearSession(chatId);
    await sendMessage(chatId, "❌ ምዝገባ አልተሳካም። ዳግም ሞክር። /start", mainMenu(false));
  }
}

async function handleLoginName(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_login_password", tempName: text.trim() });
  await sendMessage(chatId, "🔐 ፓስወርድ ያስገባ:");
}

async function handleLoginPassword(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const [user] = await db.select({
    id: usersTable.id, name: usersTable.name, passwordHash: usersTable.passwordHash,
    isBanned: usersTable.isBanned, walletBalance: usersTable.walletBalance,
  }).from(usersTable).where(eq(usersTable.name, session.tempName!));

  if (!user) {
    setSession(chatId, { step: "await_login_name", tempName: undefined });
    await sendMessage(chatId, "❌ ስም አልተገኘም። ዳግም ሞክር:", cancelKeyboard());
    return;
  }
  if (user.isBanned) { clearSession(chatId); await sendMessage(chatId, "⛔ አካውንትህ ታግዷል።", mainMenu(false)); return; }

  const valid = await bcrypt.compare(text, user.passwordHash);
  if (!valid) { await sendMessage(chatId, "❌ ፓስወርድ ትክክል አይደለም። ዳግም ሞክር:"); return; }

  await db.update(usersTable).set({ telegramChatId: chatId }).where(eq(usersTable.id, user.id));
  setSession(chatId, { step: "idle", userId: user.id, tempName: undefined, isAdmin: false });
  await sendMessage(chatId, `✅ <b>ተገብቷል!</b>\n\n👤 <b>${user.name}</b>\n💰 ቦርሳ: <b>${user.walletBalance} ETB</b>`, mainMenu(true));
}

async function handleSubmitEmail(chatId: string, text: string): Promise<void> {
  const email = text.trim().toLowerCase();
  if (!email.endsWith("@gmail.com")) { await sendMessage(chatId, "❌ ትክክለኛ Gmail አድራሻ ያስገባ (@gmail.com ብቻ):"); return; }
  const [existing] = await db.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.email, email));
  if (existing) { await sendMessage(chatId, "❌ ይህ ኢሜይል አስቀድሞ ቀርቧል። ሌላ ሞክር:"); return; }
  setSession(chatId, { step: "await_submit_password", tempEmail: email });
  await sendMessage(chatId, `📧 ኢሜይል: <code>${email}</code>\n\n🔑 የዚሁ Gmail ፓስወርድ ያስገባ:`);
}

async function handleSubmitPassword(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const email = session.tempEmail!;
  const password = text.trim();

  await sendMessage(chatId, `⏳ <b>Gmail ፍተሻ ላይ ነን...</b>\n\n📧 <code>${email}</code>\n\nትንሽ ይጠብቁ።`);

  const verifyResult = await verifyGmailAccount(email.toLowerCase(), password);

  if (verifyResult.verified === false && verifyResult.reason === "not_registered") {
    await sendMessage(
      chatId,
      `❌ <b>Gmail አካውንት አልተፈጠረም!</b>\n\n📧 ኢሜይል: <code>${email}</code>\n\n⚠️ ይህ ኢሜይል Gmail ላይ አልተፈጠረም ወይም ፓስወርዱ ስህተት ነው።\n\n👉 Gmail ላይ ተመዝግበህ ከጨረስክ በኋላ እንደገና ሞክር።`,
      mainMenu(true)
    );
    clearSession(chatId);
    return;
  }

  if (verifyResult.verified === false && verifyResult.reason === "network_error") {
    logger.warn({ chatId, email }, "Gmail IMAP network error in bot — allowing with warning");
  }

  const price = await getPricePerEmail();
  const [row] = await db.insert(submissionsTable).values({
    userId: session.userId!, email: email.toLowerCase(), password,
    status: "pending", pricePaid: price,
  }).returning({ id: submissionsTable.id, email: submissionsTable.email, pricePaid: submissionsTable.pricePaid });

  const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, session.userId!));
  notifyAdminNewSubmission({
    submissionId: row.id, submittedEmail: row.email, submittedPassword: password,
    userId: session.userId!, userName: user?.name ?? null, userEmail: null, pricePaid: row.pricePaid,
  }).catch(() => {});

  clearSession(chatId);
  await sendMessage(chatId,
    `✅ <b>ሰብሚሽን ተቀብሏል!</b>\n\n📧 ኢሜይል: <code>${row.email}</code>\n💰 ዋጋ: <b>${row.pricePaid} ETB</b> (ሲጸድቅ ይታከላል)\n\n⏳ ሲጸድቅ ወዲያው ትነገርለህ!`,
    mainMenu(true)
  );
}

// ── Generated Email keyboards ─────────────────────────────────────────────

function genEmailClaimedKeyboard(emailOpened: boolean): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: emailOpened
        ? [
            [{ text: "📤 ሰብሚት አድርግ" }],
            [{ text: "↩️ ኢሜይሉን መልስ" }, { text: "❌ ሰርዝ" }],
          ]
        : [
            [{ text: "📧 Gmail ከፈቻለሁ" }],
            [{ text: "↩️ ኢሜይሉን መልስ" }, { text: "❌ ሰርዝ" }],
          ],
      resize_keyboard: true,
      one_time_keyboard: false,
    },
  };
}

function genEmailConfirmKeyboard(): Record<string, unknown> {
  return {
    reply_markup: {
      keyboard: [[{ text: "✅ ወሰድ" }, { text: "❌ ሰርዝ" }]],
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
  const nameLine = row.name ? `\n👤 ስም: <code>${row.name}</code>` : "";
  const openedStatus = row.email_opened
    ? "✅ Gmail ከፍተዋል — አሁን ሰብሚት ማድረግ ይችላሉ!"
    : "⚠️ <b>ከሰብሚት በፊት Gmail መክፈት ግዴታ ነው!</b>";
  return (
    `✨ <b>የእርስዎ ኢሜይል</b>${nameLine}\n` +
    `📧 <code>${row.email}</code>\n` +
    `🔑 <code>${row.password}</code>\n\n` +
    `${openedStatus}\n\n` +
    `📋 <b>ደረጃዎች:</b>\n` +
    `1️⃣ ኢሜሉን እና ፓስወርዱን ኮፒ ያድርጉ\n` +
    `2️⃣ Gmail ክፈቱ (accounts.google.com) → አዲስ ምዝገባ\n` +
    `3️⃣ ምዝገባ ካጠናቀቁ <b>"📧 Gmail ከፈቻለሁ"</b> ይጫኑ\n` +
    `4️⃣ <b>"📤 ሰብሚት አድርግ"</b> ይጫኑ`
  );
}

// Entry point: user taps "✨ ኢሜይል ውሰድ"
async function handleGetEmailMenu(chatId: string, userId: number): Promise<void> {
  // Check if user already has a claimed email
  const existing = await getClaimedEmail(userId);
  if (existing) {
    setSession(chatId, { step: "gen_email_view" });
    await sendMessage(chatId, buildClaimedEmailMessage(existing), genEmailClaimedKeyboard(existing.email_opened));
    return;
  }

  // Show available count + warning
  const { rows } = await pool.query(
    "SELECT COUNT(*)::int AS count FROM generated_emails WHERE status = 'available'"
  );
  const count = (rows[0] as { count: number }).count;

  if (count === 0) {
    await sendMessage(chatId,
      `😔 <b>አሁን ዝግጁ ኢሜይል የለም።</b>\n\nቆይተው እንደገና ይሞክሩ።`,
      mainMenu(true)
    );
    return;
  }

  setSession(chatId, { step: "gen_email_confirm" });
  await sendMessage(chatId,
    `✨ <b>ኢሜይል ውሰድ</b>\n\n` +
    `📦 ዝግጁ ኢሜይሎች: <b>${count}</b>\n\n` +
    `⚠️ <b>ማስጠንቀቂያ — ከመቀጠልዎ በፊት ያንብቡ!</b>\n\n` +
    `• ኢሜሉን ሲወስዱ <b>ትክክለኛ Gmail ምዝገባ</b> ማድረግ ግዴታ ነው\n` +
    `• ሳይከፍቱ ሰብሚት ቢያደርጉ — <b>አካውንትዎ ይታገዳል!</b>\n\n` +
    `"✅ ወሰድ" ተጭነው ኢሜይሉን ይውሰዱ።`,
    genEmailConfirmKeyboard()
  );
}

// Step: gen_email_confirm — waiting for "✅ ወሰድ" or "❌ ሰርዝ"
async function handleGenEmailConfirm(chatId: string, text: string, userId: number): Promise<void> {
  if (text !== "✅ ወሰድ") {
    clearSession(chatId);
    await sendMessage(chatId, "❌ ተሰርዟል።", mainMenu(true));
    return;
  }

  // Check again — no double-claim
  const existing = await getClaimedEmail(userId);
  if (existing) {
    setSession(chatId, { step: "gen_email_view" });
    await sendMessage(chatId, buildClaimedEmailMessage(existing), genEmailClaimedKeyboard(existing.email_opened));
    return;
  }

  // Claim one
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
    await sendMessage(chatId, "😔 <b>ኢሜይል አልተገኘም።</b> ሌላ ሰው ወስዶታል — እንደገና ሞክሩ።", mainMenu(true));
    return;
  }

  const row = rows[0] as GenEmailRow;
  setSession(chatId, { step: "gen_email_view" });
  await sendMessage(chatId, buildClaimedEmailMessage(row), genEmailClaimedKeyboard(row.email_opened));
}

// Step: gen_email_view — "📧 Gmail ከፈቻለሁ" | "📤 ሰብሚት አድርግ" | "↩️ ኢሜይሉን መልስ"
async function handleGenEmailAction(chatId: string, text: string, userId: number): Promise<void> {
  const row = await getClaimedEmail(userId);
  if (!row) {
    clearSession(chatId);
    await sendMessage(chatId, "⚠️ ኢሜይሉ አልተገኘም። ዳግም ይሞክሩ።", mainMenu(true));
    return;
  }

  if (text === "📧 Gmail ከፈቻለሁ") {
    await pool.query(
      "UPDATE generated_emails SET email_opened = TRUE WHERE id = $1 AND claimed_by = $2",
      [row.id, userId]
    );
    await sendMessage(chatId,
      `✅ <b>ተመዝግቧል!</b>\n\n📧 <code>${row.email}</code>\n🔑 <code>${row.password}</code>\n\n` +
      `✅ Gmail ከፍተዋል — አሁን <b>"📤 ሰብሚት አድርግ"</b> ይጫኑ!`,
      genEmailClaimedKeyboard(true)
    );
    return;
  }

  if (text === "↩️ ኢሜይሉን መልስ") {
    await pool.query(
      `UPDATE generated_emails SET status = 'available', claimed_by = NULL,
       claimed_at = NULL, email_opened = FALSE WHERE id = $1 AND claimed_by = $2`,
      [row.id, userId]
    );
    clearSession(chatId);
    await sendMessage(chatId, "↩️ ኢሜይሉ ተመልሷል።", mainMenu(true));
    return;
  }

  if (text === "📤 ሰብሚት አድርግ") {
    if (!row.email_opened) {
      await sendMessage(chatId,
        `⚠️ <b>ቅድሚያ Gmail መክፈት ያስፈልጋል!</b>\n\n` +
        `"📧 Gmail ከፈቻለሁ" ከጫኑ በኋላ ሰብሚት ማድረግ ይችላሉ።`,
        genEmailClaimedKeyboard(false)
      );
      return;
    }

    await sendMessage(chatId, `⏳ <b>Gmail ፍተሻ ላይ ነን...</b>\n\nትንሽ ይጠብቁ።`);

    const verifyResult = await verifyGmailAccount(row.email.toLowerCase(), row.password);

    if (verifyResult.verified === false && verifyResult.reason === "not_registered") {
      await sendMessage(chatId,
        `❌ <b>Gmail አካውንት አልተፈጠረም!</b>\n\n📧 <code>${row.email}</code>\n\n` +
        `ኢሜሉ Gmail ላይ አልተፈጠረም ወይም ፓስወርዱ ትክክል አይደለም።\n\n` +
        `👉 Gmail ላይ ተመዝግበህ ከጨረስህ በኋላ <b>"📧 Gmail ከፈቻለሁ"</b> ብለህ ሰብሚት ሞክር።`,
        genEmailClaimedKeyboard(false)
      );
      // reset email_opened so they have to re-confirm
      await pool.query("UPDATE generated_emails SET email_opened = FALSE WHERE id = $1", [row.id]);
      return;
    }

    if (verifyResult.verified === false && verifyResult.reason === "network_error") {
      logger.warn({ chatId, emailId: row.id }, "Gmail IMAP network error in gen_email bot flow — allowing");
    }

    // Check for duplicate submission
    const { rows: existingSub } = await pool.query(
      "SELECT id FROM submissions WHERE email = $1",
      [row.email.toLowerCase()]
    );
    if (existingSub.length > 0) {
      await pool.query("UPDATE generated_emails SET status = 'submitted' WHERE id = $1", [row.id]);
      clearSession(chatId);
      await sendMessage(chatId, "⚠️ ይህ ኢሜይል አስቀድሞ ቀርቧል።", mainMenu(true));
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
      submissionId: subRows[0].id,
      submittedEmail: subRows[0].email,
      submittedPassword: row.password,
      userId,
      userName: user?.name ?? null,
      userEmail: null,
      pricePaid: price,
    }).catch(() => {});

    clearSession(chatId);
    await sendMessage(chatId,
      `✅ <b>ሰብሚሽን ተቀብሏል!</b>\n\n📧 ኢሜይል: <code>${subRows[0].email}</code>\n` +
      `💰 ዋጋ: <b>${price} ETB</b> (ሲጸድቅ ይታከላል)\n\n⏳ ሲጸድቅ ወዲያው ትነገርለህ!`,
      mainMenu(true)
    );
    return;
  }

  // Unknown button
  await sendMessage(chatId, buildClaimedEmailMessage(row), genEmailClaimedKeyboard(row.email_opened));
}

async function handleWithdrawMethod(chatId: string, text: string): Promise<void> {
  if (text === "📱 ቴሌብር") {
    setSession(chatId, { step: "await_withdraw_amount", tempWithdrawMethod: "telebirr" });
    await sendMessage(chatId, "💸 ምን ያህል ETB ወጪ ማድረግ ትፈልጋለህ? (ቢያንስ 50 ETB):", cancelKeyboard());
  } else if (text === "🏦 ባንክ") {
    setSession(chatId, { step: "await_withdraw_amount", tempWithdrawMethod: "bank" });
    await sendMessage(chatId, "💸 ምን ያህል ETB ወጪ ማድረግ ትፈልጋለህ? (ቢያንስ 50 ETB):", cancelKeyboard());
  } else {
    await sendMessage(chatId, "📱 ቴሌብር ወይም 🏦 ባንክ ምረጥ:");
  }
}

async function handleWithdrawAmount(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const amount = parseInt(text, 10);
  if (isNaN(amount) || amount < 50) { await sendMessage(chatId, "❌ ቢያንስ 50 ETB ያስገባ:"); return; }
  const [user] = await db.select({ walletBalance: usersTable.walletBalance }).from(usersTable).where(eq(usersTable.id, session.userId!));
  if (!user || user.walletBalance < amount) {
    clearSession(chatId);
    await sendMessage(chatId, `❌ በቂ ቦርሳ የለህም። ቦርሳህ: <b>${user?.walletBalance ?? 0} ETB</b>`, mainMenu(true));
    return;
  }
  setSession(chatId, { tempWithdrawAmount: amount });
  if (session.tempWithdrawMethod === "telebirr") {
    setSession(chatId, { step: "await_withdraw_telebirr_number" });
    await sendMessage(chatId, "📱 የቴሌብር ስልክ ቁጥርህን ያስገባ (ምሳሌ: 0912345678):");
  } else {
    setSession(chatId, { step: "await_withdraw_bank_name" });
    await sendMessage(chatId, "🏦 የባንክ ስምህን ያስገባ (ምሳሌ: CBE, Awash, Abyssinia):");
  }
}

async function handleWithdrawTelebirrNumber(chatId: string, text: string): Promise<void> {
  const num = text.trim().replace(/\s/g, "");
  if (!/^0[79]\d{8}$/.test(num) && !/^\+2519\d{8}$/.test(num)) {
    await sendMessage(chatId, "❌ ትክክለኛ ስልክ ቁጥር ያስገባ (ምሳሌ: 0912345678):"); return;
  }
  setSession(chatId, { step: "await_withdraw_telebirr_name", tempWithdrawTelebirrNumber: num });
  await sendMessage(chatId, "👤 ሙሉ ስምህን (በቴሌብር ላይ ያለ) ያስገባ:");
}

async function handleWithdrawTelebirrName(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  if (text.trim().length < 2) { await sendMessage(chatId, "❌ ትክክለኛ ስም ያስገባ:"); return; }
  await finalizeWithdrawal(chatId, {
    userId: session.userId!, amount: session.tempWithdrawAmount!, paymentMethod: "telebirr",
    telebirrNumber: session.tempWithdrawTelebirrNumber!, telebirrName: text.trim(),
  });
}

async function handleWithdrawBankName(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_withdraw_bank_account_number", tempWithdrawBankName: text.trim() });
  await sendMessage(chatId, "💳 የባንክ አካውንት ቁጥርህን ያስገባ:");
}

async function handleWithdrawBankAccountNumber(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_withdraw_bank_account_name", tempWithdrawBankAccountNumber: text.trim() });
  await sendMessage(chatId, "👤 ሙሉ ስምህን (በባንክ ላይ ያለ) ያስገባ:");
}

async function handleWithdrawBankAccountName(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  if (text.trim().length < 2) { await sendMessage(chatId, "❌ ትክክለኛ ስም ያስገባ:"); return; }
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
    clearSession(chatId); await sendMessage(chatId, `❌ በቂ ቦርሳ የለህም።`, mainMenu(true)); return;
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
    ? `📱 ቴሌብር: <code>${data.telebirrNumber}</code>`
    : `🏦 ባንክ: ${data.bankName} — <code>${data.bankAccountNumber}</code>`;
  await sendMessage(chatId,
    `✅ <b>የወጪ ጥያቄ ተቀብሏል!</b>\n\n💰 መጠን: <b>${data.amount} ETB</b>\n${payInfo}\n\n⏳ አድሚን ሲያጸድቀው ትነገርለሃለህ!`,
    mainMenu(true)
  );
}

async function handleAdminPassword(chatId: string, text: string): Promise<void> {
  const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "mailtrade@admin2024";
  const [row] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "admin_password_hash"));
  let valid = row ? await bcrypt.compare(text, row.value) : text === DEFAULT_ADMIN_PASSWORD;
  if (!valid) {
    clearSession(chatId);
    const s = getSession(chatId);
    await sendMessage(chatId, "❌ ፓስወርድ ትክክል አይደለም።", mainMenu(!!s.userId));
    return;
  }
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `🔐 <b>አድሚን ፓነል</b>\n\nእንኳን ደህና መጡ!`, adminMenu());
}

async function handleAdminMessage(chatId: string, text: string, session: ReturnType<typeof getSession>): Promise<void> {
  switch (text) {
    case "⏳ ጠቅላላ ሁኔታ": await showAdminStats(chatId); break;
    case "📬 ሰብሚሽኖች": await showAdminSubmissions(chatId); break;
    case "✅ አጸድቅ":
      setSession(chatId, { step: "await_admin_approve_id" });
      await sendMessage(chatId, "✅ የሚጸድቀው ሰብሚሽን ID ያስገባ:", cancelKeyboard()); break;
    case "❌ ውደቅ":
      setSession(chatId, { step: "await_admin_reject_id" });
      await sendMessage(chatId, "❌ የሚወደቀው ሰብሚሽን ID ያስገባ:", cancelKeyboard()); break;
    case "💸 የወጪ ጥያቄዎች": await showAdminWithdrawals(chatId); break;
    case "💳 ወጪ አስተዳድር":
      setSession(chatId, { step: "await_admin_withdrawal_id" });
      await sendMessage(chatId, "💳 የወጪ ID ያስገባ:", cancelKeyboard()); break;
    case "👥 ዩዘሮች": await showAdminUsers(chatId); break;
    case "🚫 ዩዘር ታጠቅ/ፍታ":
      setSession(chatId, { step: "await_admin_ban_id" });
      await sendMessage(chatId, "🚫 የሚታጠቀው/የሚፈታው ዩዘር ID ያስገባ:", cancelKeyboard()); break;
    case "📢 ብሮድካስት":
      setSession(chatId, { step: "await_admin_broadcast_title" });
      await sendMessage(chatId, "📢 የብሮድካስት ርዕስ ያስገባ:", cancelKeyboard()); break;
    case "⚙️ ቅንብሮች": await showAdminSettings(chatId); break;
    case "💰 ዋጋ ቀይር":
      setSession(chatId, { step: "await_admin_settings_price" });
      await sendMessage(chatId, "💰 አዲሱ ዋጋ በETB ያስገባ:", cancelKeyboard()); break;
    case "📊 ኮሚሽን ቀይር":
      setSession(chatId, { step: "await_admin_settings_commission" });
      await sendMessage(chatId, "📊 አዲሱ ሪፈራል ኮሚሽን % ያስገባ (ምሳሌ: 10):", cancelKeyboard()); break;
    case "🔑 ፓስወርድ ቀይር":
      setSession(chatId, { step: "await_admin_new_password" });
      await sendMessage(chatId, "🔑 አዲሱ አድሚን ፓስወርድ ያስገባ (ቢያንስ 8 ፊደል):", cancelKeyboard()); break;
    case "📤 ኤክስፖርት": await showAdminExport(chatId); break;
    case "📋 ሁሉም ሰብሚሽን": await exportData(chatId, "submissions"); break;
    case "✅ ጸድቆ ሰብሚሽን": await exportData(chatId, "approved-submissions"); break;
    case "💸 ወጪዎች ኤክስፖርት": await exportData(chatId, "withdrawals"); break;
    case "👥 ዩዘሮች ኤክስፖርት": await exportData(chatId, "users"); break;
    case "🚪 ወደ ዩዘር ሂድ":
      setSession(chatId, { step: "idle", isAdmin: false });
      await sendMessage(chatId, "👤 ወደ ዩዘር ምናሌ ተመልሰሃል።", mainMenu(!!session.userId)); break;
    case "🚪 ወደ ምናሌ":
      setSession(chatId, { step: "admin_idle", isAdmin: true });
      await sendMessage(chatId, "🔐 አድሚን ፓነል:", adminMenu()); break;
    default:
      await sendMessage(chatId, "ምናሌ ተጠቀም:", adminMenu());
  }
}

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
    `⏳ <b>ጠቅላላ ሁኔታ</b>\n\n👥 ዩዘሮች: <b>${userCount.count}</b> (${userCount.botUsers} ቦቱ ላይ)\n\n📬 ሰብሚሽኖች:\n• ጠቅላላ: ${subStats.total}\n• ⏳ ጠብቋቸው: ${subStats.pending}\n• ✅ ጸድቋቸው: ${subStats.approved}\n• 💰 ጠቅላላ ክፍያ: ${subStats.totalPayout} ETB\n\n💸 ⏳ ጠቅቷቸው ወጪ: <b>${wdStats.pending}</b>`,
    adminMenu()
  );
}

async function showAdminSubmissions(chatId: string): Promise<void> {
  const rows = await db.select({
    id: submissionsTable.id, userName: usersTable.name,
    email: submissionsTable.email, password: submissionsTable.password,
    status: submissionsTable.status, pricePaid: submissionsTable.pricePaid,
  }).from(submissionsTable).leftJoin(usersTable, eq(submissionsTable.userId, usersTable.id))
    .where(eq(submissionsTable.status, "pending")).orderBy(submissionsTable.createdAt).limit(10);

  if (rows.length === 0) { await sendMessage(chatId, "✅ ምንም ጠቅቷቸው ሰብሚሽን የለም!", adminMenu()); return; }

  const lines = rows.map((r) =>
    `🆔 <b>#${r.id}</b> | 👤 ${r.userName ?? "?"}\n📧 <code>${r.email}</code>\n🔑 <code>${r.password}</code>\n💰 ${r.pricePaid} ETB`
  );
  await sendMessage(chatId,
    `📬 <b>ጠቅቷቸው ሰብሚሽኖች (${rows.length})</b>\n\n${lines.join("\n\n─────────────────\n\n")}`,
    { reply_markup: { keyboard: [[{ text: "✅ አጸድቅ" }, { text: "❌ ውደቅ" }], [{ text: "📬 ሰብሚሽኖች" }, { text: "🚪 ወደ ምናሌ" }]], resize_keyboard: true } }
  );
}

async function handleAdminApproveId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ ትክክለኛ ID ያስገባ:"); return; }
  const [existing] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!existing) { await sendMessage(chatId, `❌ ሰብሚሽን #${id} አልተገኘም:`); return; }
  if (existing.status === "approved") {
    setSession(chatId, { step: "admin_idle", isAdmin: true });
    await sendMessage(chatId, `ℹ️ ሰብሚሽን #${id} አስቀድሞ ጸድቋል:`, adminMenu()); return;
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
  await sendMessage(chatId, `✅ ሰብሚሽን #${id} ጸድቋል! <b>${existing.pricePaid} ETB</b> ለዩዘሩ ተጨምሯል።`, adminMenu());
}

async function handleAdminRejectId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ ትክክለኛ ID ያስገባ:"); return; }
  const [existing] = await db.select({ id: submissionsTable.id }).from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!existing) { await sendMessage(chatId, `❌ ሰብሚሽን #${id} አልተገኘም:`); return; }
  setSession(chatId, { step: "await_admin_reject_note", tempRejectId: id });
  await sendMessage(chatId, `❌ ሰብሚሽን #${id} ለምን ትውድቀዋለህ?\n(ምክንያት ያስገባ ወይም <b>ዝለል</b> ተጫን)`,
    { reply_markup: { keyboard: [[{ text: "ዝለል" }], [{ text: "❌ ሰርዝ" }]], resize_keyboard: true } }
  );
}

async function handleAdminRejectNote(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const id = session.tempRejectId!;
  const note = text === "ዝለል" ? null : text.trim();
  const [existing] = await db.select().from(submissionsTable).where(eq(submissionsTable.id, id));
  if (!existing) { setSession(chatId, { step: "admin_idle", isAdmin: true }); await sendMessage(chatId, "❌ አልተገኘም:", adminMenu()); return; }
  const [owner] = await db.select({ telegramChatId: usersTable.telegramChatId }).from(usersTable).where(eq(usersTable.id, existing.userId));
  if (existing.status === "approved") {
    await db.update(usersTable).set({ walletBalance: sql`${usersTable.walletBalance} - ${existing.pricePaid}` }).where(eq(usersTable.id, existing.userId));
  }
  await db.execute(sql`UPDATE generated_emails SET status = 'available', claimed_by = NULL, claimed_at = NULL, email_opened = FALSE WHERE lower(email) = lower(${existing.email}) AND status = 'submitted'`);
  await db.update(submissionsTable).set({ status: "rejected", rejectionNote: note }).where(eq(submissionsTable.id, id));
  notifySubmissionRejected(owner?.telegramChatId, existing.email).catch(() => {});
  setSession(chatId, { step: "admin_idle", isAdmin: true, tempRejectId: undefined });
  await sendMessage(chatId, `❌ ሰብሚሽን #${id} ውድቋል${note ? `: ${note}` : "."}`, adminMenu());
}

async function showAdminWithdrawals(chatId: string): Promise<void> {
  const rows = await db.select({
    id: withdrawalsTable.id, userName: usersTable.name, amount: withdrawalsTable.amount,
    paymentMethod: withdrawalsTable.paymentMethod, telebirrNumber: withdrawalsTable.telebirrNumber,
    telebirrName: withdrawalsTable.telebirrName, bankName: withdrawalsTable.bankName,
    bankAccountNumber: withdrawalsTable.bankAccountNumber, bankAccountName: withdrawalsTable.bankAccountName,
    status: withdrawalsTable.status,
  }).from(withdrawalsTable).leftJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .where(eq(withdrawalsTable.status, "pending")).orderBy(withdrawalsTable.createdAt).limit(10);

  if (rows.length === 0) { await sendMessage(chatId, "✅ ምንም ጠቅቷቸው ወጪ የለም!", adminMenu()); return; }

  const lines = rows.map((r) => {
    const payInfo = r.paymentMethod === "telebirr"
      ? `📱 ቴሌብር: <code>${r.telebirrNumber}</code> (${r.telebirrName})`
      : `🏦 ${r.bankName}: <code>${r.bankAccountNumber}</code> (${r.bankAccountName})`;
    return `🆔 <b>#${r.id}</b> | 👤 ${r.userName ?? "?"}\n💰 ${r.amount} ETB\n${payInfo}`;
  });
  await sendMessage(chatId,
    `💸 <b>ጠቅቷቸው ወጪዎች (${rows.length})</b>\n\n${lines.join("\n\n─────────────────\n\n")}`,
    { reply_markup: { keyboard: [[{ text: "💳 ወጪ አስተዳድር" }, { text: "💸 የወጪ ጥያቄዎች" }], [{ text: "🚪 ወደ ምናሌ" }]], resize_keyboard: true } }
  );
}

async function handleAdminWithdrawalId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ ትክክለኛ ID ያስገባ:"); return; }
  const [existing] = await db.select({ id: withdrawalsTable.id, amount: withdrawalsTable.amount, status: withdrawalsTable.status }).from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!existing) { await sendMessage(chatId, `❌ ወጪ #${id} አልተገኘም:`); return; }
  setSession(chatId, { step: "await_admin_withdrawal_action", tempWithdrawalId: id });
  await sendMessage(chatId, `💳 ወጪ #${id} — <b>${existing.amount} ETB</b> (${existing.status})\n\nምን ማድረግ ትፈልጋለህ?`,
    { reply_markup: { keyboard: [[{ text: "✅ ተፈጻሚ" }, { text: "❌ ውደቅ" }], [{ text: "❌ ሰርዝ" }]], resize_keyboard: true } }
  );
}

async function handleAdminWithdrawalAction(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const id = session.tempWithdrawalId!;
  const [existing] = await db.select().from(withdrawalsTable).where(eq(withdrawalsTable.id, id));
  if (!existing) { setSession(chatId, { step: "admin_idle", isAdmin: true }); await sendMessage(chatId, "❌ አልተገኘም:", adminMenu()); return; }
  const [owner] = await db.select({ telegramChatId: usersTable.telegramChatId }).from(usersTable).where(eq(usersTable.id, existing.userId));

  if (text === "✅ ተፈጻሚ") {
    await db.update(withdrawalsTable).set({ status: "completed" }).where(eq(withdrawalsTable.id, id));
    notifyWithdrawalCompleted(owner?.telegramChatId, existing.amount, existing.telebirrNumber).catch(() => {});
    setSession(chatId, { step: "admin_idle", isAdmin: true, tempWithdrawalId: undefined });
    await sendMessage(chatId, `✅ ወጪ #${id} ተፈጻሚ! <b>${existing.amount} ETB</b> ተልኳል።`, adminMenu());
  } else if (text === "❌ ውደቅ") {
    await db.update(usersTable).set({ walletBalance: sql`${usersTable.walletBalance} + ${existing.amount}` }).where(eq(usersTable.id, existing.userId));
    await db.update(withdrawalsTable).set({ status: "rejected" }).where(eq(withdrawalsTable.id, id));
    notifyWithdrawalRejected(owner?.telegramChatId, existing.amount, null).catch(() => {});
    setSession(chatId, { step: "admin_idle", isAdmin: true, tempWithdrawalId: undefined });
    await sendMessage(chatId, `❌ ወጪ #${id} ውድቋል! <b>${existing.amount} ETB</b> ወደ ቦርሳ ተመልሷል።`, adminMenu());
  } else {
    await sendMessage(chatId, "✅ ተፈጻሚ ወይም ❌ ውደቅ ምረጥ:");
  }
}

async function showAdminUsers(chatId: string): Promise<void> {
  const users = await db.select({
    id: usersTable.id, name: usersTable.name, walletBalance: usersTable.walletBalance, isBanned: usersTable.isBanned,
  }).from(usersTable).orderBy(desc(usersTable.createdAt)).limit(15);

  const lines = users.map((u) => `🆔 #${u.id} | ${u.isBanned ? "🚫" : "✅"} <b>${u.name ?? "?"}</b> — ${u.walletBalance} ETB`);
  await sendMessage(chatId, `👥 <b>ዩዘሮች (የቅርቡ 15)</b>\n\n${lines.join("\n")}`,
    { reply_markup: { keyboard: [[{ text: "🚫 ዩዘር ታጠቅ/ፍታ" }, { text: "👥 ዩዘሮች" }], [{ text: "🚪 ወደ ምናሌ" }]], resize_keyboard: true } }
  );
}

async function handleAdminBanId(chatId: string, text: string): Promise<void> {
  const id = parseInt(text, 10);
  if (isNaN(id)) { await sendMessage(chatId, "❌ ትክክለኛ ID ያስገባ:"); return; }
  const [user] = await db.select({ name: usersTable.name, isBanned: usersTable.isBanned }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { await sendMessage(chatId, `❌ ዩዘር #${id} አልተገኘም:`); return; }
  const newBanned = !user.isBanned;
  await db.update(usersTable).set({ isBanned: newBanned }).where(eq(usersTable.id, id));
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `${newBanned ? "🚫" : "✅"} ዩዘር <b>${user.name}</b> (#${id}) ${newBanned ? "ታጠቀ!" : "ተፈታ!"}`, adminMenu());
}

async function handleAdminBroadcastTitle(chatId: string, text: string): Promise<void> {
  setSession(chatId, { step: "await_admin_broadcast_message", tempBroadcastTitle: text.trim() });
  await sendMessage(chatId, `📢 ርዕስ: <b>${text.trim()}</b>\n\nየብሮድካስት መልዕክት ያስገባ:`, cancelKeyboard());
}

async function handleAdminBroadcastMessage(chatId: string, text: string): Promise<void> {
  const session = getSession(chatId);
  const title = session.tempBroadcastTitle!;
  await db.insert(broadcastsTable).values({ title, message: text.trim() });
  const users = await db.select({ telegramChatId: usersTable.telegramChatId }).from(usersTable);
  const telegramUsers = users.filter((u) => u.telegramChatId);
  await Promise.allSettled(telegramUsers.map((u) => sendBroadcastMessage(u.telegramChatId!, title, text.trim()).catch(() => {})));
  setSession(chatId, { step: "admin_idle", isAdmin: true, tempBroadcastTitle: undefined });
  await sendMessage(chatId, `✅ ብሮድካስት ለ <b>${telegramUsers.length}</b> ዩዘሮች ተልኳል!`, adminMenu());
}

async function showAdminSettings(chatId: string): Promise<void> {
  const price = await getPricePerEmail();
  const commission = await getCommissionPct();
  await sendMessage(chatId, `⚙️ <b>ቅንብሮች</b>\n\n💰 ዋጋ ለኢሜይል: <b>${price} ETB</b>\n📊 ሪፈራል ኮሚሽን: <b>${commission}%</b>`,
    { reply_markup: { keyboard: [[{ text: "💰 ዋጋ ቀይር" }, { text: "📊 ኮሚሽን ቀይር" }], [{ text: "🔑 ፓስወርድ ቀይር" }, { text: "🚪 ወደ ምናሌ" }]], resize_keyboard: true } }
  );
}

async function handleAdminSettingsPrice(chatId: string, text: string): Promise<void> {
  const price = parseInt(text, 10);
  if (isNaN(price) || price < 1) { await sendMessage(chatId, "❌ ትክክለኛ ዋጋ ያስገባ:"); return; }
  await db.insert(settingsTable).values({ key: "price_per_email", value: String(price) }).onConflictDoUpdate({ target: settingsTable.key, set: { value: String(price) } });
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `✅ ዋጋ ወደ <b>${price} ETB</b> ተቀይሯል!`, adminMenu());
}

async function handleAdminSettingsCommission(chatId: string, text: string): Promise<void> {
  const pct = parseInt(text, 10);
  if (isNaN(pct) || pct < 0 || pct > 100) { await sendMessage(chatId, "❌ ትክክለኛ % ያስገባ (0-100):"); return; }
  await db.insert(settingsTable).values({ key: "referral_commission_pct", value: String(pct) }).onConflictDoUpdate({ target: settingsTable.key, set: { value: String(pct) } });
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, `✅ ሪፈራል ኮሚሽን ወደ <b>${pct}%</b> ተቀይሯል!`, adminMenu());
}

async function handleAdminNewPassword(chatId: string, text: string): Promise<void> {
  if (text.length < 8) { await sendMessage(chatId, "❌ ፓስወርድ ቢያንስ 8 ፊደል ሊሆን ይገባል:"); return; }
  const hash = await bcrypt.hash(text, 10);
  await db.insert(settingsTable).values({ key: "admin_password_hash", value: hash }).onConflictDoUpdate({ target: settingsTable.key, set: { value: hash } });
  setSession(chatId, { step: "admin_idle", isAdmin: true });
  await sendMessage(chatId, "✅ አድሚን ፓስወርድ ተቀይሯል!", adminMenu());
}

async function showAdminExport(chatId: string): Promise<void> {
  await sendMessage(chatId, "📤 <b>ኤክስፖርት</b>\n\nምን ኤክስፖርት ማድረግ ትፈልጋለህ?",
    {
      reply_markup: {
        keyboard: [
          [{ text: "📋 ሁሉም ሰብሚሽን" }, { text: "✅ ጸድቆ ሰብሚሽን" }],
          [{ text: "💸 ወጪዎች ኤክስፖርት" }, { text: "👥 ዩዘሮች ኤክስፖርት" }],
          [{ text: "🚪 ወደ ምናሌ" }],
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
    if (!filtered.length) { await sendMessage(chatId, "❌ ምንም ዳታ የለም:", adminMenu()); return; }
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
    if (!rows.length) { await sendMessage(chatId, "❌ ምንም ዳታ የለም:", adminMenu()); return; }
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
    if (!users.length) { await sendMessage(chatId, "❌ ምንም ዳታ የለም:", adminMenu()); return; }
    csv = toCSV(["ID", "Name", "Email", "Wallet(ETB)", "Banned", "Joined"],
      users.map((u) => [u.id, u.name ?? "", u.email ?? "", u.walletBalance, u.isBanned ? "Yes" : "No", new Date(u.createdAt).toISOString().slice(0, 16)]));
    filename = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    caption = `👥 <b>Users Export</b>\n${users.length} records`;
  }

  const result = await sendDocumentToAdmin(filename, csv, caption);
  if (result.ok) {
    await sendMessage(chatId, `✅ <b>${filename}</b> ለአድሚን ቴሌግራም ተልኳል!`, adminMenu());
  } else {
    await sendMessage(chatId, `❌ ኤክስፖርት አልተሳካም: ${result.error}`, adminMenu());
  }
}

export async function notifySubmissionApproved(chatId: string | null | undefined, email: string, amount: number): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `✅ <b>አካውንት ጸድቋል!</b>\n\n📧 ኢሜይል: <code>${email}</code>\n💰 ክፍያ: <b>${amount} ETB</b> ወደ ቦርሳህ ተጨምሯል!\n\n📊 ቦርሳ ለማየት <b>📊 መረጃዬ</b> ተጫን:`);
}

export async function notifySubmissionRejected(chatId: string | null | undefined, email: string): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `❌ <b>አካውንት አልጸደቀም</b>\n\n📧 ኢሜይል: <code>${email}</code>\n\nምክንያቱ ትክክለኛ ምስክር ወረቀት አለመቅረቡ ሊሆን ይችላል። ሌላ አካውንት ሊያቀርቡ ይችላሉ።`);
}

export async function notifyWithdrawalCompleted(chatId: string | null | undefined, amount: number, telebirrNumber: string): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `💸 <b>ክፍያ ተልኳል!</b>\n\n💰 መጠን: <b>${amount} ETB</b>\n📱 ቁጥር: <code>${telebirrNumber}</code>`);
}

export async function notifyWithdrawalRejected(chatId: string | null | undefined, amount: number, note?: string | null): Promise<void> {
  if (!chatId) return;
  await sendMessage(chatId, `❌ <b>የወጪ ጥያቄ አልተቀበለም</b>\n\n💰 መጠን: <b>${amount} ETB</b> ወደ ቦርሳህ ተመልሷል።${note ? `\n📝 ምክንያት: ${note}` : ""}`);
}

export async function notifyAdminNewSubmission(opts: {
  submissionId: number; submittedEmail: string; submittedPassword: string;
  userId: number; userName: string | null; userEmail: string | null; pricePaid: number;
}): Promise<void> {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;
  const userLabel = opts.userName ?? opts.userEmail ?? `ID: ${opts.userId}`;
  await sendMessage(adminChatId,
    `📬 <b>አዲስ ሰብሚሽን #${opts.submissionId}</b>\n\n👤 <b>ዩዘር:</b> ${userLabel}\n📧 <b>ኢሜይል:</b> <code>${opts.submittedEmail}</code>\n🔑 <b>ፓስወርድ:</b> <code>${opts.submittedPassword}</code>\n💰 <b>ዋጋ:</b> ${opts.pricePaid} ETB\n⏰ ${new Date().toLocaleString("am-ET", { timeZone: "Africa/Addis_Ababa" })}`
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
