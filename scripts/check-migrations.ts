// Verifies migration history reproduces schema.prisma exactly:
// fresh empty DB -> migrate deploy -> diff against schema (must be empty).
// Uses Neon databases (no local postgres needed). Cleans up afterwards.
//
// Usage: npm run check:migrations
import "dotenv/config";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.join(import.meta.dirname, "..");

function dbUrl(dbName: string, pooler: boolean): string {
  const base = (process.env.DATABASE_URL ?? "").replace("-pooler", "");
  const u = new URL(base);
  // Direct host looks like ep-xxx.c-5.region...; pooler inserts "-pooler".
  if (pooler) u.host = u.host.replace(".c-", "-pooler.c-");
  u.pathname = `/${dbName}`;
  return u.toString();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const name = `migratecheck_${Date.now().toString(36)}`;
  const admin = new Client({ connectionString: process.env.DATABASE_URL.replace("-pooler", "") });
  await admin.connect();
  const drop = async () => {
    // Close pooled sessions first so DROP succeeds.
    await admin.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${name}' AND pid <> pg_backend_pid()`).catch(() => null);
    await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  };
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    console.log(`created scratch database ${name}`);
    const url = dbUrl(name, true);
    execSync("npx prisma migrate deploy", { cwd: ROOT, env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
    console.log("migrate deploy: all migrations applied");
    const cfgDir = fs.mkdtempSync(path.join(os.tmpdir(), "prisma-check-"));
    fs.symlinkSync(path.join(ROOT, "node_modules", "prisma"), path.join(cfgDir, "node_modules_prisma"));
    const cfg = path.join(cfgDir, "config.ts");
    fs.writeFileSync(
      cfg,
      `import { defineConfig } from ${JSON.stringify(path.join(ROOT, "node_modules", "prisma", "config"))};\nexport default defineConfig({ schema: ${JSON.stringify(path.join(ROOT, "prisma", "schema.prisma"))}, migrations: { path: ${JSON.stringify(path.join(ROOT, "prisma", "migrations"))} }, datasource: { url: ${JSON.stringify(url)} } });\n`
    );
    // Symlink so `prisma/config` resolves from the temp dir.
    fs.mkdirSync(path.join(cfgDir, "node_modules"), { recursive: true });
    fs.symlinkSync(path.join(ROOT, "node_modules", "prisma"), path.join(cfgDir, "node_modules", "prisma"));
    const out = execSync(
      `npx prisma migrate diff --from-config-datasource --to-schema ${path.join(ROOT, "prisma", "schema.prisma")} --script --config ${cfg}`,
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    );
    const sql = out
      .split("\n")
      .filter((l) => l.trim() && !l.trim().startsWith("--"))
      .join("\n")
      .trim();
    if (sql) {
      console.error("MIGRATION DRIFT DETECTED — fresh deploy does not match schema.prisma:");
      console.error(out);
      process.exitCode = 1;
    } else {
      console.log("OK: fresh deploy matches schema.prisma (empty diff).");
    }
  } finally {
    await drop().catch(() => null);
    await admin.end().catch(() => null);
    console.log("scratch database dropped");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
