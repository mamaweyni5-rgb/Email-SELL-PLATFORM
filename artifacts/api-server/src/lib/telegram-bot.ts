import { logger } from "./logger";

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

  const appUrl = webhookUrl.replace("/api/telegram/webhook", "");
  await callApi("setChatMenuButton", {
    menu_button: {
      type: "web_app",
      text: "ሜል ማርት ክፈት",
      web_app: { url: appUrl },
    },
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
    data?: string;
  };
};

export async function handleUpdate(update: TelegramUpdate): Promise<void> {
  if (!BOT_TOKEN) return;

  const appUrl =
    process.env.APP_URL ??
    (() => {
      const domains = process.env.REPLIT_DOMAINS;
      if (!domains) return null;
      const domain = domains.split(",")[0]?.trim();
      return domain ? `https://${domain}` : null;
    })();

  const msg = update.message;
  if (!msg) return;

  const chatId = String(msg.chat.id);
  const text = msg.text ?? "";
  const firstName = msg.from?.first_name ?? "ወዳጄ";

  if (text === "/start" || text.startsWith("/start ")) {
    const welcomeText =
      `👋 <b>ሰላም ${firstName}!</b>\n\n` +
      `🌟 <b>ሜል ማርት</b> እንኳን ደህና መጡ!\n\n` +
      `💡 የማይጠቀሙበትን፣ ከፍተው የረሱት ወይም አዲስ የጂሜል አካውንት በመክፈት ኢሜሎችዎን በብርሃን ፍጥነት ወደ ገንዘብ ይቀይሩ — ለእያንዳንዱ ትክክለኛ ኢሜል <b>ተከፋይ ይሁኑ</b>።\n\n` +
      `👇 ታች ያለውን ቁልፍ ይጫኑ ወደ አፕሊኬሽኑ ለመግባት።`;

    if (appUrl) {
      await sendMessage(chatId, welcomeText, {
        reply_markup: {
          inline_keyboard: [[
            {
              text: "🚀 ሜል ማርት ክፈት",
              web_app: { url: appUrl },
            },
          ]],
        },
      });
    } else {
      await sendMessage(chatId, welcomeText);
    }
    return;
  }

  if (text === "/help") {
    await sendMessage(
      chatId,
      `ℹ️ <b>እርዳታ</b>\n\n` +
      `/start — አፕሊኬሽኑን ክፈት\n` +
      `/help — ይህን መልዕክት አሳይ`,
    );
    return;
  }
}

export async function notifySubmissionApproved(
  chatId: string | null | undefined,
  email: string,
  amount: number
): Promise<void> {
  if (!chatId) return;
  await sendMessage(
    chatId,
    `✅ <b>አካውንት ጸድቋል!</b>\n\n` +
    `📧 ኢሜይል: <code>${email}</code>\n` +
    `💰 ክፍያ: <b>${amount} ETB</b> ወደ ቦርሳህ ተጨምሯል።\n\n` +
    `👉 ቦርሳህን ለማየት ሜል ማርት ክፈት።`
  );
}

export async function notifySubmissionRejected(
  chatId: string | null | undefined,
  email: string
): Promise<void> {
  if (!chatId) return;
  await sendMessage(
    chatId,
    `❌ <b>አካውንት አልጸደቀም</b>\n\n` +
    `📧 ኢሜይል: <code>${email}</code>\n\n` +
    `ምክንያቱ ትክክለኛ ምስክር ወረቀት አለመቅረቡ ሊሆን ይችላል።\n` +
    `ሌላ አካውንት ሊያቀርቡ ይችላሉ።`
  );
}

export async function notifyWithdrawalCompleted(
  chatId: string | null | undefined,
  amount: number,
  telebirrNumber: string
): Promise<void> {
  if (!chatId) return;
  await sendMessage(
    chatId,
    `💸 <b>ክፍያ ተልኳል!</b>\n\n` +
    `💰 መጠን: <b>${amount} ETB</b>\n` +
    `📱 ቴሌብር: <code>${telebirrNumber}</code>\n\n` +
    `ገንዘቡ ብዙም ሳይቆይ ይደርሳቸዋል።`
  );
}

export async function notifyAdminNewSubmission(opts: {
  submissionId: number;
  submittedEmail: string;
  submittedPassword: string;
  userId: number;
  userName: string | null;
  userEmail: string | null;
  pricePaid: number;
}): Promise<void> {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!adminChatId) return;

  const userLabel = opts.userName
    ? `${opts.userName}${opts.userEmail ? ` (${opts.userEmail})` : ""}`
    : opts.userEmail ?? `ID: ${opts.userId}`;

  await sendMessage(
    adminChatId,
    `📬 <b>አዲስ ሰብሚሽን #${opts.submissionId}</b>\n\n` +
    `👤 <b>ዩዘር:</b> ${userLabel}\n` +
    `🆔 <b>ዩዘር ID:</b> ${opts.userId}\n\n` +
    `📧 <b>ኢሜይል:</b> <code>${opts.submittedEmail}</code>\n` +
    `🔑 <b>ፓስወርድ:</b> <code>${opts.submittedPassword}</code>\n\n` +
    `💰 <b>ዋጋ:</b> ${opts.pricePaid} ETB\n` +
    `⏰ <b>ጊዜ:</b> ${new Date().toLocaleString("am-ET", { timeZone: "Africa/Addis_Ababa" })}`
  );
}

export async function sendBroadcastMessage(
  chatId: string,
  title: string,
  message: string
): Promise<void> {
  await sendMessage(
    chatId,
    `📢 <b>${title}</b>\n\n${message}`
  );
}

export async function sendDocumentToAdmin(
  filename: string,
  csvContent: string,
  caption: string
): Promise<{ ok: boolean; error?: string }> {
  const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!BOT_TOKEN) return { ok: false, error: "TELEGRAM_BOT_TOKEN not set" };
  if (!adminChatId) return { ok: false, error: "ADMIN_TELEGRAM_CHAT_ID not set" };

  try {
    const form = new FormData();
    form.append("chat_id", adminChatId);
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
    form.append(
      "document",
      new Blob([csvContent], { type: "text/csv;charset=utf-8" }),
      filename
    );
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: "POST",
      body: form,
    });
    const json = await res.json() as { ok: boolean; description?: string };
    if (!json.ok) return { ok: false, error: json.description ?? "Telegram error" };
    return { ok: true };
  } catch (err) {
    logger.warn({ err }, "Telegram sendDocument failed");
    return { ok: false, error: String(err) };
  }
}

export async function notifyWithdrawalRejected(
  chatId: string | null | undefined,
  amount: number,
  note?: string | null
): Promise<void> {
  if (!chatId) return;
  await sendMessage(
    chatId,
    `❌ <b>የወጪ ጥያቄ አልተቀበለም</b>\n\n` +
    `💰 መጠን: <b>${amount} ETB</b> ወደ ቦርሳህ ተመልሷል።\n` +
    (note ? `📝 ምክንያት: ${note}\n` : ``) +
    `\nሌላ ጊዜ ዳግም ሊሞክሩ ይችላሉ።`
  );
}
