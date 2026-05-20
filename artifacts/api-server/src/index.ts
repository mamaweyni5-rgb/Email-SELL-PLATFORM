import app from "./app";
import { logger } from "./lib/logger";
import { setupWebhook } from "./lib/telegram-bot";
import { runMigrations } from "@workspace/db/migrate";

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

async function start() {
  try {
    await runMigrations();
    logger.info("Database schema ready");
  } catch (err) {
    logger.error({ err }, "Failed to run migrations");
    process.exit(1);
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    const appUrl =
      process.env.APP_URL ??
      (() => {
        const domains = process.env.REPLIT_DOMAINS;
        if (!domains) return null;
        const domain = domains.split(",")[0]?.trim();
        return domain ? `https://${domain}` : null;
      })();

    if (appUrl) {
      const webhookUrl = `${appUrl}/api/telegram/webhook`;
      setupWebhook(webhookUrl).catch((e) =>
        logger.warn({ err: e }, "Webhook setup error")
      );
    } else {
      logger.warn("APP_URL and REPLIT_DOMAINS are not set — webhook setup skipped");
    }
  });
}

start();
