import net from "net";

export type GmailVerifyResult =
  | { verified: true }
  | { verified: false; reason: "not_registered" | "network_error" };

/**
 * Checks whether a Gmail address exists by probing Gmail's inbound MX server
 * via a raw SMTP RCPT TO handshake. No email is ever sent.
 *
 * Flow: connect → read 220 banner → EHLO → MAIL FROM:<> → RCPT TO:<email> → QUIT
 *
 * Response codes:
 *   250        → account exists
 *   550/551/553 → account does not exist (not_registered)
 *   timeout / connection error / other → network_error (caller should allow)
 */
export async function verifyGmailExists(
  email: string,
  timeoutMs = 10000
): Promise<GmailVerifyResult> {
  return new Promise((resolve) => {
    let settled = false;

    const settle = (result: GmailVerifyResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(result);
    };

    const timer = setTimeout(
      () => settle({ verified: false, reason: "network_error" }),
      timeoutMs
    );

    const socket = net.createConnection({
      host: "gmail-smtp-in.l.google.com",
      port: 25,
    });

    let buffer = "";
    let stage: "banner" | "ehlo" | "mailfrom" | "rcptto" | "done" = "banner";

    const send = (line: string) => {
      try { socket.write(line + "\r\n"); } catch { /* ignore */ }
    };

    socket.on("error", () => settle({ verified: false, reason: "network_error" }));
    socket.on("timeout", () => settle({ verified: false, reason: "network_error" }));

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();

      const lines = buffer.split("\r\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.slice(0, 3), 10);
        if (isNaN(code)) continue;

        const isFinalLine = line[3] !== "-";
        if (!isFinalLine) continue;

        switch (stage) {
          case "banner":
            if (code === 220) {
              stage = "ehlo";
              send("EHLO smtp.verify.check");
            } else {
              settle({ verified: false, reason: "network_error" });
            }
            break;

          case "ehlo":
            if (code === 250) {
              stage = "mailfrom";
              send("MAIL FROM:<>");
            } else {
              settle({ verified: false, reason: "network_error" });
            }
            break;

          case "mailfrom":
            if (code === 250) {
              stage = "rcptto";
              send(`RCPT TO:<${email}>`);
            } else {
              settle({ verified: false, reason: "network_error" });
            }
            break;

          case "rcptto":
            stage = "done";
            send("QUIT");
            if (code === 250) {
              settle({ verified: true });
            } else if (code === 550 || code === 551 || code === 553) {
              settle({ verified: false, reason: "not_registered" });
            } else {
              settle({ verified: false, reason: "network_error" });
            }
            break;
        }
      }
    });
  });
}

/**
 * Legacy alias — keeps existing call-sites in generated-emails.ts compiling
 * without requiring a password argument. The password is ignored.
 */
export async function verifyGmailAccount(
  email: string,
  _password: string,
  timeoutMs = 10000
): Promise<GmailVerifyResult> {
  return verifyGmailExists(email, timeoutMs);
}
