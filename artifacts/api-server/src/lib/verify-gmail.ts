export type GmailVerifyResult =
  | { verified: true }
  | { verified: false; reason: "not_registered" | "network_error" };

/**
 * Gmail existence verification from cloud servers (GCP, AWS, Azure, etc.) is
 * blocked by Google at the network level:
 *
 *  - SMTP RCPT TO (port 25): Gmail returns 550 for ALL addresses from cloud
 *    IPs — both real and fake accounts get the same "NoSuchUser" response.
 *  - GXLU endpoint (mail.google.com/mail/gxlu): returns HTTP 204 for every
 *    address regardless of existence.
 *  - Google sign-in identifier API: returns 405 / 400 for server-side calls.
 *
 * Because there is no reliable way to distinguish a real Gmail account from a
 * fake one from a cloud environment without a paid email-verification API,
 * this function always returns { verified: false, reason: "network_error" }
 * so the calling code falls through to the admin-review gate instead of
 * blocking legitimate submissions.
 *
 * To enable real verification in the future, replace this stub with a call to
 * a service such as AbstractAPI, Hunter.io, or ZeroBounce (free tiers
 * available) and set the key via the GMAIL_VERIFY_API_KEY environment
 * variable.
 */
export async function verifyGmailExists(
  _email: string,
  _timeoutMs = 15000
): Promise<GmailVerifyResult> {
  return { verified: false, reason: "network_error" };
}

/**
 * Legacy alias — keeps existing call-sites compiling.
 */
export async function verifyGmailAccount(
  email: string,
  _password: string,
  timeoutMs = 15000
): Promise<GmailVerifyResult> {
  return verifyGmailExists(email, timeoutMs);
}
