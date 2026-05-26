export type BotStep =
  | "idle"
  | "await_register_name"
  | "await_register_password"
  | "await_register_confirm_password"
  | "await_register_referral"
  | "await_login_name"
  | "await_login_password"
  | "await_submit_email"
  | "await_submit_password"
  | "await_withdraw_method"
  | "await_withdraw_amount"
  | "await_withdraw_telebirr_number"
  | "await_withdraw_telebirr_name"
  | "await_withdraw_bank_name"
  | "await_withdraw_bank_account_number"
  | "await_withdraw_bank_account_name"
  | "await_admin_password"
  | "admin_idle"
  | "await_admin_approve_id"
  | "await_admin_reject_id"
  | "await_admin_reject_note"
  | "await_admin_withdrawal_id"
  | "await_admin_withdrawal_action"
  | "await_admin_ban_id"
  | "await_admin_broadcast_title"
  | "await_admin_broadcast_message"
  | "await_admin_settings_price"
  | "await_admin_settings_commission"
  | "await_admin_new_password"
  | "await_admin_email_pool"
  | "gen_email_confirm"
  | "gen_email_view";

export interface BotSession {
  step: BotStep;
  userId?: number;
  tempName?: string;
  tempPassword?: string;
  tempEmail?: string;
  tempWithdrawMethod?: "telebirr" | "bank";
  tempWithdrawAmount?: number;
  tempWithdrawTelebirrNumber?: string;
  tempWithdrawTelebirrName?: string;
  tempWithdrawBankName?: string;
  tempWithdrawBankAccountNumber?: string;
  tempRejectId?: number;
  tempWithdrawalId?: number;
  tempBroadcastTitle?: string;
  isAdmin?: boolean;
}

const sessions = new Map<string, BotSession>();

export function getSession(chatId: string): BotSession {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { step: "idle" });
  }
  return sessions.get(chatId)!;
}

export function setSession(chatId: string, data: Partial<BotSession>): void {
  const existing = getSession(chatId);
  sessions.set(chatId, { ...existing, ...data });
}

export function clearSession(chatId: string): void {
  const existing = getSession(chatId);
  sessions.set(chatId, {
    step: existing.isAdmin ? "admin_idle" : "idle",
    userId: existing.userId,
    isAdmin: existing.isAdmin,
  });
}
