import app from "./app";
import { logger } from "./lib/logger";
import { setupWebhook } from "./lib/telegram-bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const domain = domains.split(",")[0]?.trim();
    if (domain) {
      const webhookUrl = `https://${domain}/api/telegram/webhook`;
      setupWebhook(webhookUrl).catch((e) =>
        logger.warn({ err: e }, "Webhook setup error")
      );
    }
  }
});
