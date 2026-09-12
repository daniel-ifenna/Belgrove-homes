import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Belgrove intentionally uses <img> for external unsplash + large hero
    // assets to avoid next/image remote loader config + keep cinematic LCP simple.
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
  {
    // Bulk Prisma + transition types use `any` for dynamic where inputs by design
    files: ["src/app/admin/bookings/**/*.tsx", "src/app/api/admin/bookings/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

export default eslintConfig;
