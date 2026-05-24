import { ImapFlow } from "imapflow";

export type GmailVerifyResult =
  | { verified: true }
  | { verified: false; reason: "not_registered" | "network_error" };

/**
 * Tries to authenticate to Gmail IMAP with the given credentials.
 * - verified = true  → account exists and password is correct (was registered)
 * - not_registered   → auth failed (account not created or wrong password)
 * - network_error    → could not reach Google (allow submission retry)
 */
export async function verifyGmailAccount(
  email: string,
  password: string,
  timeoutMs = 12000
): Promise<GmailVerifyResult> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
    tls: { rejectUnauthorized: true },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });

  const timer = setTimeout(() => {
    try { client.close(); } catch { /* ignore */ }
  }, timeoutMs);

  try {
    await client.connect();
    await client.logout();
    return { verified: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isAuthErr =
      msg.includes("Authentication failed") ||
      msg.includes("AUTHENTICATIONFAILED") ||
      msg.includes("Invalid credentials") ||
      msg.includes("Username and Password not accepted") ||
      msg.includes("NO [AUTHENTICATIONFAILED]");
    if (isAuthErr) return { verified: false, reason: "not_registered" };
    return { verified: false, reason: "network_error" };
  } finally {
    clearTimeout(timer);
    try { client.close(); } catch { /* ignore */ }
  }
}
