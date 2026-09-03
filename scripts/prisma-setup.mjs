#!/usr/bin/env node
/**
 * Build-time Prisma provider selector.
 *
 * Prisma bakes the datasource provider into the generated client, and the
 * provider cannot be switched via an environment variable — so this project
 * ships two schema files:
 *
 *   prisma/schema.prisma           → SQLite     (local development default)
 *   prisma/schema.postgres.prisma  → PostgreSQL (Vercel / any hosted Postgres)
 *
 * The models in both files are identical; only the `provider` differs.
 *
 * Which schema is used at build time:
 *   1. PRISMA_PROVIDER=postgres|sqlite          (explicit override)
 *   2. DATABASE_URL starts with postgres:// or postgresql:// → postgres
 *   3. anything else (file: URL or unset)                    → sqlite
 *
 * Runs automatically as the first step of `npm run build` (see package.json),
 * so a Vercel deployment with a Postgres DATABASE_URL generates a Postgres
 * client without any manual configuration. You can also run it manually:
 *
 *   node scripts/prisma-setup.mjs
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

function detectProvider() {
  const explicit = (process.env.PRISMA_PROVIDER || "").trim().toLowerCase();
  if (explicit === "postgres" || explicit === "postgresql") return "postgres";
  if (explicit === "sqlite") return "sqlite";
  const url = (process.env.DATABASE_URL || "").trim();
  if (/^postgres(ql)?:\/\//i.test(url)) return "postgres";
  return "sqlite";
}

const provider = detectProvider();
const schema =
  provider === "postgres"
    ? "prisma/schema.postgres.prisma"
    : "prisma/schema.prisma";

console.log(`[prisma-setup] provider: ${provider}`);
console.log(`[prisma-setup] schema:   ${schema}`);

if (provider === "postgres") {
  console.log(
    "[prisma-setup] NOTE: data in the local SQLite file (db/custom.db) is NOT\n" +
      "[prisma-setup] migrated automatically. After the first deploy run, once:\n" +
      "[prisma-setup]   DATABASE_URL=\"<your postgres url>\" npx prisma db push --schema prisma/schema.postgres.prisma\n" +
      "[prisma-setup]   DATABASE_URL=\"<your postgres url>\" npx tsx prisma/seed.ts"
  );
}

if (!existsSync(schema)) {
  console.error(`[prisma-setup] Schema file not found: ${schema}`);
  process.exit(1);
}

function generate(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

try {
  // Resolve the locally installed Prisma CLI (works under npm, bun and pnpm).
  generate(`npx --no-install prisma generate --schema ${schema}`);
} catch {
  console.log("[prisma-setup] npx failed, falling back to the direct CLI path…");
  generate(
    `${process.execPath} node_modules/prisma/build/index.js generate --schema ${schema}`
  );
}
