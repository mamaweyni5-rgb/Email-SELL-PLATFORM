export type GmailVerifyResult =
  | { verified: true }
  | { verified: false; reason: "not_registered" | "network_error" };

/**
 * Verifies whether a Gmail address exists using the AbstractAPI
 * Email Validation service (emailvalidation.abstractapi.com).
 *
 * Requires the ABSTRACT_API_EMAIL_KEY environment variable.
 * If the key is missing or the API call fails, falls back to
 * { verified: false, reason: "network_error" } so legitimate
 * submissions are never blocked by an infrastructure failure.
 *
 * AbstractAPI free tier: 100 requests / month.
 * Upgrade at https://www.abstractapi.com/api/email-validation-verification-api
 */
export async function verifyGmailExists(
  email: string,
  timeoutMs = 15000
): Promise<GmailVerifyResult> {
  const apiKey = process.env.ABSTRACT_API_EMAIL_KEY;

  if (!apiKey) {
    return { verified: false, reason: "network_error" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `https://emailvalidation.abstractapi.com/v1/?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`;

    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) {
      return { verified: false, reason: "network_error" };
    }

    const data = (await res.json()) as {
      deliverability?: string;
      is_smtp_valid?: { value: boolean };
      is_valid_format?: { value: boolean };
    };

    // Format must be valid first
    if (data.is_valid_format?.value === false) {
      return { verified: false, reason: "not_registered" };
    }

    // Primary signal: deliverability
    if (data.deliverability === "UNDELIVERABLE") {
      return { verified: false, reason: "not_registered" };
    }

    if (data.deliverability === "DELIVERABLE") {
      return { verified: true };
    }

    // Fallback: SMTP validity check
    if (data.is_smtp_valid?.value === false) {
      return { verified: false, reason: "not_registered" };
    }

    if (data.is_smtp_valid?.value === true) {
      return { verified: true };
    }

    // UNKNOWN deliverability — allow through rather than block a real user
    return { verified: false, reason: "network_error" };
  } catch {
    return { verified: false, reason: "network_error" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Legacy alias — keeps existing call-sites compiling.
 * Password is not used; only email existence is checked.
 */
export async function verifyGmailAccount(
  email: string,
  _password: string,
  timeoutMs = 15000
): Promise<GmailVerifyResult> {
  return verifyGmailExists(email, timeoutMs);
}
