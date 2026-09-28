import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name, role: "admin" },
    create: { email, passwordHash, name, role: "admin" },
  });

  console.log(`Seeded admin user: ${admin.email}`);

  // Fixed payment plans per the Sold-to-Transaction spec (§2.2) — the only
  // plans the Transaction flow supports. Idempotent upserts by code.
  const plans = [
    {
      code: "OUTRIGHT",
      name: "Outright",
      durationMonths: 0,
      interestRate: 0,
      interestMethod: "NONE",
      initialPaymentPercentage: 100,
      remainingInstallments: 0,
    },
    {
      code: "PLAN_3M",
      name: "0–3 months",
      durationMonths: 3,
      interestRate: 0,
      interestMethod: "NONE",
      initialPaymentPercentage: 50,
      remainingInstallments: 3,
    },
    {
      code: "PLAN_6M",
      name: "0–6 months",
      durationMonths: 6,
      interestRate: 5,
      interestMethod: "ONE_TIME_PERCENTAGE",
      initialPaymentPercentage: 50,
      remainingInstallments: 6,
    },
  ];
  for (const p of plans) {
    await prisma.paymentPlan.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        durationMonths: p.durationMonths,
        interestRate: p.interestRate,
        interestMethod: p.interestMethod,
        initialPaymentPercentage: p.initialPaymentPercentage,
        remainingInstallments: p.remainingInstallments,
        isActive: true,
      },
      create: { ...p, isActive: true },
    });
  }
  console.log(`Seeded ${plans.length} payment plans`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
