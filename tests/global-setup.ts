// Creates the venuora_test database (if missing) and applies migrations.
// Requires the local Postgres from README (docker run ... venuora-pg).
import { execSync } from "node:child_process";
import "dotenv/config";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:venuora@localhost:5432/venuora_test";

export default async function setup() {
  const adminUrl = TEST_DATABASE_URL.replace(/\/[^/]+$/, "/postgres");
  const dbName = TEST_DATABASE_URL.split("/").pop()!.split("?")[0];

  const { Client } = await import("pg");
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (exists.rowCount === 0) {
    await admin.query(`CREATE DATABASE ${JSON.stringify(dbName).replace(/"/g, '"')}`);
  }
  await admin.end();

  execSync("npx prisma migrate deploy", {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });

  process.env.DATABASE_URL = TEST_DATABASE_URL;
}
