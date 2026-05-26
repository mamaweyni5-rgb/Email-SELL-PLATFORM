import { pool } from "./index";

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        email       TEXT NOT NULL UNIQUE,
        name        TEXT,
        password_hash TEXT NOT NULL,
        wallet_balance INTEGER NOT NULL DEFAULT 0,
        referral_code  TEXT UNIQUE,
        referred_by    INTEGER,
        commission_earned INTEGER NOT NULL DEFAULT 0,
        telegram_chat_id  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS submissions (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL,
        email      TEXT NOT NULL UNIQUE,
        password   TEXT NOT NULL,
        status     TEXT NOT NULL DEFAULT 'pending',
        price_paid INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS withdrawals (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER NOT NULL,
        amount          INTEGER NOT NULL,
        telebirr_number TEXT NOT NULL,
        telebirr_name   TEXT NOT NULL,
        status          TEXT NOT NULL DEFAULT 'pending',
        admin_note      TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id         SERIAL PRIMARY KEY,
        key        TEXT NOT NULL UNIQUE,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id         SERIAL PRIMARY KEY,
        title      TEXT NOT NULL,
        message    TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
    `);
    await client.query(`
      ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    `);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'users' AND indexname = 'users_name_unique'
        ) THEN
          CREATE UNIQUE INDEX users_name_unique ON users (name) WHERE name IS NOT NULL;
        END IF;
      END$$;
    `);

    await client.query(`
      ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'telebirr';
      ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS bank_name TEXT;
      ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS bank_account_number TEXT;
      ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS bank_account_name TEXT;
      ALTER TABLE withdrawals ALTER COLUMN telebirr_number SET DEFAULT '';
      ALTER TABLE withdrawals ALTER COLUMN telebirr_name SET DEFAULT '';
    `);

    await client.query(`
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS rejection_note TEXT;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id),
        from_admin  BOOLEAN NOT NULL DEFAULT FALSE,
        body        TEXT NOT NULL,
        is_read     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_joined BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS generated_emails (
        id          SERIAL PRIMARY KEY,
        email       TEXT NOT NULL UNIQUE,
        password    TEXT NOT NULL,
        status      TEXT NOT NULL DEFAULT 'available',
        claimed_by  INTEGER REFERENCES users(id),
        claimed_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      ALTER TABLE generated_emails ADD COLUMN IF NOT EXISTS name TEXT;
    `);

    await client.query(`
      ALTER TABLE generated_emails ADD COLUMN IF NOT EXISTS email_opened BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query(`
      ALTER TABLE submissions ADD COLUMN IF NOT EXISTS recovery_email TEXT;
    `);
  } finally {
    client.release();
  }
}
