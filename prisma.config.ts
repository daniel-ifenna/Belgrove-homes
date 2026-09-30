import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // generate never connects, but env() throws when the var is missing —
    // which broke `npm install` (postinstall → prisma generate) on hosts
    // without DATABASE_URL in the build env. Fall back to a dummy URL so
    // install/build succeed anywhere; every command that actually connects
    // (migrate, studio, the app) still uses the real DATABASE_URL and fails
    // loudly without it.
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:5432/placeholder",
    // Optional: only needed for `migrate diff --from-migrations` (shadow DB).
    // Plain process.env access so plain migrate/generate don't require it.
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL } : {}),
  },
});
