// Runs in each worker BEFORE test files are imported, so src/lib/db.ts
// picks up the test database instead of the dev one.
import "dotenv/config";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:venuora@localhost:5432/venuora_test";
