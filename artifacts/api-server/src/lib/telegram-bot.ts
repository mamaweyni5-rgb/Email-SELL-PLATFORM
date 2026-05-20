const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendMessage(chatId: string, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch {}
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
