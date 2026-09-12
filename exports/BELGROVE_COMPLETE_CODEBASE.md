# Belgrove Homes — Complete Codebase

Single-file mirror of the entire real-estate website. Built successfully with `npm run build` on Next.js 16.3.3 (Turbopack).

Generated: 2026-09-10
Run: `npm install && npx prisma migrate dev && npm run dev` (see .env.example)

---

## File Tree

```
prisma/migrations/20260828032258_init/migration.sql
prisma/migrations/20260828032808_add_booking_email/migration.sql
prisma/migrations/20260828034829_add_booking_activity_log/migration.sql
prisma/migrations/20260906092506_add_phone_to_booking/migration.sql
prisma/migrations/20260910080131_add_agents/migration.sql
prisma/migrations/20260910081729_add_booking_messages/migration.sql
prisma/migrations/migration_lock.toml
prisma/schema.prisma
prisma/seed.ts
public/belgrove-hero-golden-aerial.mp4
public/belgrove-inspection-team.jpg
public/belgrove-legacy-night-aerial.mp4
public/belgrove-team.jpg
public/cinematic-intro.css
public/cinematic-intro.js
public/file.svg
public/globe.svg
public/next.svg
public/vercel.svg
public/window.svg
src/.DS_Store
src/app/(site)/book-inspection/BookingForm.tsx
src/app/(site)/book-inspection/page.tsx
src/app/(site)/gallery/GalleryGrid.tsx
src/app/(site)/gallery/page.tsx
src/app/(site)/layout.tsx
src/app/(site)/page.tsx
src/app/(site)/testimonials/page.tsx
src/app/(site)/vision/page.tsx
src/app/admin/agents/AgentManager.tsx
src/app/admin/agents/page.tsx
src/app/admin/bookings/AgentNameCell.tsx
src/app/admin/bookings/[id]/ActivityTimeline.tsx
src/app/admin/bookings/[id]/BookingActions.tsx
src/app/admin/bookings/[id]/BookingMessages.tsx
src/app/admin/bookings/[id]/page.tsx
src/app/admin/bookings/page.tsx
src/app/admin/layout.tsx
src/app/admin/login/page.tsx
src/app/api/admin/agents/[id]/route.ts
src/app/api/admin/agents/route.ts
src/app/api/admin/bookings/[id]/messages/route.ts
src/app/api/admin/bookings/[id]/route.ts
src/app/api/admin/bookings/export/route.ts
src/app/api/admin/notifications/route.ts
src/app/api/agents/route.ts
src/app/api/auth/[...nextauth]/route.ts
src/app/api/bookings/route.ts
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/auth.ts
src/components/admin/AdminTopBar.tsx
src/components/admin/NotificationBell.tsx
src/components/site/CinematicIntroLoader.tsx
src/components/site/Footer.tsx
src/components/site/Nav.tsx
src/generated/prisma/browser.ts
src/generated/prisma/client.ts
src/generated/prisma/commonInputTypes.ts
src/generated/prisma/enums.ts
src/generated/prisma/internal/class.ts
src/generated/prisma/internal/prismaNamespace.ts
src/generated/prisma/internal/prismaNamespaceBrowser.ts
src/generated/prisma/models.ts
src/generated/prisma/models/Agent.ts
src/generated/prisma/models/BookingActivity.ts
src/generated/prisma/models/BookingMessage.ts
src/generated/prisma/models/InspectionBooking.ts
src/generated/prisma/models/Notification.ts
src/generated/prisma/models/User.ts
src/lib/authz.ts
src/lib/booking-transitions.ts
src/lib/booking-ui.ts
src/lib/content.ts
src/lib/email/emailService.ts
src/lib/email/sendEmail.ts
src/lib/email/templates.ts
src/lib/prisma.ts
src/lib/ref.ts
src/lib/validation.ts
src/proxy.ts
src/types/next-auth.d.ts

```

---

## `package.json`

```json
{
  "name": "real-estate-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@auth/prisma-adapter": "^2.11.3",
    "@prisma/adapter-pg": "^7.10.0",
    "@prisma/client": "7.10.0",
    "bcryptjs": "^3.0.3",
    "dotenv": "^17.4.2",
    "exceljs": "^4.4.0",
    "next": "16.3.3",
    "next-auth": "^5.0.0-beta.32",
    "nodemailer": "^8.0.11",
    "pg": "^8.23.0",
    "prisma": "7.10.0",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/bcryptjs": "^2.4.6",
    "@types/node": "^20",
    "@types/nodemailer": "^8.0.1",
    "@types/pg": "^8.23.1",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.3",
    "tailwindcss": "^4",
    "tsx": "^4.23.12",
    "typescript": "^5"
  }
}
```

## `next.config.ts`

```ts
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
```

## `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

## `prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  role         Role     @default(staff)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  assignedBookings InspectionBooking[] @relation("AssignedTo")
  reviewedBookings InspectionBooking[] @relation("ReviewedBy")
  notifications    Notification[]
  activities       BookingActivity[]
  messages         BookingMessage[]
}

enum Role {
  admin
  staff
}

model InspectionBooking {
  id String @id @default(cuid())
  ref String @unique // BEL-YYYY-XXXXX

  // Visitor-submitted
  name          String
  email         String
  phone         String?
  preferredDate DateTime
  preferredTime String
  location      String
  agentName     String?

  // Lifecycle status
  status BookingStatus @default(new)

  // Admin fields
  assignedToId    String?
  assignedToUser  User?   @relation("AssignedTo", fields: [assignedToId], references: [id])
  internalNote    String?
  rescheduledDate DateTime?
  rescheduledTime String?

  // Company agent assignment
  agentId String?
  agent   Agent?  @relation("BookingAgent", fields: [agentId], references: [id])

  // Post-inspection outcome
  outcome         SaleOutcome?
  leadTemperature LeadTemperature @default(cold)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  reviewedById String?
  reviewedByUser User? @relation("ReviewedBy", fields: [reviewedById], references: [id])
  reviewedAt   DateTime?

  notifications Notification[]
  activities    BookingActivity[]
  messages      BookingMessage[]

  @@index([status])
  @@index([leadTemperature])
  @@index([agentId])
  @@index([assignedToId])
}

enum BookingStatus {
  new
  under_review
  on_hold
  approved
  rescheduled
  active
  closed
}

enum SaleOutcome {
  sold
  not_sold
}

enum LeadTemperature {
  cold
  warm
  hot
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String
  message   String
  bookingId String?
  booking   InspectionBooking? @relation(fields: [bookingId], references: [id])
  read      Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, read])
}

// Company agents — staff or hire-purchase partners that can be assigned to unassigned bookings.
model Agent {
  id        String        @id @default(cuid())
  name      String
  phone     String
  email     String        @unique
  category  AgentCategory @default(staff)
  isActive  Boolean       @default(true)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  bookings InspectionBooking[] @relation("BookingAgent")

  @@index([category])
  @@index([isActive])
  @@index([email])
}

enum AgentCategory {
  staff
  hire_purchase
}

// Internal messaging thread per booking — visible until booking closed, then read-only.
model BookingMessage {
  id        String   @id @default(cuid())
  bookingId String
  booking   InspectionBooking @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  authorId  String?
  author    User?    @relation(fields: [authorId], references: [id])
  authorName String
  message   String
  createdAt DateTime @default(now())

  @@index([bookingId, createdAt])
}

// Immutable audit log of every admin action taken on a booking, so the
// booking row itself never has to be the only record of who did what.
model BookingActivity {
  id        String   @id @default(cuid())
  bookingId String
  booking   InspectionBooking @relation(fields: [bookingId], references: [id])

  actorId   String?
  actor     User?    @relation(fields: [actorId], references: [id])
  actorName String // snapshot at time of action, survives actor deletion

  action     String // approve | reschedule | hold | under_review | mark_active | record_outcome | save | assign_agent
  fromStatus BookingStatus
  toStatus   BookingStatus
  note       String?

  emailSent  Boolean?
  emailError String?

  createdAt DateTime @default(now())

  @@index([bookingId, createdAt])
}
```

## `prisma/seed.ts`

```ts
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## `src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Belgrove Homes",
  description: "Find your next home. Book a property inspection with Belgrove Homes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
```

## `src/app/globals.css`

```css
@import "tailwindcss";

:root {
  --background: #fdfbf7;
  --foreground: #2b2620;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

## `src/app/(site)/layout.tsx`

```tsx
import Nav from "@/components/site/Nav";
import Footer from "@/components/site/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
```

## `src/app/(site)/page.tsx`

```tsx
"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import CinematicIntroLoader from "@/components/site/CinematicIntroLoader";

function TypewriterWelcome() {
  const full = "Welcome to Belgrove";
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => { i++; setText(full.slice(0, i)); if (i >= full.length) { clearInterval(t); setDone(true); } }, 72);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center text-center px-6">
      <div className="mono text-[11px] tracking-[0.24em] uppercase text-[#C79A46] mb-5 opacity-0" style={{ animation: "fadeIn 0.7s ease 0.2s forwards" }}>Belgrove Homes & Properties Limited — Est. 2008</div>
      <h1 className="fraunces font-[500] text-[#F7F2E7] leading-none" style={{ fontSize: "clamp(2.8rem, 7vw, 4.8rem)", letterSpacing: "-0.02em", textShadow: "0 4px 28px rgba(0,0,0,0.45)" }}>
        <span className="inline-flex items-center">{text}<span className={`inline-block w-[3px] h-[1.05em] bg-[#E4C892] ml-1.5 ${done ? "opacity-0" : "animate-pulse"}`} style={{ transition: "opacity 0.4s" }} /></span>
      </h1>
      <div className="fraunces italic text-[#E4C892] mt-4 opacity-0" style={{ fontSize: "clamp(1.05rem, 2.5vw, 1.4rem)", animation: `fadeIn 0.9s ease ${done ? "0.4s" : "2.2s"} forwards` }}>Land. Value. Legacy.</div>
      <div className="mono text-[10px] tracking-[0.16em] uppercase text-[#B9C7BB] mt-3 opacity-0" style={{ animation: `fadeIn 0.9s ease ${done ? "0.7s" : "2.5s"} forwards` }}>The ground for your future — Where trust is titled</div>
      <style>{`@keyframes fadeIn{to{opacity:1}}`}</style>
    </div>
  );
}

export default function HomePage() {
  const [wealthStep, setWealthStep] = useState(0);
  const [openVerify, setOpenVerify] = useState(0);
  const [promiseTab, setPromiseTab] = useState(0);
  const [activePlotFilter, setActivePlotFilter] = useState("All");
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [headerSlide, setHeaderSlide] = useState(0);
  useEffect(() => { const t = setInterval(() => setHeaderSlide((s) => (s + 1) % 2), 6500); return () => clearInterval(t); }, []);
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add("in-view"); io.unobserve(e.target); } }); }, { threshold: 0.14 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="bg-[#F7F2E7] text-[#211D17]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;1,9..144,500&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/cinematic-intro.css" />
      <CinematicIntroLoader />
      <div id="cinematic" style={{ background: "#0F1A12" }}>
        <div className="cin-stage" style={{ background: "radial-gradient(ellipse 900px 560px at 50% 40%, rgba(199,154,70,0.14), transparent 62%), linear-gradient(180deg, #152219 0%, #0F1A12 100%)" }}>
          <TypewriterWelcome />
          <div className="cin-progress" style={{ background: "rgba(247,242,231,0.12)" }}><div className="cin-progress-bar" style={{ background: "linear-gradient(90deg, #C79A46, #E4C892)" }} /></div>
          <div className="cin-skip" style={{ color: "rgba(228,200,146,0.6)" }}>Click anywhere to enter</div>
        </div>
      </div>
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif} .reveal{opacity:0; transform:translateY(14px); transition:opacity .6s ease, transform .6s ease} .reveal.in-view{opacity:1; transform:translateY(0)} .card-hover{transition:transform .25s ease, box-shadow .25s ease} .card-hover:hover{transform:translateY(-3px); box-shadow:0 12px 28px rgba(31,51,40,0.12)}`}</style>

      {/* HERO — F + screen-fit slider */}
      <section className="relative h-screen w-full overflow-hidden bg-black">
        <div className={`absolute inset-0 transition-opacity duration-700 ${headerSlide === 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"><source src="/belgrove-legacy-night-aerial.mp4" type="video/mp4" /></video>
          <div className="absolute inset-0 bg-black/32" />
          <div className="absolute left-4 lg:left-12 bottom-[18%] max-w-[640px] pr-4">
            <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46] bg-white/92 backdrop-blur px-2.5 py-1 rounded-[2px] inline-block">Building Dreams, Delivering Excellence</div>
            <h1 className="fraunces font-[500] text-white leading-[1.02] mt-3" style={{ fontSize: "clamp(30px, 4.4vw, 44px)", textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}>Consider this your invitation to the ground beneath your future.</h1>
            <p className="public text-white/90 text-[13px] leading-[1.5] mt-3 max-w-[48ch]">Verified land. Premium service. And guidance that keeps your tomorrow in mind from the very first hello.</p>
            <p className="mono text-[10px] tracking-[0.12em] uppercase text-white/70 mt-2">Building Africa’s Future, One Exceptional Space at a Time</p>
          </div>
        </div>
        <div className={`absolute inset-0 transition-opacity duration-700 ${headerSlide === 1 ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <img src="/belgrove-team.jpg" alt="Belgrove team" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#1F3328]/38" />
          <div className="absolute left-4 lg:left-12 bottom-[18%] max-w-[620px] pr-4">
            <div className="mono text-[11px] tracking-[0.16em] uppercase text-[#1F3328] bg-[#C79A46] px-2.5 py-1 rounded-[2px] inline-block font-medium">No Rent Campaign — Own, Don’t Rent</div>
            <h2 className="fraunces font-[500] text-white leading-[1.02] mt-3" style={{ fontSize: "clamp(30px, 4.4vw, 44px)", textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}>Stop Renting. Start Owning Ground.</h2>
            <p className="public text-white/90 text-[13px] leading-[1.55] mt-3 max-w-[52ch]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
              Why pay rent forever when you can own titled land that grows? The No Rent Campaign moves first-time buyers from monthly rent receipts to title deeds — verified, transparent, and structured to fit real incomes. From rent to legacy, in one decision.
            </p>
            <Link href="/book-inspection" className="mono inline-flex mt-4 text-[11px] tracking-[0.12em] uppercase bg-[#C79A46] text-[#1F3328] px-4 py-2 rounded-[2px] hover:bg-[#E4C892] transition-colors font-medium">Join No Rent Campaign →</Link>
          </div>
        </div>
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
          {[0,1].map(i=>(
            <button key={i} onClick={()=>setHeaderSlide(i)} className={`h-1.5 rounded-full transition-all ${headerSlide===i ? "w-6 bg-[#C79A46]" : "w-1.5 bg-white/45"}`} />
          ))}
        </div>
      </section>

      {/* Welcome — expanded, asymmetrical */}
      <section id="welcome" className="bg-[#F7F2E7] py-14 border-b border-[#E0D5BB] overflow-hidden reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[1.2/0.9] bg-white shadow-[0_16px_32px_rgba(31,51,40,0.08)]">
                <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=900&auto=format&fit=crop" alt="Open land" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-3 left-3 mono text-[10px] tracking-[0.14em] uppercase bg-[#1F3328] text-[#E4C892] px-2 py-1 rounded-[2px]">Honest investment · Since 2008</div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Welcome — Headquarters, Lagos</span>
              <h2 className="fraunces text-[27px] leading-[1.12] text-[#1F3328] mt-3">The most honest investment <span className="italic text-[#8B5E3C]">there is.</span></h2>
              <div className="public text-[14px] leading-[1.7] text-[#211D17] mt-4 space-y-4">
                <p>At <strong className="font-semibold text-[#1F3328]">Belgrove Homes &amp; Properties Limited</strong>, we believe a piece of land is the most honest investment there is. It does not move, decline, or wear out; it waits for you — patient, quiet, and certain. While markets swing and currencies waver, ground remains. That certainty is why discerning families and disciplined investors alike return to land, again and again.</p>
                <p>Build the home you have imagined — a courtyard for laughter, a study for late nights, a garden that will outgrow your children. Hold an asset that grows with the years, hedged against inflation and time, appreciating as roads open and neighborhoods mature. Or lay the foundation of a future your family can stand on — a plot that becomes a home, then a compound, then a legacy whispered at family tables decades from now.</p>
                <p>Whatever your dream — first home, portfolio expansion, or a quiet hedge for the next generation — it begins with the right ground beneath it. We exist to make that first decision the most confident one you will ever make: verified, titled, and guided by people who will still answer your call after the deed is signed.</p>
              </div>
              <div className="flex gap-2 mt-6 mono text-[11px]">
                <span className="px-3 py-1.5 rounded-full bg-[#1F3328] text-[#E4C892]">Verified & Titled</span>
                <span className="px-3 py-1.5 rounded-full bg-white border border-[#E0D5BB]">Named adviser</span>
                <span className="px-3 py-1.5 rounded-full bg-white border border-[#E0D5BB]">No pressure</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Land — expanded */}
      <section className="bg-[#1F3328] py-14 relative overflow-hidden reveal">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23E4C892' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/svg%3E")` }} />
        <div className="relative max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.22fr_0.78fr] gap-8 lg:gap-10 items-start">
            <div>
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#B9C7BB]">Why Land, Why Now — A Head of Marketing Perspective</span>
              <blockquote className="fraunces italic leading-[1.32] text-[#E4C892] mt-4" style={{ fontSize: "clamp(21px, 2.5vw, 27px)" }}>
                “Real estate cannot be lost or stolen, nor can it be carried away. Purchased with common sense, paid for in full, and managed with reasonable care, it is about the safest investment in the world.”
              </blockquote>
              <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#B9C7BB] mt-3">— Franklin D. Roosevelt, as relevant in Lagos today as in New York then</div>
              <div className="public text-[#D9E0D5] leading-[1.65] mt-6 space-y-4" style={{ fontSize: "14.5px" }}>
                <p>Land has quietly become the smartest conversation in property — not because buildings have lost value, but because land alone asks for constant care and returns potential over time but <em className="text-[#E4C892] not-italic">only when chosen well</em>. In a city where new roads redraw maps overnight and corridors like Epe, Ibeju-Lekki and Mowe double in relevance within a decade, the difference between a good plot and a costly one is not price — it is due diligence.</p>
                <p>That is our work as your brand custodians: to find plots with genuine long-term promise — titled, accessible, free of encumbrance, with a clear path to infrastructure — verify them against our 7-point Belgrove Land Verification Standard, and hand them to you with complete clarity. No embellishment. No hidden caveats. Because a plot chosen today should still feel right when your child stands on it decades from now, and because trust, once broken, is land’s most expensive encumbrance.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-8 mono text-center">
                <div className="bg-white/5 border border-white/10 rounded-[4px] p-3"><div className="fraunces text-[#E4C892] text-[16px]">Hedge</div><div className="text-[11px] text-[#B9C7BB]">Against inflation</div></div>
                <div className="bg-white/5 border border-white/10 rounded-[4px] p-3"><div className="fraunces text-[#E4C892] text-[16px]">Patient</div><div className="text-[11px] text-[#B9C7BB]">Grows quietly</div></div>
                <div className="bg-white/5 border border-white/10 rounded-[4px] p-3"><div className="fraunces text-[#E4C892] text-[16px]">Legacy</div><div className="text-[11px] text-[#B9C7BB]">Outlives buildings</div></div>
              </div>
            </div>
            <div className="relative">
              <div className="relative rounded-[4px] overflow-hidden border border-white/10 aspect-[1.05/0.95] bg-[#152219] shadow-[0_20px_40px_rgba(0,0,0,0.28)]">
                <img src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=800&auto=format&fit=crop" alt="Mature landscape" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-[#1F3328]/90 backdrop-blur px-4 py-3">
                  <div className="mono text-[10px] tracking-[0.14em] uppercase text-[#E4C892]">Marketing lens</div>
                  <div className="public text-[12px] text-white mt-1">Land chosen well today still rewards decades from now — that is the story we protect.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wealth steps — expanded */}
      <section className="bg-[#F7F2E7] py-14 border-y border-[#E0D5BB] overflow-hidden reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-8 lg:gap-10 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[1.05/0.95] bg-white shadow-[0_16px_32px_rgba(31,51,40,0.08)]">
                <img src="https://images.unsplash.com/photo-1600607687644-c7171b42498b?q=80&w=800&auto=format&fit=crop" alt="Family home" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute top-3 left-3 mono text-[10px] tracking-[0.12em] uppercase bg-[#1F3328] text-[#E4C892] px-2 py-1 rounded-[2px]">Brand promise: Build · Hold · Grow</div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Wealth steps — The Belgrove Method</span>
              <h2 className="fraunces text-[30px] leading-[1.05] text-[#1F3328] mt-2">Build. Hold. Grow.</h2>
              <p className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-2">Three words that shape every advisory conversation. Whether you are pouring a foundation next quarter or holding for a decade, the discipline is the same.</p>
              <div className="flex gap-2 mt-5 flex-wrap">
                {["Build","Hold","Grow"].map((label,i)=>(
                  <button key={label} onClick={()=>setWealthStep(i)} className={`fraunces italic px-5 py-2 rounded-full border text-[13px] transition-all ${wealthStep===i ? "bg-[#1F3328] text-[#E4C892] border-[#1F3328]" : "bg-white text-[#8B5E3C] border-[#E0D5BB] hover:border-[#C79A46]"}`}>{label}</button>
                ))}
              </div>
              <div className="mt-5 min-h-[140px]">
                {wealthStep===0 && <div className="bg-white border border-[#E0D5BB] rounded-[4px] p-5"><h3 className="fraunces text-[16px] text-[#1F3328]">Build: The plot for the home you have imagined.</h3><p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-2">We start with your vision — not our inventory. How many bedrooms? How close to work? What does “home” feel like at 7am? From that warm first conversation we curate plots where that life fits, verify each, handle transfer and registration, and stay through foundation. You don’t just buy ground; you buy a clear path to front door.</p><p className="mono text-[11px] text-[#1F3328] mt-3">→ Ideal for families ready to build within 0–24 months.</p></div>}
                {wealthStep===1 && <div className="bg-white border border-[#E0D5BB] rounded-[4px] p-5"><h3 className="fraunces text-[16px] text-[#1F3328]">Hold: An asset that waits for you.</h3><p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-2">Not every plot must be built tomorrow. Held land, well chosen, is patient capital — hedged against inflation, free of tenant headaches, quietly appreciating as roads, schools and commerce arrive. We help you select corridors with real long-term potential (Epe’s industrial spine, Ibeju’s coastal momentum) and we tell you honestly when to wait. Land rewards patience — we reward it with discipline.</p><p className="mono text-[11px] text-[#1F3328] mt-3">→ Ideal for investors building a 3–10 year portfolio.</p></div>}
                {wealthStep===2 && <div className="bg-white border border-[#E0D5BB] rounded-[4px] p-5"><h3 className="fraunces text-[16px] text-[#1F3328]">Grow: A legacy for your family.</h3><p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-2">Property, well planned, is one of the surest foundations of enduring wealth — because it compounds beyond you. A plot bought wisely today becomes a home for your children, a rental that funds education, or a parcel that multiplies when the neighborhood matures. As head of marketing, I call this “the quiet ROI”: value that grows while you sleep, and a story your family will tell long after the transfer papers fade.</p><p className="mono text-[11px] text-[#1F3328] mt-3">→ Ideal for generational wealth — 10+ year horizon.</p></div>}
              </div>
              <p className="fraunces italic text-[14px] text-[#8B5E3C] mt-4">Your future starts with a quiet invitation and the right ground. Which step are you on?</p>
            </div>
          </div>
        </div>
      </section>

      {/* How We Build — detailed */}
      <section className="bg-white border-y border-[#E0D5BB] py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">How we build — end to end, Fortune 500 discipline</span>
          <h2 className="fraunces text-[30px] leading-[1.05] text-[#1F3328] mt-2">One team owns the <span className="italic text-[#8B5E3C]">entire lifecycle</span></h2>
          <p className="public text-[14px] leading-[1.6] text-[#8B5E3C] max-w-[68ch] mt-3">We acquire, title, service, build community infrastructure, and remain as estate managers — so no estate stalls at “coming soon.” This end-to-end ownership is our brand moat: escrow-tracked funds, ISO-grade verification, weekly public build diaries you can attend, and a named adviser who knows your plot by heart. Marketing can promise; delivery must prove.</p>
          <div className="relative rounded-[4px] overflow-hidden bg-[#152219] mt-8 shadow-[0_16px_40px_rgba(15,26,18,0.14)]">
            <div className="relative aspect-[16/7.5] overflow-hidden">
              <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=1600&auto=format&fit=crop" alt="Completed estate" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(21,34,25,0.08), rgba(21,34,25,0.58))" }} />
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4">
                <div className="bg-white/95 backdrop-blur rounded-[4px] px-4 py-3"><div className="mono text-[10px] tracking-[0.14em] uppercase text-[#8B5E3C]">Live estate — Belgrove IV</div><div className="fraunces text-[15px] text-[#1F3328] mt-1">Roads, power, school and clinic before handover — see before you buy.</div></div>
                <Link href="/book-inspection" className="hidden sm:inline-flex public text-[13px] font-semibold bg-[#C79A46] text-[#152219] px-5 py-2.5 rounded-[2px]">Tour this estate →</Link>
              </div>
            </div>
            <div className="flex gap-1.5 px-2 pt-2 bg-[#F7F2E7] mono text-[10px]">
              {["All","Empty","Construction","Rising","Home"].map(f=>(
                <button key={f} onClick={()=>setActivePlotFilter(f)} className={`px-2.5 py-1 rounded-full border ${activePlotFilter===f?"bg-[#1F3328] text-white border-[#1F3328]":"bg-white text-[#8B5E3C] border-[#E0D5BB] hover:border-[#1F3328]"}`}>{f}</button>
              ))}
              <span className="ml-auto mono text-[10px] tracking-[0.12em] uppercase text-[#8B5E3C] self-center">Interactive filter · Click to enlarge</span>
            </div>
            <div className="grid grid-cols-4 gap-2 p-2 bg-[#F7F2E7]">
              {[
                ["01 · Empty Land","https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=600&auto=format&fit=crop"],
                ["02 · Construction","https://images.unsplash.com/photo-1541888946425-d81bb19240f6?q=80&w=600&auto=format&fit=crop"],
                ["03 · Rising","https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=600&auto=format&fit=crop"],
                ["04 · Dream Home","https://images.unsplash.com/photo-1600573472592-401b489a3cdc?q=80&w=600&auto=format&fit=crop"],
              ].filter(([label])=> activePlotFilter==="All" || label.toLowerCase().includes(activePlotFilter.toLowerCase())).map(([label,img])=>(
                <figure key={label} onClick={()=>setLightbox(img)} className="relative rounded-[4px] overflow-hidden aspect-[1.35] bg-white card-hover cursor-pointer group">
                  <img src={img} alt={label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                  <figcaption className="absolute bottom-0 inset-x-0 mono text-[9px] tracking-[0.12em] uppercase text-center px-1 py-1.5 bg-[#1F3328]/88 text-white">{label}</figcaption>
                  <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-white/90 grid place-items-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">⤢</span>
                </figure>
              ))}
            </div>
            {lightbox && (
              <div className="fixed inset-0 z-50 bg-[#0F1A12]/85 backdrop-blur flex items-center justify-center p-6" onClick={()=>setLightbox(null)}>
                <img src={lightbox} alt="" className="max-w-[90vw] max-h-[86vh] rounded-[4px] shadow-[0_20px_60px_rgba(0,0,0,0.4)]" />
                <button className="absolute top-6 right-6 h-9 w-9 rounded-full bg-white grid place-items-center text-[#1F3328]" onClick={()=>setLightbox(null)}>✕</button>
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
            {[
              { n:"01", t:"Acquisition", d:"We don’t list what we haven’t walked. Every acre is surveyed, titled and de-risked — only land with a clear corridor to infrastructure ever reaches you.", s:"2,400+ acres" },
              { n:"02", t:"Master Plan", d:"Roads, drainage, power and zoning are engineered and approved before the first block is laid — so your 450sqm is never an island.", s:"100% approved" },
              { n:"03", t:"Construction", d:"Vetted crews under ISO supervision, weekly diaries open to clients. Visit any Tuesday — hard hat provided, progress proven.", s:"180+ workers" },
              { n:"04", t:"Vertical Build", d:"Serviced plots become terraces, detached homes and mixed-use blocks rising in parallel — choice, not compromise.", s:"6 estates" },
              { n:"05", t:"Infrastructure", d:"Schools, clinic, market and faith plots delivered with phase 1, not phase “later.” Community on day one.", s:"5 amenities" },
              { n:"06", t:"Handover", d:"Deed, keys and estate services. Move-in ready, fully documented, and managed by the team that built it.", s:"1,200 families" },
            ].map(s=>(
              <div key={s.n} className="bg-[#F7F2E7] border border-[#E0D5BB] rounded-[4px] p-4 card-hover">
                <div className="h-6 w-6 rounded-full bg-[#1F3328] text-[#E4C892] grid place-items-center mono text-[11px]">{s.n}</div>
                <div className="fraunces text-[15px] text-[#1F3328] mt-2">{s.t}</div>
                <div className="public text-[12.5px] leading-[1.5] text-[#8B5E3C] mt-1">{s.d}</div>
                <div className="mono text-[10px] tracking-[0.12em] uppercase text-[#C79A46] mt-3 pt-3 border-t border-dashed border-[#E0D5BB]">{s.s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT — detailed, marketing head voice */}
      <section id="about" className="bg-[#F7F2E7] py-12 lg:py-16 overflow-hidden reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[1.18fr_0.82fr] gap-8 lg:gap-12 items-start">
            <div className="lg:pr-4">
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">About Us — The Belgrove Story, Told by Marketing</span>
              <h2 className="fraunces text-[32px] lg:text-[36px] leading-[0.92] tracking-[-0.015em] text-[#1F3328] mt-3">Who we are, and why land</h2>
              <div className="grid sm:grid-cols-2 gap-6 mt-8">
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Who we are</h3>
                  <p className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2">Belgrove Homes &amp; Properties Limited was born in 2008 on a single conviction that still hangs framed in our Lagos reception: <em className="italic text-[#8B5E3C]">real estate is far more than the acquisition of ground or buildings; it is a foundation for financial growth, for security, and for a generational legacy.</em> What began as two colleagues above a coffee shop — walking every plot, photographing every boundary, losing sales to honesty — is now a 34-person house of acquisitions, verification, advisory and estate management. We have made land the heart of that belief, because a brand that endures must stand on ground that endures.</p>
                </div>
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Why land — our first love</h3>
                  <p className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2">We chose land for a simple, almost poetic reason: it is where everything meaningful in property begins. A building ages, styles fade, roofs leak — but a plot endures. It gives you freedom: build when ready, hold while you plan, pass on something that outlives you. In a market where buildings depreciate and trends expire, land — well chosen — is the firmest ground on which to build wealth, the one asset you can stand on, literally and financially.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-6 mt-8">
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Our difference — premium, yet warm</h3>
                  <p className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2">We are premium in quality and warm in manner — a deliberate duality. No pressure, no jargon, no hidden process. Every client receives a named adviser (not a call centre), verified land, transparent fees, and an honest view — even when honesty means advising you to wait. As head of marketing, I measure success not in closings, but in clients who return with their siblings. That warmth is our moat; quality is our standard.</p>
                </div>
                <div>
                  <h3 className="public font-semibold text-[13px] tracking-[0.06em] uppercase text-[#1F3328]">Who we serve — from heirs to portfolios</h3>
                  <p className="public text-[13.5px] leading-[1.65] text-[#211D17] mt-2">First-time heirs who have never bought land before, and seasoned portfolio builders on their fourth plot. Families planning a first home where children will learn to ride a bicycle, investors assembling a corridor of assets, and communities watching their neighborhoods flourish because we stayed to manage the estate. If you value clarity over hype, you are already one of us.</p>
                </div>
              </div>
            </div>
            <div className="relative lg:translate-y-2">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[0.95/1.05] bg-white shadow-[0_20px_40px_rgba(31,51,40,0.12)]">
                <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?q=80&w=900&auto=format&fit=crop" alt="Belgrove team" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute bottom-0 inset-x-0 bg-[#1F3328]/88 backdrop-blur px-4 py-3">
                  <div className="mono text-[10px] tracking-[0.14em] uppercase text-[#E4C892]">18 years · 6 estates · 1,200 families · 34 people, one promise</div>
                  <div className="public text-[12px] text-white mt-1">We walk every plot before you do — and we stay after you build.</div>
                </div>
              </div>
              <div className="hidden lg:block absolute -z-10 -right-4 -bottom-4 w-[86%] h-[88%] bg-white border border-[#E0D5BB] rounded-[4px]" />
            </div>
          </div>
          <div className="mt-10">
            <h3 className="mono text-[11px] tracking-[0.18em] uppercase text-[#8B5E3C]">Our values — the brand code</h3>
            <div className="grid md:grid-cols-5 gap-3 mt-4">
              {[
                ["Integrity","We verify, disclose, and tell the truth even when it costs a sale. In marketing, trust is the only campaign that never ends."],
                ["Clarity","If you do not understand something, we have not finished our job. Jargon is a failure of service, not a sign of expertise."],
                ["Value","We position every opportunity for long-term worth, not short-term gain. A quick flip is not a Belgrove story."],
                ["Warmth","Premium service with a human welcome at every step. You will know your adviser’s name and direct line."],
                ["Legacy","We help you build assets that outlast you. The best brief we ever receive is from your future grandchildren."],
              ].map(([k,v],i)=>(
                <div key={k} className={`bg-white border border-[#E0D5BB] rounded-[4px] p-4 card-hover ${i===2 ? "lg:translate-y-3" : i===4 ? "lg:translate-y-1" : ""}`}>
                  <div className="fraunces text-[14px] text-[#1F3328]">{k}</div>
                  <div className="public text-[12.5px] leading-[1.45] text-[#8B5E3C] mt-1">— {v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* OUR VISION — detailed */}
      <section className="bg-white border-y border-[#E0D5BB] py-12 lg:py-16 overflow-hidden reveal">
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-[0.88fr_1.12fr] gap-8 lg:gap-12 items-center">
            <div className="relative lg:translate-x-2">
              <div className="relative rounded-[4px] overflow-hidden border border-[#E0D5BB] aspect-[1.05/0.92] shadow-[0_20px_40px_rgba(21,34,25,0.12)]">
                <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover"><source src="/belgrove-legacy-night-aerial.mp4" type="video/mp4" /></video>
                <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(21,34,25,0.08), rgba(21,34,25,0.52))" }} />
                <span className="absolute bottom-3 left-3 mono text-[10px] tracking-[0.12em] uppercase bg-[#1F3328]/78 text-white px-2.5 py-1 rounded-[2px] border border-white/10">FOR THE LONG TERM — VISION 2035</span>
              </div>
              <div className="hidden lg:block absolute -z-10 -left-4 top-4 bottom-4 w-[86%] bg-[#F7F2E7] border border-[#E0D5BB] rounded-[4px]" />
            </div>
            <div className="lg:pl-4">
              <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Our Vision — Where we are headed</span>
              <h2 className="fraunces text-[26px] lg:text-[28px] leading-[1.12] tracking-[-0.01em] text-[#1F3328] mt-3">To build a globally respected real estate brand known for creating exceptional land and property opportunities, delivering lasting value, and empowering individuals and generations to build enduring wealth through real estate.</h2>
              <div className="public text-[14px] leading-[1.65] text-[#8B5E3C] mt-4 space-y-3">
                <p>This is not ambition for its own sake. In branding, “globally respected” is not a billboard — it is a whisper earned plot by plot. We long for a Belgrove name synonymous with trust, one that people recommend to their children as surely as we help them lay foundations.</p>
                <p>It means earning respect transaction by transaction, until the brand itself becomes a foundation others build upon — the quiet moment when a client says, “My father bought from Belgrove, so will I.” That is the vision: not the biggest developer, but the most trusted.</p>
              </div>
              <div className="mt-6 space-y-1 border-l-2 border-[#C79A46] pl-4">
                <div className="fraunces italic text-[18px] text-[#1F3328]">Land. Value. Legacy.</div>
                <div className="public text-[13px] text-[#8B5E3C]">The foundation for your wealth and your future — and for ours.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* OUR MISSION — detailed */}
      <section className="bg-[#F7F2E7] py-16 border-b border-[#E0D5BB] reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Our Mission — How we get there</span>
          <h2 className="fraunces text-[26px] leading-[1.25] text-[#1F3328] mt-2 max-w-[46ch]">To make strategic land and real estate opportunities accessible through transparent transactions, quality offerings, professional service, and innovative solutions creating lasting value for our clients, our investors, and our communities.</h2>
          <div className="public text-[14.5px] leading-[1.7] text-[#211D17] mt-6 space-y-4 max-w-[72ch]">
            <p><strong className="text-[#1F3328]">Accessibility is the key word.</strong> We believe exceptional land should not be reserved for those who know the system, speak the jargon, or have a cousin at the registry. As head of marketing, my brief to the team is simple: open the door. Verified listings in plain language, clear fees on page one, honest guidance even when it means saying “not this one,” and payment structures that fit real lives — 12–24 month installments, escrow, and a named adviser who answers on the second ring.</p>
            <p><strong className="text-[#1F3328]">Innovation appears in how we verify, present, and transfer land,</strong> so the experience feels as modern and uncomplicated as it is trustworthy: drone surveys, digital verification packs, virtual tours for diaspora clients, and a transfer process so clear you could explain it to your mother. Lasting value is then not a promise but a process — for clients who build, investors who hold, and communities that watch a bush become a neighborhood they are proud of.</p>
          </div>
        </div>
      </section>

      {/* OUR PROMISE — detailed */}
      <section className="bg-white py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Our Promise — The Belgrove Standard, in practice</span>
          <h2 className="fraunces text-[28px] text-[#1F3328] mt-2">Clarity, confidence, and value</h2>
          <p className="public text-[14.5px] leading-[1.65] text-[#211D17] mt-4 max-w-[70ch]">At Belgrove, every client deserves clarity, confidence, and value. This is not a slogan laminated for the reception wall. It is a working standard — the checklist our marketing team must clear before a listing ever goes live, and the reason our sales team will talk you out of a plot if it is not right for you.</p>
          <h3 className="mono text-[11px] tracking-[0.14em] uppercase text-[#1F3328] mt-8">What it means in practice — five non-negotiables</h3>
          <div className="grid md:grid-cols-2 gap-0 mt-4">
            {[
              ["Accurate information","Before a listing ever appears, we verify ownership, boundaries, use, and access — and we publish only what we can prove. What you read is what you can rely on, in court, at the bank, and at the family table."],
              ["Professional guidance","Warm, expert advice at every stage, from your first WhatsApp enquiry to the transfer and registration of your land. Your adviser knows your plot number without looking it up."],
              ["Transparent processes","Clear fees, clear steps, no hidden surprises. Our fee sheet fits on one page. You always know where you stand and what you pay — and what you don’t."],
              ["Long-term value","Opportunities carefully positioned to grow with the years, not the quarter. We show you why today’s price is tomorrow’s entry point, with comparable sales and corridor trends, not hype."],
              ["A human welcome","A named adviser who knows your goals and stays with you, unhurried, from first hello to final handover — and who will still pick up when you call to sell."],
            ].map(([t,d])=>(
              <div key={t} className="flex gap-3 py-5 border-t border-[#E0D5BB] pr-6">
                <span className="h-5 w-5 rounded-full bg-[#1F3328] text-[#E4C892] grid place-items-center text-[11px] shrink-0 mt-0.5">✓</span>
                <div><div className="public font-semibold text-[14px] text-[#1F3328]">{t}</div><div className="public text-[13px] leading-[1.5] text-[#8B5E3C] mt-1">{d}</div></div>
              </div>
            ))}
          </div>
          <p className="public text-[14px] leading-[1.65] text-[#8B5E3C] mt-8 italic border-l-2 border-[#C79A46] pl-4">From your first enquiry to the keys in your hand, and the ground beneath your feet, we make your journey with Belgrove seamless, informed, and rewarding — because the most valuable thing we hand over is not a deed, but certainty.</p>
        </div>
      </section>

      {/* WHY CHOOSE — detailed */}
      <section className="bg-[#F7F2E7] border-y border-[#E0D5BB] py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Why Choose Belgrove Land — From the Marketing Desk</span>
          <h2 className="fraunces text-[28px] text-[#1F3328] mt-2">Value Proposition — why our clients choose, and stay</h2>
          <p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-3 max-w-[68ch]">In a market crowded with promises, we compete on proof. Here is why families and portfolio builders alike choose Belgrove — and why 63% of our 1,200 handovers came from referrals.</p>
          <div className="grid md:grid-cols-2 gap-0 mt-8">
            {[
              ["Verified before you commit","Title, boundaries, access, and use checked against our strict 7-point standard — and shared as a verification pack you can take to your own lawyer."],
              ["Transparent pricing","No hidden fees, no silent costs; everything in writing from the start. Our price is the price — no “survey fee” surprise at transfer."],
              ["A named human adviser","Never a call centre, never pressure. One person, one direct line, from shortlist to after-sales. We even tell you when to wait."],
              ["Future-minded selection","Locations with real long-term potential, explained honestly with corridor data, not brochure poetry. Epe’s spine, Ibeju’s coast — we show our work."],
              ["A full journey","From shortlist and site visit to survey, transfer, registration, and eventually building — plus trusted architects and builders when you are ready."],
              ["A real legacy","Land that can grow into a home, a portfolio, or a family future — the one asset your children will thank you for, not question."],
            ].map(([t,d])=>(
              <div key={t} className="flex gap-3 py-4 border-t border-[#E0D5BB] pr-6">
                <span className="h-5 w-5 rounded-full bg-[#C79A46] text-white grid place-items-center text-[11px] shrink-0">✓</span>
                <div className="public text-[14px] leading-[1.5]"><span className="font-semibold text-[#1F3328]">{t}</span><span className="text-[#8B5E3C]"> — {d}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VERIFICATION — detailed */}
      <section id="verification" className="bg-[#1F3328] py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#E4C892]">The Belgrove Land Verification Standard — Our moat</span>
          <h2 className="fraunces text-[28px] text-[#F7F2E7] mt-2">Accuracy is the heart of our promise</h2>
          <p className="public text-[14px] text-[#C9D2C5] mt-2 max-w-[68ch]">Every plot we present is checked against a clear standard before publication. As head of marketing, I will not let a plot go live until it clears all seven. Accuracy is not a department — it is our entire brand.</p>
          <div className="mt-8">
            {[
              { code:"Title & Ownership", title:"Title & Ownership", body:"The chain of ownership is verified, and the seller's right to sell is confirmed — with documented title you can take to your own counsel. No title, no listing." },
              { code:"Freedom from Encumbrance", title:"Freedom from Encumbrance & Disputes", body:"Checks for claims, liens, caveats, or competing interests — including family and community claims that never appear online." },
              { code:"Boundaries & Size", title:"Boundaries & Size", body:"Plot dimension and boundaries are established by survey / certified measurement — pegged, photographed, and shared. What you see is what you buy." },
              { code:"Use & Planning", title:"Use & Planning Status", body:"What the land may be used for (residential / commercial / development) and any permit position — so you don’t buy residential where only commercial can stand." },
              { code:"Access & Utilities", title:"Access & Utilities", body:"Road access, and the availability of water, power, and other essentials — because land without access is not an asset, it is a burden." },
              { code:"Possession", title:"Possession & Encroachment", body:"We check the land is actually available and free of encroachment or occupation — physically visited, not just checked on paper." },
              { code:"Documentation", title:"Complete Documentation", body:"The documents you need (title / deed / transfer / registration) are explained and, where you wish, coordinated end-to-end — so the paperwork feels as solid as the ground." },
            ].map((v,i)=>(
              <div key={v.code} className="border-t border-white/15">
                <button onClick={()=>setOpenVerify(openVerify===i ? -1 : i)} className="w-full flex items-center gap-4 py-4 text-left">
                  <span className="mono text-[11px] text-[#C79A46] w-[160px] shrink-0 hidden sm:block">{v.code}</span>
                  <span className="fraunces text-[15px] text-[#F7F2E7] flex-1">{v.title}</span>
                  <span className={`text-[#C79A46] text-xl leading-none transition-transform ${openVerify===i ? "rotate-45" : ""}`}>+</span>
                </button>
                <div className={`overflow-hidden transition-all ${openVerify===i ? "max-h-32 pb-4" : "max-h-0"}`}>
                  <p className="public text-[13px] text-[#C9D2C5] sm:ml-[176px] max-w-[64ch]">{v.body}</p>
                </div>
              </div>
            ))}
            <div className="border-b border-white/15" />
          </div>
        </div>
      </section>

      {/* PROMISE TABS & LAND FAQs — keep */}
      <section className="bg-white py-8 border-b border-[#E0D5BB] reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="flex gap-2 flex-wrap">
            {["Our Promise","Why Choose Belgrove"].map((label,i)=>(
              <button key={label} onClick={()=>setPromiseTab(i)} className={`public px-5 py-2.5 rounded-[2px] border text-[14px] font-semibold ${promiseTab===i ? "bg-[#1F3328] text-white border-[#1F3328]" : "bg-white text-[#8B5E3C] border-[#E0D5BB]"}`}>{label}</button>
            ))}
          </div>
          <div className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-4">
            {promiseTab===0 ? "From accurate information to a human welcome — the standard is lived, not printed. That is the Belgrove difference you feel from first hello." : "Verified, transparent, human — land as legacy, not gamble. That is why referral is our largest channel."}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#F7F2E7] py-16 reveal">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="text-center max-w-[760px] mx-auto">
            <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Land FAQs — Answered as your adviser would</span>
            <h2 className="fraunces text-[28px] text-[#1F3328] mt-2">The ground for your future.</h2>
            <p className="public text-[14px] text-[#8B5E3C] mt-2">Buy the land. Build tomorrow. Welcome to the foundation of everything — with answers, not assurances.</p>
          </div>
          <div className="max-w-[860px] mx-auto mt-10">
            {[
              ["Is the land you sell actually yours to sell?","This is the most important question, and we treat it that way. Before publication we verify the chain of ownership and confirm the seller's legal right to sell. Every plot we present is backed by documented title and a clear ownership position and we will walk you through that documentation — page by page — so you understand it before you commit. Bring your lawyer; we welcome it."],
              ["What does “verified land” mean at Belgrove?","It means the plot has passed our 7-point land verification standard: title and ownership confirmed, freedom from encumbrance and disputes checked, boundaries and size established, use/planning status and access confirmed, and complete documentation available. You can request the verification pack for any plot you are serious about — we send it before you pay a naira."],
              ["Can I trust the size and boundaries shown?","We present size based on the surveyor's measurement / certified record, and boundaries are established by pegs and photographs, rather than guessed. We take care you are buying precisely the land you believe you are buying, and we are honest about any measurement caveats — because a square metre hidden is trust lost."],
              ["I want to buy land to build my own home, how does that work?","We start with your vision and budget, then find land suitable for building — the right location, size, use status, and access. We verify the land, coordinate the legal transfer and registration, and connect you with trusted partners for planning and construction. Your goal is to get from plot to foundation with clarity, not complication — and we project-manage that clarity."],
              ["Is land a good long-term investment can I expect it to grow in value?","Land often grows in value over time as areas develop and demand rises, but this is not guaranteed, and no responsible adviser will promise future returns. We seek plots in locations with genuine long-term potential, explain the reasoning with corridor data and comparables, and set realistic expectations. Land is patient by nature, and so is our advice — that patience is our brand promise."],
              ["What is “land banking,” and do you advise on it?","Land banking is buying land to hold for long-term appreciation before building or resale. We can help identify land with future potential and sequence it within a broader portfolio — but we are transparent that returns are not guaranteed and that a plot's prospects should be weighed carefully, with exit options discussed, rather than assumed."],
              ["What documents will I receive after buying land?","You will receive the documentation appropriate to a valid sale, typically the title/deed and the completed legal transfer and registration. We make sure you understand every paper you receive — what it means, where to keep it, and how your family will use it — and, where you wish, we coordinate the transfer on your behalf, end-to-end."],
              ["What if the land has a dispute, an issue, or encroachment?","Our verification is designed to surface these before they become your problem. Where an issue exists, we either resolve it properly — with the right parties and paperwork — or do not present the plot. Our honest standard means we would rather lose a sale than pass a problem to you. That is not just ethics; it is marketing — a problem sold is a reputation lost."],
              ["Can you help me sell my land?","Yes. We value it honestly (even if honest is lower than you hoped), prepare clear documentation, and market it to the right buyers — those building homes and those building portfolios — with the same verification we demand as buyers. Selling land should be as transparent as buying it; your buyer will receive the same pack you did."],
              ["Do you offer payment plans or financing for land","Whether or not you offer them, the full price and any payment structure are disclosed clearly and in writing from the start, with no hidden costs. We offer 12–24 month structures on selected estates; for specifics, your named adviser will lay the schedule beside the total — so you see the ground and the terms, clearly."],
              ["How does your company handle site inspections?","We arrange site visits every week, and for out-of-town or overseas clients we offer virtual tours, drone footage and detailed reports so you can buy with confidence even at a distance. Every visit is hosted — not just a gate opened, but a walk with your adviser who knows the plot number by heart."],
              ["How long does buying land through Belgrove take?","It varies with documentation and transfer requirements, but typically days to weeks for a straightforward plot. We set clear milestones at the start — verification, offer, transfer, registration — and keep you informed at every stage, so waiting feels like progress, not silence."],
            ].map(([q,a])=>(
              <details key={q} className="border-t border-[#E0D5BB] py-4 group bg-white px-4 card-hover">
                <summary className="fraunces text-[15px] text-[#1F3328] flex justify-between items-center cursor-pointer list-none gap-4">{q}<span className="text-[#C79A46] text-xl group-open:hidden shrink-0">+</span><span className="text-[#C79A46] text-xl hidden group-open:block shrink-0">–</span></summary>
                <p className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-3 max-w-[75ch]">{a}</p>
              </details>
            ))}
            <div className="border-b border-[#E0D5BB]" />
          </div>
        </div>
      </section>

      {/* CTA BAND — expanded */}
      <section className="bg-[#152219] py-14 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23E4C892' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/svg%3E")` }} />
        <div className="relative max-w-[1180px] mx-auto px-6 lg:px-8">
          <div className="mono text-[11px] tracking-[0.18em] uppercase text-[#E4C892]">Belgrove Homes & Properties Limited — Land. Value. Legacy.</div>
          <h2 className="fraunces text-[30px] leading-[1.05] text-[#F7F2E7] mt-3">Begin with a quiet welcome at Belgrove.</h2>
          <p className="public text-[13px] leading-[1.6] text-[#B9C7BB] mt-3 max-w-[56ch] mx-auto">Where trust is titled, warmth is standard, and your tomorrow has ground to stand on. Your named adviser is ready — no queue, no script, just a conversation about what you want to build.</p>
          <Link href="/book-inspection" className="public inline-block mt-6 bg-[#C79A46] text-[#152219] px-8 py-3.5 rounded-[2px] font-semibold hover:bg-[#E4C892] transition-colors shadow-[0_8px_24px_rgba(199,154,70,0.28)]">Book site inspection — Your ground awaits</Link>
          <div className="fraunces italic text-[#E4C892] text-[14px] mt-6">The ground for your future — Where honest investment begins.</div>
        </div>
      </section>
    </div>
  );
}
```

## `src/app/(site)/vision/page.tsx`

```tsx
export default function VisionPage() {
  return (
    <div className="bg-[#F7F2E7]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet" />
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif}`}</style>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#152219]">
        <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover opacity-70">
          <source src="/belgrove-legacy-night-aerial.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,26,18,0.55), rgba(15,26,18,0.78))" }} />
        <div className="relative max-w-[1180px] mx-auto px-6 lg:px-8 py-20 lg:py-28">
          <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#E4C892]">Our Vision · Our Promise</span>
          <h1 className="fraunces text-[38px] lg:text-[48px] leading-[0.95] tracking-[-0.02em] text-[#F7F2E7] mt-4 max-w-[18ch]" style={{ textShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
            Real estate should feel like a <span className="italic text-[#E4C892]">relationship,</span> not a transaction.
          </h1>
          <p className="public text-[#D9E0D5] text-[16px] leading-[1.65] max-w-[52ch] mt-6">A globally respected brand, known for exceptional land opportunities — recommended by families to their children, decades from now.</p>
        </div>
      </section>

      {/* Narrative */}
      <section className="max-w-[1180px] mx-auto px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
          <div className="public text-[15px] leading-[1.7] text-[#211D17] space-y-5">
            <p>Belgrove Homes was founded in 2008 on a simple belief: the people buying and selling homes deserve an agent who treats the process with the same care they would want for their own family. That belief still shapes every inspection we schedule and every offer we help negotiate today.</p>
            <p>We started as a two-person office above a coffee shop, and grew because clients kept sending their friends back to us. Nearly two decades later, our approach hasn’t changed even as our reach has: we still walk every property ourselves, we still answer the hard questions honestly, and we still believe the right home is worth taking the time to find.</p>
            <p>Our mission is to make the property search transparent and unhurried — giving buyers the full picture before they commit, and giving sellers a team that represents their home as carefully as they would themselves.</p>
            <div className="fraunces italic text-[20px] text-[#1F3328] border-l-2 border-[#C79A46] pl-5 mt-8">Land. Value. Legacy.</div>
          </div>
          <div className="space-y-4">
            <div className="rounded-[4px] overflow-hidden border border-[#E0D5BB] bg-white">
              <img src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=800&auto=format&fit=crop" alt="Estate at dusk" className="w-full aspect-[1.45] object-cover" />
              <div className="p-4">
                <div className="mono text-[11px] tracking-[0.14em] uppercase text-[#C79A46]">How we build</div>
                <div className="fraunces text-[16px] text-[#1F3328] mt-1">Acquisition → Master Plan → Construction → Infrastructure → Handover</div>
                <div className="public text-[13px] text-[#8B5E3C] mt-2">One team owns the entire lifecycle. No “infrastructure coming soon.”</div>
              </div>
            </div>
            <div className="bg-[#1F3328] rounded-[4px] p-6 text-[#F7F2E7]">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 rounded-[4px] bg-[#C79A46] grid place-items-center text-[#152219]">◆</span>
                <div><div className="fraunces text-[15px]">The Belgrove Standard</div><div className="public text-[12px] text-[#B9C7BB]">6 checks before you ever see a plot</div></div>
              </div>
              <ul className="public text-[13px] leading-[1.6] text-[#D9E0D5] mt-4 grid grid-cols-2 gap-2">
                <li>• Title & ownership</li><li>• No encumbrance</li><li>• Boundaries & size</li><li>• Use & planning</li><li>• Access & utilities</li><li>• Possession</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-16">
          {[
            { label: "Transparency", body: "No hidden conditions, no rushed walkthroughs. Every fee in writing before you commit." },
            { label: "Craft", body: "Every listing photographed, staged, and priced with intention — like a Fortune 500 product." },
            { label: "Trust", body: "Long-term relationships over one-time closings. 1,200 families and counting." },
          ].map((v) => (
            <div key={v.label} className="bg-white border border-[#E0D5BB] rounded-[4px] p-6 hover:border-[#C79A46]/30 transition-colors">
              <h3 className="fraunces text-[18px] text-[#1F3328]">{v.label}</h3>
              <p className="public text-[13px] leading-[1.6] text-[#8B5E3C] mt-2">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-white border-y border-[#E0D5BB] py-16">
        <div className="max-w-[1180px] mx-auto px-6 lg:px-8">
          <h2 className="fraunces text-[26px] text-[#1F3328]">From coffee shop to 6 estates</h2>
          <div className="mt-8 grid md:grid-cols-4 gap-6">
            {[
              ["2008","Two advisers, one promise: tell the truth about land."],
              ["2013","Belgrove I — 112 plots, first to deliver school + market with phase 1."],
              ["2019","Belgrove III — 480 plots, still estate-managed."],
              ["2024","Belgrove IV — 1.4 km amenity spine, night aerial live."],
            ].map(([y,d])=>(
              <div key={y} className="border-l border-[#E0D5BB] pl-4">
                <div className="fraunces text-[22px] text-[#C79A46]">{y}</div>
                <div className="public text-[13px] text-[#8B5E3C] mt-1 leading-relaxed">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
```

## `src/app/(site)/gallery/page.tsx`

```tsx
import GalleryGrid from "./GalleryGrid";

export default function GalleryPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-20">
      <p className="uppercase tracking-widest text-stone-400 text-xs mb-4">Gallery</p>
      <h1 className="font-serif text-3xl md:text-4xl text-stone-800 mb-12">
        Properties &amp; projects
      </h1>
      <GalleryGrid />
    </div>
  );
}
```

## `src/app/(site)/gallery/GalleryGrid.tsx`

```tsx
"use client";

import { useState } from "react";
import { galleryItems, galleryCategories } from "@/lib/content";

export default function GalleryGrid() {
  const [category, setCategory] = useState<(typeof galleryCategories)[number]>("All");

  const filtered =
    category === "All" ? galleryItems : galleryItems.filter((item) => item.category === category);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-10">
        {galleryCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`text-sm px-4 py-2 rounded-full border transition-colors ${
              category === cat
                ? "bg-stone-800 text-white border-stone-800"
                : "border-stone-300 text-stone-600 hover:border-stone-500"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="aspect-square bg-stone-200 rounded-lg flex items-end p-4"
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-stone-500">{item.category}</p>
              <p className="text-sm text-stone-700">{item.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## `src/app/(site)/testimonials/page.tsx`

```tsx
import { testimonials } from "@/lib/content";

export default function TestimonialsPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      <p className="uppercase tracking-widest text-stone-400 text-xs mb-4">Testimonials</p>
      <h1 className="font-serif text-3xl md:text-4xl text-stone-800 mb-12">
        Stories from our clients
      </h1>

      <div className="grid md:grid-cols-2 gap-8">
        {testimonials.map((t) => (
          <blockquote key={t.name} className="bg-white p-6 rounded-lg border border-stone-200">
            <p className="text-stone-600 mb-4">&ldquo;{t.quote}&rdquo;</p>
            <footer className="text-sm text-stone-800 font-medium">
              {t.name} <span className="text-stone-400 font-normal">— {t.role}</span>
            </footer>
          </blockquote>
        ))}
      </div>
    </div>
  );
}
```

## `src/app/(site)/book-inspection/page.tsx`

```tsx
import BookingForm from "./BookingForm";

export default function BookInspectionPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F7F2E7]">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet" />
      <style>{`.fraunces{font-family:Fraunces,serif} .mono{font-family:IBM Plex Mono,monospace} .public{font-family:Public Sans,sans-serif}`}</style>

      <div className="grid lg:grid-cols-[0.92fr_1.08fr] min-h-[calc(100vh-64px)]">
        {/* Left — vertical split, high quality */}
        <div className="relative min-h-[420px] lg:min-h-full overflow-hidden bg-[#0F1A12]">
          <img src="/belgrove-inspection-team.jpg" alt="Belgrove team — WhatsApp Image 2026-09-06" className="absolute inset-0 w-full h-full object-cover" loading="eager" decoding="async" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,26,18,0.16) 0%, rgba(15,26,18,0.14) 45%, rgba(15,26,18,0.68) 100%)" }} />
          <div className="absolute left-6 right-6 bottom-6 lg:left-8 lg:right-8 lg:bottom-8">
            <div className="inline-flex mono text-[10px] tracking-[0.16em] uppercase bg-[#C79A46] text-[#1F3328] px-2.5 py-1 rounded-[2px] font-medium">No Rent Campaign</div>
            <h1 className="fraunces text-white leading-[0.94] mt-3" style={{ fontSize: "clamp(28px, 3vw, 34px)", textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}>
              Belgrove Helps You<br />Never Pay Rent Again.
            </h1>
            <p className="public text-white/90 text-[13px] leading-[1.6] mt-3 max-w-[36ch]" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
              Tired of rent receipts that build your landlord’s wealth, not yours? The No Rent Campaign turns tenants into owners. Own ground that grows, build when ready, and never pay rent again.
            </p>
            <div className="flex items-center gap-2 mt-4 mono text-[11px] text-white/85">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C79A46]" /> Own, Don’t Rent · Verified · Titled
            </div>
          </div>
        </div>

        {/* Right — form */}
        <div className="bg-[#F7F2E7] flex flex-col justify-center px-6 lg:px-12 py-10 lg:py-12">
          <div className="max-w-[520px] w-full mx-auto">
            <span className="mono text-[11px] tracking-[0.18em] uppercase text-[#C79A46]">Book Inspection — No Rent Campaign</span>
            <h2 className="fraunces text-[28px] leading-[1.05] text-[#1F3328] mt-2">Schedule a property inspection</h2>
            <p className="public text-[13.5px] leading-[1.6] text-[#8B5E3C] mt-3">
              Tell us where and when you’d like to visit, and we’ll confirm by email from <span className="font-medium text-[#1F3328]">notifications@belgrovehomes.com</span> with your tracking reference. Your ground awaits — rent-free.
            </p>
            <div className="mt-8">
              <BookingForm />
            </div>
            <p className="mono text-[10px] tracking-[0.06em] text-[#8B5E3C] mt-6 text-center">Verified · No hidden fees · Named adviser · Stop renting, start owning</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## `src/app/(site)/book-inspection/BookingForm.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { timeSlots } from "@/lib/content";

type FormState = {
  name: string;
  email: string;
  phone: string;
  preferredDate: string;
  preferredTime: string;
  location: string;
  agentName: string;
};

const initialState: FormState = {
  name: "",
  email: "",
  phone: "",
  preferredDate: "",
  preferredTime: "",
  location: "",
  agentName: "",
};

type CompanyAgentSuggestion = { name: string; category: "staff" | "hire_purchase" };

export default function BookingForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [agentSuggestions, setAgentSuggestions] = useState<CompanyAgentSuggestion[]>([]);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : { agents: [] }))
      .then((d) => setAgentSuggestions(d.agents ?? []))
      .catch(() => {});
  }, []);

  // Search by first name + surname: matches any token or substring, case-insensitive.
  function isAgentMatch(input: string, agentName: string): boolean {
    const q = input.trim().toLowerCase();
    if (q.length < 2) return false;
    const name = agentName.toLowerCase();
    if (name.includes(q)) return true;
    const qTokens = q.split(/\s+/).filter(Boolean);
    const nameTokens = name.split(/\s+/).filter(Boolean);
    return qTokens.some((qt) => nameTokens.some((nt) => nt === qt || (qt.length >= 3 && nt.includes(qt)) || (nt.length >= 3 && qt.includes(nt))));
  }

  const filteredAgents = form.agentName.trim()
    ? agentSuggestions.filter((a) => isAgentMatch(form.agentName, a.name))
    : agentSuggestions;

  const matchedAgent = form.agentName.trim() ? agentSuggestions.find((a) => isAgentMatch(form.agentName, a.name)) ?? null : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setRef(data.ref);
      setForm(initialState);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ref) {
    return (
      <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
        <p className="text-sm uppercase tracking-widest text-stone-400 mb-2">Booking Confirmed</p>
        <h2 className="font-serif text-2xl text-stone-800 mb-4">Thank you!</h2>
        <p className="text-stone-600 mb-4">
          Your inspection request has been received. Check your email for confirmation.
        </p>
        <p className="text-stone-500 text-sm">Your reference code:</p>
        <p className="font-mono text-lg text-stone-800 font-semibold mb-6">{ref}</p>
        <button
          onClick={() => setRef(null)}
          className="text-sm text-stone-600 underline"
        >
          Book another inspection
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded-lg p-8 space-y-5">
      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="name">
          Name *
        </label>
        <input
          id="name"
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="email">
          Email *
        </label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="phone">
          Phone number *
        </label>
        <input
          id="phone"
          type="tel"
          required
          placeholder="+234 801 234 5678"
          value={form.phone}
          onChange={(e) => update("phone", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-stone-600 mb-1" htmlFor="date">
            Date *
          </label>
          <input
            id="date"
            type="date"
            required
            min={new Date().toISOString().split("T")[0]}
            value={form.preferredDate}
            onChange={(e) => update("preferredDate", e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          />
        </div>
        <div>
          <label className="block text-sm text-stone-600 mb-1" htmlFor="time">
            Time *
          </label>
          <select
            id="time"
            required
            value={form.preferredTime}
            onChange={(e) => update("preferredTime", e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
          >
            <option value="" disabled>
              Select a time
            </option>
            {timeSlots.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="location">
          Location of interest *
        </label>
        <input
          id="location"
          required
          placeholder="Address, neighborhood, or listing"
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
      </div>

      <div>
        <label className="block text-sm text-stone-600 mb-1" htmlFor="agentName">
          Agent name <span className="text-stone-400">(optional)</span>
        </label>
        <input
          id="agentName"
          list="company-agents"
          value={form.agentName}
          onChange={(e) => update("agentName", e.target.value)}
          placeholder={agentSuggestions.length ? "Start typing — company agents appear" : "Optional — e.g. Ada Okafor"}
          className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
        />
        <datalist id="company-agents">
          {filteredAgents.map((a) => (
            <option key={a.name} value={a.name}>
              {a.category === "hire_purchase" ? "Hire Purchase" : "Staff"}
            </option>
          ))}
        </datalist>
        {form.agentName.trim() ? (
          matchedAgent ? (
            <p className="mono text-[11px] mt-1 text-emerald-700">✓ Agent name matches that of DB: <span className="font-medium">{matchedAgent.name}</span> — {matchedAgent.category === "hire_purchase" ? "Hire Purchase" : "Staff"} — admin will see tally</p>
          ) : (
            <p className="mono text-[11px] mt-1 text-stone-400">No match — “{form.agentName.trim()}” not in company DB — admin will flag as external/unverified</p>
          )
        ) : agentSuggestions.length > 0 ? (
          <p className="mono text-[11px] mt-1 text-stone-400">{agentSuggestions.length} company agents available — pick one (search by first name or surname) or leave blank for admin to assign</p>
        ) : null}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-stone-800 text-white rounded py-3 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Book Inspection"}
      </button>
    </form>
  );
}
```

## `src/app/admin/layout.tsx`

```tsx
import AdminTopBar from "@/components/admin/AdminTopBar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <AdminTopBar />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

## `src/app/admin/login/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }

    router.push("/admin/bookings");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-lg p-8 shadow-sm">
        <h1 className="text-xl font-serif text-stone-800 mb-1">Belgrove Homes</h1>
        <p className="text-sm text-stone-500 mb-6">Admin dashboard sign in</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-stone-600 mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>
          <div>
            <label className="block text-sm text-stone-600 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-800 text-white rounded py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

## `src/app/admin/bookings/page.tsx`

```tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { Prisma, BookingStatus, LeadTemperature } from "@/generated/prisma/client";
import { allStatuses, allTemperatures, statusColors, statusLabels, temperatureColors, formatDate } from "@/lib/booking-ui";
import AgentNameCell from "./AgentNameCell";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = {
  status?: string;
  leadTemperature?: string;
  missingAgent?: string;
  page?: string;
};

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const where: Prisma.InspectionBookingWhereInput = {};
  if (params.status && (allStatuses as readonly string[]).includes(params.status)) {
    where.status = params.status as BookingStatus;
  }
  if (
    params.leadTemperature &&
    (allTemperatures as readonly string[]).includes(params.leadTemperature)
  ) {
    where.leadTemperature = params.leadTemperature as LeadTemperature;
  }
  // "Missing agent" now means no company agent assigned (agentId null) — these are the bookings an admin needs to triage.
  // Keeps backward compat for old data where agentName was the only signal: also covers agentName null.
  if (params.missingAgent === "1") {
    where.OR = [{ agentId: null }, { agent: null }];
    // Equivalent to agentId null; Prisma OR with single condition is same as { agentId: null }
    // but we also keep agentName tally visible — unassigned means agent relation missing.
    where.agentId = null;
    delete (where as Record<string, unknown>).OR;
  }

  const [bookings, total, allAgents] = await Promise.all([
    prisma.inspectionBooking.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { agent: true },
    }),
    prisma.inspectionBooking.count({ where }),
    prisma.agent.findMany({ where: { isActive: true }, select: { name: true, category: true } }),
  ]);

  // Token-aware tally (first name / surname) — matches BookingForm logic
  function isTallyMatch(input: string, dbName: string): boolean {
    const q = input.trim().toLowerCase();
    const n = dbName.toLowerCase();
    if (n.includes(q)) return true;
    const qTokens = q.split(/\s+/).filter(Boolean);
    const nTokens = n.split(/\s+/).filter(Boolean);
    return qTokens.some((qt) => nTokens.some((nt) => nt === qt || (qt.length >= 3 && nt.includes(qt))));
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildQuery(overrides: Partial<SearchParams>) {
    const merged = { ...params, ...overrides };
    const qs = new URLSearchParams();
    if (merged.status) qs.set("status", merged.status);
    if (merged.leadTemperature) qs.set("leadTemperature", merged.leadTemperature);
    if (merged.missingAgent) qs.set("missingAgent", merged.missingAgent);
    if (merged.page && merged.page !== "1") qs.set("page", merged.page);
    const str = qs.toString();
    return str ? `?${str}` : "";
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-stone-800">Inspection Bookings</h1>
        <a
          href={`/api/admin/bookings/export${buildQuery({ page: undefined })}`}
          className="text-sm border border-stone-300 rounded px-4 py-2 hover:bg-stone-100"
        >
          Export CSV
        </a>
      </div>

      <form className="flex flex-wrap gap-3 mb-6" action="/admin/bookings" method="get">
        <select
          name="status"
          defaultValue={params.status ?? ""}
          className="border border-stone-300 rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">All statuses</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s]}
            </option>
          ))}
        </select>

        <select
          name="leadTemperature"
          defaultValue={params.leadTemperature ?? ""}
          className="border border-stone-300 rounded px-3 py-2 text-sm bg-white"
        >
          <option value="">All temperatures</option>
          {allTemperatures.map((t) => (
            <option key={t} value={t}>
              {t[0].toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm border border-stone-300 rounded px-3 py-2 bg-white">
          <input
            type="checkbox"
            name="missingAgent"
            value="1"
            defaultChecked={params.missingAgent === "1"}
          />
          Missing agent
        </label>

        <button type="submit" className="text-sm bg-stone-800 text-white rounded px-4 py-2">
          Filter
        </button>
        {(params.status || params.leadTemperature || params.missingAgent) && (
          <Link href="/admin/bookings" className="text-sm text-stone-500 self-center underline">
            Clear
          </Link>
        )}
      </form>

      <div className="bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="px-4 py-3 font-medium">Ref</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Date &amp; time</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Agent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Lead</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/admin/bookings/${b.id}`} className="text-stone-800 hover:underline">
                    {b.ref}
                  </Link>
                </td>
                <td className="px-4 py-3">{b.name}</td>
                <td className="px-4 py-3 text-stone-500">
                  {b.rescheduledDate ? (
                    <>
                      <div>
                        {formatDate(b.rescheduledDate)} at {b.rescheduledTime}
                      </div>
                      <div className="text-xs text-purple-600">rescheduled</div>
                    </>
                  ) : (
                    <div>
                      {formatDate(b.preferredDate)} at {b.preferredTime}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-stone-500 max-w-[200px] truncate">{b.location}</td>
                <td className="px-4 py-3">
                  {(b as unknown as { agent: { name: string; category: string; email: string } | null }).agent ? (
                    (() => {
                      const ag = (b as unknown as { agent: { name: string; category: string; email: string } | null }).agent!;
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-stone-800">{ag.name}</span>
                          <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] ${ag.category === "staff" ? "bg-stone-800 text-white" : "bg-amber-100 text-amber-800"}`}>
                            {ag.category === "hire_purchase" ? "Hire Purchase" : "Staff"} · Company
                          </span>
                        </div>
                      );
                    })()
                  ) : b.agentName ? (
                    (() => {
                      const hit = allAgents.find((a) => isTallyMatch(b.agentName!, a.name));
                      const match = hit?.category ?? null;
                      return (
                        <div className="flex flex-col gap-1">
                          <AgentNameCell bookingId={b.id} initialValue={b.agentName} updatedAt={b.updatedAt} />
                          {match ? (
                            <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] ${match === "staff" ? "bg-stone-100 text-stone-700 border border-stone-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                              ✓ Agent name matches that of DB: {hit!.name} — {match === "hire_purchase" ? "Hire Purchase" : "Staff"}
                            </span>
                          ) : (
                            <span className="inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] bg-red-50 text-red-600 border border-red-200">Not in company DB — external</span>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col gap-1">
                      <AgentNameCell bookingId={b.id} initialValue={b.agentName} updatedAt={b.updatedAt} />
                      <span className="text-xs text-stone-400 italic">Unassigned — <Link href={`/admin/bookings/${b.id}`} className="underline text-stone-600">assign</Link></span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${statusColors[b.status]}`}>
                    {statusLabels[b.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${temperatureColors[b.leadTemperature]}`}
                  >
                    {b.leadTemperature}
                  </span>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-stone-400">
                  No bookings match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-stone-500">
          <span>
            Page {page} of {totalPages} &middot; {total} bookings
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/bookings${buildQuery({ page: String(page - 1) })}`}
                className="border border-stone-300 rounded px-3 py-1 hover:bg-stone-100"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/bookings${buildQuery({ page: String(page + 1) })}`}
                className="border border-stone-300 rounded px-3 py-1 hover:bg-stone-100"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

## `src/app/admin/bookings/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
import { statusColors, statusLabels, temperatureColors, formatDate, formatDateTime } from "@/lib/booking-ui";
import BookingActions from "./BookingActions";
import ActivityTimeline from "./ActivityTimeline";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [booking, staffUsers, agents, activities, messages] = await Promise.all([
    prisma.inspectionBooking.findUnique({
      where: { id },
      include: { assignedToUser: true, reviewedByUser: true, agent: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["admin", "staff"] } },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.agent.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true, phone: true, category: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    prisma.bookingActivity.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bookingMessage.findMany({
      where: { bookingId: id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!booking) notFound();

  const allAgentsForTally = await prisma.agent.findMany({ select: { name: true, category: true } });
  // Token-aware tally for site form (first name / surname substring) to match BookingForm behavior
  function isTallyMatch(input: string, dbName: string): boolean {
    const q = input.trim().toLowerCase();
    const n = dbName.toLowerCase();
    if (n.includes(q)) return true;
    const qTokens = q.split(/\s+/);
    const nTokens = n.split(/\s+/);
    return qTokens.some((qt) => nTokens.some((nt) => nt === qt || (qt.length >= 3 && nt.includes(qt))));
  }
  // If company agent already assigned, site form value is synced — show as matched to assigned agent.
  // Otherwise, search DB by first name / surname tokens for tally.
  const visitorAgentTally = booking.agent
    ? booking.agent.category
    : booking.agentName
      ? (() => {
          const hit = allAgentsForTally.find((a) => isTallyMatch(booking.agentName!, a.name));
          return hit?.category ?? null;
        })()
      : null;

  const pipeline = ["new", "under_review", "approved", "active", "closed"] as const;
  const currentIdx = pipeline.indexOf(booking.status as (typeof pipeline)[number]);
  const isClosed = booking.status === "closed";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-stone-500 mb-4">
        <Link href="/admin/bookings" className="hover:text-stone-800 hover:underline">
          ← Bookings
        </Link>
        <span className="text-stone-300">/</span>
        <span className="text-stone-800 font-medium">{booking.ref}</span>
        <span className="text-stone-300">·</span>
        <span className="text-stone-400">{booking.name}</span>
      </div>

      {/* Header — professional */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl font-medium text-stone-800 tracking-tight">{booking.ref}</h1>
              <span className="font-mono text-xs text-stone-400 border border-stone-200 rounded px-2 py-1">{booking.id.slice(0, 8)}</span>
            </div>
            <p className="text-stone-600 mt-1">
              <span className="font-medium text-stone-800">{booking.name}</span>
              <span className="text-stone-400"> · </span>
              <a href={`mailto:${booking.email}`} className="text-stone-500 hover:text-stone-800 underline decoration-stone-300">
                {booking.email}
              </a>
              {booking.phone && (
                <>
                  <span className="text-stone-300"> · </span>
                  <a href={`tel:${booking.phone}`} className="text-stone-500 hover:text-stone-800">
                    {booking.phone}
                  </a>
                </>
              )}
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Submitted {formatDateTime(booking.createdAt)} · Updated {formatDateTime(booking.updatedAt)}
              {booking.reviewedByUser && <> · Reviewed by {booking.reviewedByUser.name}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${statusColors[booking.status]} border-transparent`}>{statusLabels[booking.status]}</span>
            <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${temperatureColors[booking.leadTemperature]} border-transparent`}>Lead: {booking.leadTemperature}</span>
            {booking.agent && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${booking.agent.category === "staff" ? "bg-stone-800 text-white" : "bg-amber-100 text-amber-800 border border-amber-200"}`}>
                {booking.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"} · {booking.agent.name}
              </span>
            )}
            {booking.outcome && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-medium ${booking.outcome === "sold" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-stone-100 text-stone-600 border border-stone-200"}`}>
                {booking.outcome === "sold" ? "Sold" : "Not sold"}
              </span>
            )}
          </div>
        </div>

        {/* Pipeline progress */}
        <div className="mt-6">
          <div className="flex items-center gap-1.5">
            {pipeline.map((step, idx) => {
              const active = idx <= currentIdx && currentIdx !== -1;
              const isCurrent = idx === currentIdx;
              return (
                <div key={step} className="flex items-center gap-1.5 flex-1">
                  <div className={`h-1.5 flex-1 rounded-full ${active ? (isCurrent ? "bg-stone-800" : "bg-emerald-500") : "bg-stone-200"}`} />
                  {idx < pipeline.length - 1 && <div className="h-px w-2 bg-stone-200 hidden md:block" />}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[10px] tracking-wide uppercase text-stone-400">
            <span>New</span>
            <span>Review</span>
            <span>Approved</span>
            <span>Active</span>
            <span>Closed</span>
          </div>
        </div>
      </div>

      {/* Booking details — 2-col pro */}
      <div className="mt-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-5">
            <span className="h-6 w-6 rounded bg-stone-800 text-white grid place-items-center text-xs">▦</span>
            Booking Details
            <span className="ml-auto text-xs font-normal text-stone-400">{booking.location}</span>
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            <div className="col-span-2 md:col-span-1">
              <dt className="text-xs tracking-wide uppercase text-stone-400">Client</dt>
              <dd className="mt-1 font-medium text-stone-800">{booking.name}</dd>
              <dd className="text-xs text-stone-500">{booking.email} {booking.phone ? `· ${booking.phone}` : ""}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide uppercase text-stone-400">Inspection</dt>
              <dd className="mt-1 text-stone-800">{formatDate(booking.preferredDate)} at {booking.preferredTime}</dd>
              <dd className="text-xs text-stone-500">{booking.location}</dd>
              {booking.rescheduledDate && (
                <dd className="mt-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-1 inline-flex">
                  Rescheduled → {formatDate(booking.rescheduledDate)} at {booking.rescheduledTime}
                </dd>
              )}
            </div>
            <div className="col-span-2 border-t border-stone-100 pt-4">
              <dt className="text-xs tracking-wide uppercase text-stone-400">Company Agent (assigned)</dt>
              <dd className="mt-2">
                {booking.agent ? (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
                    <div className="h-9 w-9 rounded-full bg-stone-800 text-white grid place-items-center text-xs font-medium">
                      {booking.agent.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800">{booking.agent.name}</div>
                      <div className="text-xs text-stone-500">{booking.agent.email} · {booking.agent.phone}</div>
                      <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs ${booking.agent.category === "staff" ? "bg-stone-800 text-white" : "bg-amber-100 text-amber-800 border border-amber-200"}`}>
                        {booking.agent.category === "hire_purchase" ? "Hire Purchase" : "Staff"} · Company DB
                      </span>
                    </div>
                    <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-1">Assigned</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                    <span className="text-amber-800 font-medium">Not assigned</span>
                    <span className="text-amber-700"> — use </span>
                    <a href="#assign-agent" className="underline font-medium">Company Agent</a>
                    <span className="text-amber-700"> below to assign. Unassigned bookings appear in </span>
                    <Link href="/admin/bookings?missingAgent=1" className="underline">
                      Missing agent
                    </Link>
                    <span className="text-amber-700"> filter.</span>
                  </div>
                )}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs tracking-wide uppercase text-stone-400">Agent (site form) — visitor input</dt>
              <dd className="mt-2">
                {booking.agentName ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-stone-800">{booking.agentName}</span>
                    {visitorAgentTally ? (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${visitorAgentTally === "staff" ? "bg-stone-100 text-stone-700 border-stone-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        ✓ Matches DB: {visitorAgentTally === "hire_purchase" ? "Hire Purchase" : "Staff"}
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200">Not in company DB — external</span>
                    )}
                  </div>
                ) : (
                  <span className="text-stone-400 italic">None provided — visitor left blank, admin to assign</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide uppercase text-stone-400">Assigned to (internal user)</dt>
              <dd className="mt-1 text-stone-800">{booking.assignedToUser?.name ?? <span className="text-stone-400 italic">Unassigned</span>}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide uppercase text-stone-400">Lead</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 rounded-full text-xs ${temperatureColors[booking.leadTemperature]}`}>{booking.leadTemperature}</span>
                <span className="text-xs text-stone-400 ml-2">status: {statusLabels[booking.status]}</span>
              </dd>
            </div>
            {booking.internalNote && (
              <div className="col-span-2">
                <dt className="text-xs tracking-wide uppercase text-stone-400">Internal note</dt>
                <dd className="mt-1 p-3 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-700 whitespace-pre-wrap">{booking.internalNote}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-6">
          <h3 className="text-xs tracking-wide uppercase text-stone-400">Quick Stats</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Messages</span>
              <span className="font-medium text-stone-800">{messages.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Activities</span>
              <span className="font-medium text-stone-800">{activities.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-500">Company agents</span>
              <span className="font-medium text-stone-800">{agents.length} active</span>
            </div>
            <div className="pt-3 border-t border-stone-100">
              <div className="text-xs text-stone-400">Ref</div>
              <div className="font-mono text-sm font-medium text-stone-800">{booking.ref}</div>
              <div className="text-xs text-stone-400 mt-1">{booking.phone ?? "No phone"}</div>
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Link href="/admin/bookings" className="flex-1 text-center text-sm border border-stone-300 rounded-lg py-2 hover:bg-stone-50">
              Back to bookings
            </Link>
            <Link href="/admin/agents" className="flex-1 text-center text-sm bg-stone-800 text-white rounded-lg py-2 hover:bg-stone-700">
              Manage agents
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <BookingActions booking={booking} staffUsers={staffUsers} agents={agents} initialMessages={messages} isClosed={isClosed} />
      </div>

      <div className="mt-6">
        <ActivityTimeline activities={activities} />
      </div>
    </div>
  );
}
```

## `src/app/admin/bookings/[id]/BookingActions.tsx`

```tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional prop->state sync after router.refresh */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isTransitionAllowed, temperatureRank } from "@/lib/booking-transitions";
import { timeSlots } from "@/lib/content";
import type { BookingStatus, LeadTemperature } from "@/generated/prisma/client";

type Booking = {
  id: string;
  status: BookingStatus;
  leadTemperature: LeadTemperature;
  agentName: string | null;
  agentId?: string | null;
  internalNote: string | null;
  assignedToId: string | null;
  updatedAt: Date;
};

type StaffUser = { id: string; name: string; email: string };

type CompanyAgent = { id: string; name: string; email: string; phone: string; category: "staff" | "hire_purchase" };

type EmailResult = { sent: boolean; error: string | null };

type BookingMessage = { id: string; authorName: string; message: string; createdAt: string | Date };

const temperatureOrder: LeadTemperature[] = ["cold", "warm", "hot"];

export default function BookingActions({
  booking,
  staffUsers,
  agents,
  initialMessages = [],
  isClosed = false,
}: {
  booking: Booking;
  staffUsers: StaffUser[];
  agents: CompanyAgent[];
  initialMessages?: BookingMessage[];
  isClosed?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [lastEmail, setLastEmail] = useState<EmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(booking.updatedAt.toISOString());

  const [rescheduledDate, setRescheduledDate] = useState("");
  const [rescheduledTime, setRescheduledTime] = useState("");
  const [internalNote, setInternalNote] = useState(booking.internalNote ?? "");
  const [agentName, setAgentName] = useState(booking.agentName ?? "");
  const [assignedToId, setAssignedToId] = useState(booking.assignedToId ?? "");
  const [reviewAssignedToId, setReviewAssignedToId] = useState(booking.assignedToId ?? "");
  const [activeNote, setActiveNote] = useState("");

  // Per-action optional notes — kept separate (not one shared box) so a note
  // typed for one action never accidentally rides along with a different
  // button click.
  const [approveNote, setApproveNote] = useState("");
  const [holdNote, setHoldNote] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [rescheduleNote, setRescheduleNote] = useState("");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [escalateNote, setEscalateNote] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState(booking.agentId ?? "");
  const [assignNote, setAssignNote] = useState("");
  const [messages, setMessages] = useState<BookingMessage[]>(initialMessages);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Sync messages when booking changes (e.g., after router.refresh server fetch)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // The server component re-renders BookingActions with a fresh `booking`
  // prop after every router.refresh() — including after another admin's
  // change (surfaced as 409). useEffect syncs local editable fields to the
  // canonical booking when updatedAt changes, avoiding render-time setState
  // anti-pattern and the extra rerender cascade.
  const bookingAgentId = (booking as unknown as { agentId?: string | null }).agentId ?? null;
  const [syncedUpdatedAt, setSyncedUpdatedAt] = useState(booking.updatedAt.toISOString());
  useEffect(() => {
    const fresh = booking.updatedAt.toISOString();
    if (fresh !== syncedUpdatedAt) {
      setSyncedUpdatedAt(fresh);
      setExpectedUpdatedAt(fresh);
      setAgentName(booking.agentName ?? "");
      setInternalNote(booking.internalNote ?? "");
      setAssignedToId(booking.assignedToId ?? "");
      setReviewAssignedToId(booking.assignedToId ?? "");
      setSelectedAgentId(bookingAgentId ?? "");
    }
  }, [booking.updatedAt, booking.agentName, booking.internalNote, booking.assignedToId, bookingAgentId, syncedUpdatedAt]);

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(action);
    setError(null);
    setConflict(false);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, expectedUpdatedAt, ...payload }),
      });
      const data = await res.json();

      if (res.status === 409) {
        setConflict(true);
        setError(data.error ?? "This booking changed elsewhere. Refresh to see the latest.");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Action failed");
      }

      setLastEmail(data.emailResult);
      setExpectedUpdatedAt(data.booking.updatedAt);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || messageSending) return;
    setMessageSending(true);
    setMessageError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${booking.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send message");
      setMessages((m) => [...m, data.message]);
      setMessageText("");
      router.refresh();
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setMessageSending(false);
    }
  }

  const status = booking.status;
  const showReview =
    isTransitionAllowed("approve", status) ||
    isTransitionAllowed("hold", status) ||
    isTransitionAllowed("under_review", status) ||
    isTransitionAllowed("reschedule", status);
  const showMarkActive = isTransitionAllowed("mark_active", status);
  const showOutcome = isTransitionAllowed("record_outcome", status);

  const currentRank = temperatureRank[booking.leadTemperature];
  const escalationTargets = temperatureOrder.filter((t) => temperatureRank[t] > currentRank);

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3 flex items-center justify-between gap-4">
          <span>{error}</span>
          {conflict && (
            <button
              onClick={() => router.refresh()}
              className="shrink-0 text-xs bg-red-700 text-white rounded px-3 py-1"
            >
              Refresh
            </button>
          )}
        </div>
      )}

      {showReview && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="h-6 w-6 rounded bg-stone-800 text-white grid place-items-center text-xs">◎</span>
            Review <span className="text-xs font-normal text-stone-400">· approve / hold / reschedule</span>
          </h2>

          {isTransitionAllowed("approve", status) && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={approveNote}
                onChange={(e) => setApproveNote(e.target.value)}
                placeholder="Note (optional)"
                className="border border-stone-300 rounded px-2 py-2 text-sm flex-1 min-w-[160px]"
              />
              <button
                onClick={() => run("approve", { note: approveNote || undefined })}
                disabled={busy !== null}
                className="text-sm bg-emerald-700 text-white rounded px-4 py-2 disabled:opacity-50 shrink-0"
              >
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            </div>
          )}

          {isTransitionAllowed("hold", status) && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={holdNote}
                onChange={(e) => setHoldNote(e.target.value)}
                placeholder="Note (optional)"
                className="border border-stone-300 rounded px-2 py-2 text-sm flex-1 min-w-[160px]"
              />
              <button
                onClick={() => run("hold", { note: holdNote || undefined })}
                disabled={busy !== null}
                className="text-sm bg-orange-600 text-white rounded px-4 py-2 disabled:opacity-50 shrink-0"
              >
                {busy === "hold" ? "Updating…" : "Put on hold"}
              </button>
            </div>
          )}

          {isTransitionAllowed("under_review", status) && (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={reviewAssignedToId}
                onChange={(e) => setReviewAssignedToId(e.target.value)}
                className="border border-stone-300 rounded px-2 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <input
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Note (optional)"
                className="border border-stone-300 rounded px-2 py-2 text-sm flex-1 min-w-[160px]"
              />
              <button
                onClick={() =>
                  run("under_review", {
                    assignedToId: reviewAssignedToId || null,
                    note: reviewNote || undefined,
                  })
                }
                disabled={busy !== null}
                className="text-sm bg-amber-600 text-white rounded px-4 py-2 disabled:opacity-50 shrink-0"
              >
                {busy === "under_review" ? "Updating…" : "Mark under review"}
              </button>
            </div>
          )}

          {isTransitionAllowed("reschedule", status) && (
            <div className="border-t border-stone-100 pt-4">
              <p className="text-xs text-stone-500 mb-2">Reschedule</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-stone-400 mb-1">New date</label>
                  <input
                    type="date"
                    value={rescheduledDate}
                    onChange={(e) => setRescheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border border-stone-300 rounded px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-stone-400 mb-1">New time</label>
                  <select
                    value={rescheduledTime}
                    onChange={(e) => setRescheduledTime(e.target.value)}
                    className="border border-stone-300 rounded px-2 py-2 text-sm bg-white"
                  >
                    <option value="" disabled>
                      Select a time
                    </option>
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-stone-400 mb-1">Note (optional)</label>
                  <input
                    value={rescheduleNote}
                    onChange={(e) => setRescheduleNote(e.target.value)}
                    className="w-full border border-stone-300 rounded px-2 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={() =>
                    run("reschedule", {
                      rescheduledDate,
                      rescheduledTime,
                      note: rescheduleNote || undefined,
                    })
                  }
                  disabled={busy !== null || !rescheduledDate || !rescheduledTime}
                  className="text-sm bg-purple-700 text-white rounded px-4 py-2 disabled:opacity-50"
                >
                  {busy === "reschedule" ? "Rescheduling…" : "Reschedule"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {showMarkActive && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-4">
            <span className="h-6 w-6 rounded bg-teal-600 text-white grid place-items-center text-xs">✓</span>
            Mark inspection as held
          </h2>
          <textarea
            value={activeNote}
            onChange={(e) => setActiveNote(e.target.value)}
            placeholder="What happened at the inspection session?"
            rows={3}
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm mb-3"
          />
          <button
            onClick={() => run("mark_active", { internalNote: activeNote })}
            disabled={busy !== null || !activeNote.trim()}
            className="text-sm bg-teal-700 text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {busy === "mark_active" ? "Saving…" : "Mark as active"}
          </button>
        </div>
      )}

      {showOutcome && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-4">
            <span className="h-6 w-6 rounded bg-emerald-600 text-white grid place-items-center text-xs">★</span>
            Record sale outcome
          </h2>
          <input
            value={outcomeNote}
            onChange={(e) => setOutcomeNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full border border-stone-300 rounded px-3 py-2 text-sm mb-3"
          />
          <div className="flex gap-3">
            <button
              onClick={() => run("record_outcome", { outcome: "sold", note: outcomeNote || undefined })}
              disabled={busy !== null}
              className="text-sm bg-emerald-700 text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {busy === "record_outcome" ? "Saving…" : "Sold"}
            </button>
            <button
              onClick={() =>
                run("record_outcome", { outcome: "not_sold", note: outcomeNote || undefined })
              }
              disabled={busy !== null}
              className="text-sm bg-stone-600 text-white rounded px-4 py-2 disabled:opacity-50"
            >
              {busy === "record_outcome" ? "Saving…" : "Not sold"}
            </button>
          </div>
        </div>
      )}

      <div id="assign-agent" className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
          <span className="h-6 w-6 rounded bg-stone-800 text-white grid place-items-center text-xs">◈</span>
          Company Agent
          <span className="text-xs font-normal text-stone-400">· staff / hire-purchase</span>
        </h2>
        <p className="text-xs text-stone-500 mt-1 mb-4">Assign unassigned bookings to a company agent. The agent is emailed client details to follow up. Site-form tally shows match.</p>
        {agents.length === 0 ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">No company agents yet — <a href="/admin/agents" className="underline">add agents</a> first.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="border border-stone-300 rounded px-3 py-2 text-sm bg-white flex-1 min-w-[200px]"
              >
                <option value="">— Unassigned —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.category === "hire_purchase" ? "Hire Purchase" : "Staff"} ({a.email})
                  </option>
                ))}
              </select>
              <input
                value={assignNote}
                onChange={(e) => setAssignNote(e.target.value)}
                placeholder="Note to agent (optional)"
                className="border border-stone-300 rounded px-3 py-2 text-sm flex-1 min-w-[160px]"
              />
              <button
                onClick={() => run("assign_agent", { agentId: selectedAgentId || null, note: assignNote || undefined })}
                disabled={busy !== null}
                className="text-sm bg-stone-800 text-white rounded px-4 py-2 disabled:opacity-50 shrink-0"
              >
                {busy === "assign_agent" ? "Assigning…" : selectedAgentId ? "Assign & notify" : "Unassign"}
              </button>
            </div>
            <p className="text-xs text-stone-400 mt-2">Current: <span className="font-medium text-stone-700">{booking.agentName || "None"}</span> {booking.agentId ? <span className="text-emerald-600">· Company agent assigned</span> : <span className="text-amber-600">· Not yet assigned to company DB</span>} — email sent to agent on assign.</p>
          </>
        )}
      </div>

      {/* Messaging System — appears right after assignment, persists until closed */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-stone-800 text-white grid place-items-center text-xs">💬</span>
            Messaging System
            <span className="text-xs font-normal text-stone-500">· follow-up thread</span>
          </h2>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isClosed ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-700 border border-emerald-200"}`}>
            {isClosed ? "Closed — read-only" : `${messages.length} messages`}
          </span>
        </div>
        <p className="text-xs text-stone-500 mb-4">{isClosed ? "Booking is closed — thread is read-only for audit." : "Post contact notes, follow-up reminders, and internal updates. Visible to all admins until booking is closed."}</p>

        {messages.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
            <p className="text-sm text-stone-500">No messages yet</p>
            <p className="text-xs text-stone-400 mt-1">Start the thread after assigning a company agent.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3 p-3 rounded-xl border border-stone-100 bg-stone-50/60">
                <div className="h-8 w-8 rounded-full bg-stone-800 text-white grid place-items-center text-xs shrink-0 font-medium">
                  {m.authorName
                    .split(" ")
                    .map((s) => s[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-stone-800">{m.authorName}</span>
                    <span className="text-xs text-stone-400 shrink-0">{new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-sm text-stone-600 mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isClosed ? (
          <div className="mt-5">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="e.g. Called client — confirmed Thu 10am, sent pin. Next: dispatch Ada."
              rows={3}
              className="w-full border border-stone-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-stone-400">{messageText.length}/5000</span>
              <button onClick={sendMessage} disabled={!messageText.trim() || messageSending} className="text-sm bg-stone-800 text-white rounded-lg px-5 py-2.5 font-medium hover:bg-stone-700 disabled:opacity-50">
                {messageSending ? "Sending…" : "Send message"}
              </button>
            </div>
            {messageError && <p className="text-xs text-red-600 mt-2">{messageError}</p>}
          </div>
        ) : (
          <div className="mt-5 p-3 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-500 text-center">🔒 Closed — messaging is read-only. See timeline for final outcome.</div>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-3">
          <span className="h-6 w-6 rounded bg-red-600 text-white grid place-items-center text-xs">◐</span>
          Lead temperature
        </h2>
        <p className="text-sm text-stone-600 mb-3">
          Currently <span className="font-medium capitalize">{booking.leadTemperature}</span>. This can only
          be raised manually — the one automatic downgrade is a &ldquo;not sold&rdquo; outcome
          setting it to warm.
        </p>
        {escalationTargets.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={escalateNote}
              onChange={(e) => setEscalateNote(e.target.value)}
              placeholder="Note (optional)"
              className="border border-stone-300 rounded px-2 py-2 text-sm flex-1 min-w-[160px]"
            />
            {escalationTargets.map((t) => (
              <button
                key={t}
                onClick={() =>
                  run("escalate_lead", { leadTemperature: t, note: escalateNote || undefined })
                }
                disabled={busy !== null}
                className="text-sm bg-red-600 text-white rounded px-4 py-2 disabled:opacity-50 shrink-0"
              >
                {busy === "escalate_lead" ? "Updating…" : `Mark as ${t}`}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-400">Already at the highest temperature.</p>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2 mb-4">
          <span className="h-6 w-6 rounded bg-stone-100 border border-stone-200 grid place-items-center text-xs">✎</span>
          Edit fields
        </h2>
        <div className="grid gap-4">
          <div>
            <label className="block text-xs text-stone-400 mb-1">Agent name</label>
            <input
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">Assigned to</label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm bg-white"
            >
              <option value="">Unassigned</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-stone-400 mb-1">Internal note</label>
            <textarea
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              rows={3}
              className="w-full border border-stone-300 rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          onClick={() =>
            run("save", { agentName, internalNote, assignedToId: assignedToId || null })
          }
          disabled={busy !== null}
          className="mt-4 text-sm border border-stone-300 rounded px-4 py-2 hover:bg-stone-50 disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
      </div>

      {lastEmail && !conflict && (
        <>
          {lastEmail.sent && <p className="text-xs text-emerald-600">Email sent.</p>}
          {!lastEmail.sent && lastEmail.error && (
            <p className="text-xs text-red-600">Email failed: {lastEmail.error}</p>
          )}
        </>
      )}
    </div>
  );
}
```

## `src/app/admin/bookings/[id]/BookingMessages.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  authorName: string;
  message: string;
  createdAt: string | Date;
};

export default function BookingMessages({
  bookingId,
  initialMessages,
  isClosed,
}: {
  bookingId: string;
  initialMessages: Message[];
  isClosed: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setMessages((m) => [...m, data.message]);
      setText("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-stone-800 text-white grid place-items-center text-xs">💬</span>
            Messaging System
            <span className="text-xs font-normal text-stone-500">· internal follow-up thread</span>
          </h2>
          <span className={`text-xs px-2 py-1 rounded-full ${isClosed ? "bg-stone-200 text-stone-600" : "bg-emerald-100 text-emerald-700"}`}>
            {isClosed ? "Closed — read-only" : `${messages.length} messages`}
          </span>
        </div>
        <p className="text-xs text-stone-500 mt-2">
          {isClosed ? "Booking closed — messaging is now read-only for audit. Review timeline below." : "Post updates, client contact notes, and follow-up reminders here. Thread persists until booking is closed."}
        </p>
      </div>

      <div className="px-6 py-4">
        {messages.length === 0 ? (
          <div className="py-10 text-center border border-dashed border-stone-200 rounded-lg bg-stone-50/50">
            <p className="text-sm text-stone-500">No messages yet</p>
            <p className="text-xs text-stone-400 mt-1">Start the follow-up thread after assigning a company agent.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {messages.map((m) => (
              <div key={m.id} className="flex gap-3 p-3 rounded-lg border border-stone-100 bg-stone-50/40 hover:bg-stone-50 transition-colors">
                <div className="h-8 w-8 rounded-full bg-stone-800 text-white grid place-items-center text-xs shrink-0 font-medium">
                  {m.authorName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-stone-800">{m.authorName}</span>
                    <span className="text-xs text-stone-400 shrink-0">
                      {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-stone-600 mt-1 whitespace-pre-wrap break-words">{m.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isClosed ? (
          <div className="mt-5">
            <label className="block text-xs font-medium text-stone-600 mb-2">New message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Called client — confirmed for Thu 10am, sent location pin. Next: dispatch agent Ada."
              rows={3}
              className="w-full border border-stone-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-stone-400">{text.length}/5000</span>
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="text-sm bg-stone-800 text-white rounded-lg px-5 py-2.5 font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
          </div>
        ) : (
          <div className="mt-5 p-3 bg-stone-100 border border-stone-200 rounded-lg text-xs text-stone-500 text-center">
            🔒 Closed bookings are read-only. Outcome and timeline remain for audit.
          </div>
        )}
      </div>
    </div>
  );
}
```

## `src/app/admin/bookings/[id]/ActivityTimeline.tsx`

```tsx
import { statusLabels } from "@/lib/booking-ui";
import { actionLabels, type BookingAction } from "@/lib/booking-transitions";
import { formatDateTime } from "@/lib/booking-ui";

type Activity = {
  id: string;
  actorName: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  note: string | null;
  emailSent: boolean | null;
  emailError: string | null;
  createdAt: Date;
};

export default function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null;

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-6 mt-6">
      <h2 className="text-sm font-medium text-stone-500 mb-4">Activity</h2>
      <ol className="space-y-4">
        {activities.map((a) => (
          <li key={a.id} className="border-l-2 border-stone-200 pl-4 relative">
            <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-stone-400" />
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-stone-800">
                <span className="font-medium">{a.actorName}</span>{" "}
                {actionLabels[a.action as BookingAction]?.toLowerCase() ?? a.action}
                {a.fromStatus !== a.toStatus && (
                  <span className="text-stone-500">
                    {" "}
                    ({statusLabels[a.fromStatus]} → {statusLabels[a.toStatus]})
                  </span>
                )}
              </p>
              <span className="text-xs text-stone-400 shrink-0">{formatDateTime(a.createdAt)}</span>
            </div>
            {a.note && <p className="text-sm text-stone-500 mt-1 whitespace-pre-wrap">{a.note}</p>}
            {a.emailSent === true && <p className="text-xs text-emerald-600 mt-1">Email sent</p>}
            {a.emailSent === false && (
              <p className="text-xs text-red-600 mt-1">Email failed: {a.emailError}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
```

## `src/app/admin/bookings/AgentNameCell.tsx`

```tsx
"use client";
/* eslint-disable react-hooks/set-state-in-effect -- intentional prop->state sync after refresh */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AgentNameCell({
  bookingId,
  initialValue,
  updatedAt,
}: {
  bookingId: string;
  initialValue: string | null;
  updatedAt: Date;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep displayed value in sync when parent refreshes with new booking data
  // (e.g. another admin saved). Don't clobber an in-progress edit.
  useEffect(() => {
    if (!editing) setValue(initialValue ?? "");
  }, [initialValue, editing]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          agentName: value,
          expectedUpdatedAt: updatedAt.toISOString(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't save — try again.");
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="border border-stone-300 rounded px-2 py-1 text-xs w-28"
        />
        <button
          onClick={save}
          disabled={saving}
          className="text-xs text-emerald-700 hover:underline"
        >
          Save
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(initialValue ?? "");
          }}
          className="text-xs text-stone-400 hover:underline"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-xs ${initialValue ? "text-stone-700" : "text-red-500 italic"} hover:underline`}
    >
      {initialValue || "Add agent"}
    </button>
  );
}
```

## `src/app/admin/agents/page.tsx`

```tsx
import { prisma } from "@/lib/prisma";
import AgentManager from "./AgentManager";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { bookings: true } } },
  });

  // Serialize dates for client component
  const serialized = agents.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return <AgentManager initialAgents={serialized as unknown as never} />;
}
```

## `src/app/admin/agents/AgentManager.tsx`

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Agent = {
  id: string;
  name: string;
  phone: string;
  email: string;
  category: "staff" | "hire_purchase";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { bookings: number };
};

export default function AgentManager({ initialAgents }: { initialAgents: Agent[] }) {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [form, setForm] = useState<{ name: string; phone: string; email: string; category: Agent["category"]; isActive: boolean }>({ name: "", phone: "", email: "", category: "staff", isActive: true });
  const [editing, setEditing] = useState<Agent | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; phone: string; email: string; category: Agent["category"]; isActive: boolean }>({ name: "", phone: "", email: "", category: "staff", isActive: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/admin/agents");
    if (res.ok) {
      const data = await res.json();
      setAgents(data.agents);
    }
    router.refresh();
  }

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create agent");
      setForm({ name: "", phone: "", email: "", category: "staff", isActive: true });
      setSuccess(`Agent ${data.agent.name} created`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  function startEdit(agent: Agent) {
    setEditing(agent);
    setEditForm({ name: agent.name, phone: agent.phone, email: agent.email, category: agent.category, isActive: agent.isActive });
    setError(null);
    setSuccess(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy("edit");
    setError(null);
    try {
      const res = await fetch(`/api/admin/agents/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update");
      setEditing(null);
      setSuccess(`Agent ${data.agent.name} updated`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function toggleActive(agent: Agent) {
    setBusy(agent.id);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      if (!res.ok) throw new Error("Failed");
      await refresh();
    } catch {
      setError("Failed to toggle status");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAgent(agent: Agent) {
    if (!confirm(`Delete ${agent.name}? ${agent._count?.bookings ? "Has bookings — will be deactivated instead." : ""}`)) return;
    setBusy(agent.id);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSuccess(data.deactivated ? `${agent.name} deactivated (had bookings)` : `${agent.name} deleted`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-serif text-2xl text-stone-800">Company Agents</h1>
      <p className="text-sm text-stone-500 mt-1">Staff and hire-purchase partners. Unassigned bookings can be assigned here — the agent is emailed client details to follow up.</p>

      {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded px-4 py-3">{error}</div>}
      {success && <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded px-4 py-3">{success}</div>}

      <div className="mt-8 bg-white border border-stone-200 rounded-lg p-6">
        <h2 className="text-sm font-medium text-stone-700 mb-4">Add agent</h2>
        <form onSubmit={createAgent} className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" placeholder="e.g. Ada Okafor" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" placeholder="ada@belgrovehomes.com" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Phone *</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" placeholder="+234 801 234 5678" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">Category *</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Agent["category"] })} className="w-full border border-stone-300 rounded px-3 py-2 text-sm bg-white">
              <option value="staff">Staff</option>
              <option value="hire_purchase">Hire Purchase</option>
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
            <button type="submit" disabled={busy !== null} className="ml-auto text-sm bg-stone-800 text-white rounded px-5 py-2 disabled:opacity-50">
              {busy === "create" ? "Adding…" : "Add agent"}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 bg-white border border-stone-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-stone-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-800">{a.name}</div>
                  <div className="text-xs text-stone-400">{a.email}</div>
                </td>
                <td className="px-4 py-3 text-stone-600">
                  <div>{a.phone}</div>
                  <div className="text-xs text-stone-400">{a.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${a.category === "staff" ? "bg-stone-800 text-white" : "bg-amber-100 text-amber-800"}`}>
                    {a.category === "hire_purchase" ? "Hire Purchase" : "Staff"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(a)} disabled={busy !== null} className={`px-2 py-1 rounded-full text-xs ${a.isActive ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-600"}`}>
                    {a.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">{a._count?.bookings ?? 0}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(a)} className="text-xs text-stone-600 hover:underline">Edit</button>
                    <button onClick={() => deleteAgent(a)} disabled={busy === a.id} className="text-xs text-red-600 hover:underline disabled:opacity-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-stone-400">No agents yet. Add your first staff or hire-purchase partner above.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-stone-800 mb-4">Edit {editing.name}</h3>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-xs text-stone-500 mb-1">Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Email</label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Phone</label>
                <input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} required className="w-full border border-stone-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-stone-500 mb-1">Category</label>
                <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value as Agent["category"] })} className="w-full border border-stone-300 rounded px-3 py-2 text-sm bg-white">
                  <option value="staff">Staff</option>
                  <option value="hire_purchase">Hire Purchase</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />
                Active
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditing(null)} className="text-sm border border-stone-300 rounded px-4 py-2">Cancel</button>
                <button type="submit" disabled={busy !== null} className="text-sm bg-stone-800 text-white rounded px-4 py-2 disabled:opacity-50">{busy === "edit" ? "Saving…" : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
```

## `src/components/site/Nav.tsx`

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/gallery", label: "GALLERY" },
  { href: "/book-inspection", label: "SITE INSPECTION" },
  { href: "/vision", label: "VISION" },
  { href: "/#about", label: "ABOUT" },
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isHome = pathname === "/";

  if (isHome) {
    return (
      <header className="absolute top-0 inset-x-0 z-30 flex justify-center pt-3 px-4">
        <nav className="w-full max-w-[860px] bg-white rounded-[6px] shadow-[0_8px_24px_rgba(0,0,0,0.18)] flex items-center justify-between px-4 lg:px-6 py-2.5">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span className="font-serif text-[15px] tracking-[-0.02em] text-[#1F3328] font-semibold">Belgrove<span className="text-[#C79A46]">&</span>Homes</span>
          </Link>
          <div className="hidden md:flex items-center gap-5">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`mono text-[11px] tracking-[0.08em] ${pathname === l.href ? "text-[#C79A46] border-b-2 border-[#C79A46] pb-1" : "text-[#6B7A6F] hover:text-[#1F3328]"}`}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <Link href="/book-inspection" className="hidden md:inline-flex mono text-[11px] tracking-[0.08em] bg-[#1F3328] text-white px-5 py-2.5 rounded-[4px] hover:bg-black transition-colors shrink-0">
            BOOK<br />INSPECTION
          </Link>
          <button className="md:hidden h-8 w-8 grid place-items-center" onClick={() => setOpen(!open)} aria-label="Menu">
            <span className="block w-5 h-0.5 bg-[#1F3328] mb-1" /><span className="block w-5 h-0.5 bg-[#1F3328] mb-1" /><span className="block w-5 h-0.5 bg-[#1F3328]" />
          </button>
        </nav>
        {open && (
          <div className="absolute top-[58px] inset-x-4 bg-white rounded-[6px] shadow-lg p-4 flex flex-col gap-3 md:hidden">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="public text-[13px] text-[#1F3328]" onClick={() => setOpen(false)}>{l.label}</Link>
            ))}
            <Link href="/book-inspection" className="mono text-[11px] bg-[#4CBDC5] text-white px-4 py-3 rounded-[4px] text-center" onClick={() => setOpen(false)}>GET IN TOUCH</Link>
          </div>
        )}
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#E0D5BB]">
      <nav className="max-w-[1280px] mx-auto flex items-center justify-between px-6 lg:px-8 h-[64px]">
        <Link href="/" className="font-serif text-[17px] tracking-[-0.02em] text-[#1F3328] font-semibold">Belgrove<span className="text-[#C79A46]">&</span>Homes</Link>
        <div className="hidden md:flex items-center gap-6">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="mono text-[11px] tracking-[0.08em] text-[#8B5E3C] hover:text-[#1F3328]">{l.label}</Link>
          ))}
          <Link href="/book-inspection" className="mono text-[11px] tracking-[0.08em] bg-[#1F3328] text-white px-5 py-2 rounded-[2px]">GET IN TOUCH</Link>
        </div>
        <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? "✕" : "☰"}</button>
      </nav>
      {open && (
        <div className="md:hidden border-t border-[#E0D5BB] bg-white px-6 py-4 flex flex-col gap-3">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="public text-[13px]" onClick={() => setOpen(false)}>{l.label}</Link>
          ))}
        </div>
      )}
    </header>
  );
}
```

## `src/components/site/Footer.tsx`

```tsx
export default function Footer() {
  return (
    <footer className="bg-stone-800 text-stone-300 mt-24">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="font-serif text-lg text-white mb-2">Belgrove Homes</h3>
          <p className="text-sm text-stone-400">
            Guiding buyers and sellers through every stage of the property journey since 2008.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Contact</h4>
          <p className="text-sm text-stone-400">128 Harbor Ave, Suite 400</p>
          <p className="text-sm text-stone-400">contact@belgrovehomes.example</p>
          <p className="text-sm text-stone-400">(555) 019-4420</p>
        </div>
        <div>
          <h4 className="text-sm font-medium text-white mb-2">Follow</h4>
          <div className="flex gap-4 text-sm text-stone-400">
            <span>Instagram</span>
            <span>LinkedIn</span>
            <span>Facebook</span>
          </div>
        </div>
      </div>
      <div className="border-t border-stone-700 py-4 text-center text-xs text-stone-500">
        &copy; {new Date().getFullYear()} Belgrove Homes. All rights reserved.
      </div>
    </footer>
  );
}
```

## `src/components/site/CinematicIntroLoader.tsx`

```tsx
"use client";

import { useEffect } from "react";

/**
 * Bootstraps the static /cinematic-intro.js control logic. A plain <script>
 * tag rendered in JSX only executes on a full page load — browsers don't
 * run scripts that arrive via DOM patching (client-side navigation back to
 * "/" from another page). Creating and appending the element manually does
 * execute every time, so the intro correctly re-evaluates its
 * sessionStorage gate on every mount, not just the first hard load.
 */
export default function CinematicIntroLoader() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/cinematic-intro.js";
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return null;
}
```

## `src/components/admin/AdminTopBar.tsx`

```tsx
"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import NotificationBell from "./NotificationBell";

export default function AdminTopBar() {
  const pathname = usePathname();

  if (pathname === "/admin/login") return null;

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/admin/bookings" className="font-serif text-lg text-stone-800">
          Belgrove Homes <span className="text-stone-400 text-sm font-sans">Admin</span>
        </Link>
        <div className="flex items-center gap-6">
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/admin/bookings"
              className={`${pathname?.startsWith("/admin/bookings") ? "text-stone-800 font-medium" : "text-stone-500"} hover:text-stone-800`}
            >
              Bookings
            </Link>
            <Link
              href="/admin/agents"
              className={`${pathname?.startsWith("/admin/agents") ? "text-stone-800 font-medium" : "text-stone-500"} hover:text-stone-800`}
            >
              Agents
            </Link>
          </nav>
          <NotificationBell />
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="text-sm text-stone-500 hover:text-stone-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
```

## `src/components/admin/NotificationBell.tsx`

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Notification = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  bookingId: string | null;
  booking: { ref: string } | null;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/notifications");
    if (!res.ok) return;
    const data = await res.json();
    setNotifications(data.notifications);
    setUnreadCount(data.unreadCount);
    setLoaded(true);
  }, []);

  useEffect(() => {
    // react-hooks/set-state-in-effect flags this, but it's the standard
    // "fetch on mount" pattern — load()'s setState calls only run after its
    // internal `fetch` resolves (a later microtask), not synchronously
    // within this effect body, so there's no render-cascade risk here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  async function markAllRead() {
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!loaded) load();
        }}
        className="relative text-sm text-stone-500 hover:text-stone-800"
        aria-label="Notifications"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -top-2 -right-3 bg-red-600 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white border border-stone-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100">
              <span className="text-xs font-medium text-stone-500">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-stone-500 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-xs text-stone-400">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                href={n.bookingId ? `/admin/bookings/${n.bookingId}` : "/admin/bookings"}
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  setOpen(false);
                }}
                className={`block px-4 py-3 text-sm border-b border-stone-50 last:border-0 hover:bg-stone-50 ${
                  n.read ? "text-stone-500" : "text-stone-800 bg-stone-50/50"
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                  <div className={n.read ? "" : "font-medium"}>
                    {n.message}
                    <div className="text-xs text-stone-400 font-normal mt-0.5">
                      {new Date(n.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

## `src/lib/prisma.ts`

```ts
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

## `src/lib/validation.ts`

```ts
import { z } from "zod";

export const bookingSubmissionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.email("Enter a valid email address").trim(),
  phone: z.string().trim().min(7, "Phone number is required").max(20).regex(/^[\d\s()+-]+$/, "Enter a valid phone number"),
  preferredDate: z.string().min(1, "Date is required"),
  preferredTime: z.string().min(1, "Time is required"),
  location: z.string().trim().min(1, "Location of interest is required").max(300),
  agentName: z.string().trim().max(200).optional().or(z.literal("")),
});

export type BookingSubmissionInput = z.infer<typeof bookingSubmissionSchema>;

// expectedUpdatedAt: the ISO timestamp the client last saw for this booking.
// When present, the server rejects the write if the row has changed since
// (optimistic concurrency — prevents two admins from silently clobbering
// each other's changes).
const concurrency = { expectedUpdatedAt: z.string().optional() };

// note: an optional free-text comment the admin can attach to a status
// change, recorded on that action's BookingActivity entry.
const note = { note: z.string().trim().max(1000).optional() };

export const agentCategorySchema = z.enum(["staff", "hire_purchase"]);

export const agentSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(200),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  phone: z.string().trim().min(7, "Phone is required").max(20).regex(/^[\d\s()+-]+$/, "Enter a valid phone number"),
  category: agentCategorySchema.default("staff"),
  isActive: z.boolean().optional().default(true),
});

export const agentUpdateSchema = agentSchema.partial();

export type AgentInput = z.infer<typeof agentSchema>;
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>;

export const bookingActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), ...note, ...concurrency }),
  z.object({
    action: z.literal("reschedule"),
    rescheduledDate: z
      .string()
      .min(1, "New date is required")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date"),
    rescheduledTime: z.string().min(1, "New time is required"),
    ...note,
    ...concurrency,
  }),
  z.object({ action: z.literal("hold"), ...note, ...concurrency }),
  z.object({
    action: z.literal("under_review"),
    assignedToId: z.string().min(1).nullable().optional(),
    ...note,
    ...concurrency,
  }),
  z.object({
    action: z.literal("mark_active"),
    internalNote: z.string().trim().min(1, "Internal note is required"),
    ...concurrency,
  }),
  z.object({
    action: z.literal("record_outcome"),
    outcome: z.enum(["sold", "not_sold"]),
    ...note,
    ...concurrency,
  }),
  z.object({
    action: z.literal("save"),
    agentName: z.string().trim().max(200).optional(),
    internalNote: z.string().trim().max(5000).optional(),
    assignedToId: z.string().min(1).nullable().optional(),
    ...concurrency,
  }),
  z.object({
    // Manually raising a lead's temperature. Deliberately escalate-only —
    // enforced server-side, not just hidden in the UI — so a hot lead can
    // never be quietly cooled off by a stray or malicious request. The only
    // way leadTemperature ever goes *down* is the automatic not_sold rule
    // in record_outcome.
    action: z.literal("escalate_lead"),
    leadTemperature: z.enum(["warm", "hot"]),
    ...note,
    ...concurrency,
  }),
  z.object({
    // Assign a booking to a company agent (staff or hire_purchase). Null unassigns.
    action: z.literal("assign_agent"),
    agentId: z.string().min(1).nullable(),
    ...note,
    ...concurrency,
  }),
]);

export type BookingActionInput = z.infer<typeof bookingActionSchema>;
```

## `src/lib/authz.ts`

```ts
// Admins and staff share full dashboard access per spec §10 — both are
// authenticated internal users, there's no reduced "staff" tier.
export function isInternalRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "staff";
}
```

## `src/lib/booking-ui.ts`

```ts
export const statusLabels: Record<string, string> = {
  new: "New",
  under_review: "Under Review",
  on_hold: "On Hold",
  approved: "Approved",
  rescheduled: "Rescheduled",
  active: "Active",
  closed: "Closed",
};

export const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  under_review: "bg-amber-100 text-amber-800",
  on_hold: "bg-orange-100 text-orange-800",
  approved: "bg-emerald-100 text-emerald-800",
  rescheduled: "bg-purple-100 text-purple-800",
  active: "bg-teal-100 text-teal-800",
  closed: "bg-stone-200 text-stone-700",
};

export const temperatureColors: Record<string, string> = {
  cold: "bg-sky-100 text-sky-800",
  warm: "bg-amber-100 text-amber-800",
  hot: "bg-red-100 text-red-800",
};

export const allStatuses = [
  "new",
  "under_review",
  "on_hold",
  "approved",
  "rescheduled",
  "active",
  "closed",
] as const;

export const allTemperatures = ["cold", "warm", "hot"] as const;

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
```

## `src/lib/booking-transitions.ts`

```ts
import type { BookingStatus, LeadTemperature } from "@/generated/prisma/client";

export type BookingAction =
  | "approve"
  | "reschedule"
  | "hold"
  | "under_review"
  | "mark_active"
  | "record_outcome"
  | "save"
  | "escalate_lead"
  | "assign_agent";

// "save", "escalate_lead", "assign_agent" are status-independent — they never
// change status, so they're excluded from the transition map and always allowed.
type StatusGatedAction = Exclude<BookingAction, "save" | "escalate_lead" | "assign_agent">;

/**
 * Which statuses each action is legal from.
 *
 * Mirrors the workflow described in the spec:
 *   Review (new/on_hold/under_review) -> Approve/Reschedule -> Active -> Sold/Not Sold
 * Approve/reschedule/hold/under_review remain available to each other after
 * the first pass so an admin can correct course before the session happens.
 */
export const ALLOWED_FROM: Record<StatusGatedAction, BookingStatus[]> = {
  approve: ["new", "under_review", "on_hold", "approved", "rescheduled"],
  reschedule: ["new", "under_review", "on_hold", "approved", "rescheduled"],
  hold: ["new", "under_review", "approved", "rescheduled"],
  under_review: ["new", "on_hold", "approved", "rescheduled"],
  mark_active: ["approved", "rescheduled"],
  record_outcome: ["active"],
};

export function isTransitionAllowed(action: BookingAction, status: BookingStatus): boolean {
  if (action === "save" || action === "escalate_lead" || action === "assign_agent") return true;
  return ALLOWED_FROM[action].includes(status);
}

export const actionLabels: Record<BookingAction, string> = {
  approve: "Approve",
  reschedule: "Reschedule",
  hold: "Put on hold",
  under_review: "Mark under review",
  mark_active: "Mark as active",
  record_outcome: "Record outcome",
  save: "Edit fields",
  escalate_lead: "Escalate lead",
  assign_agent: "Assign agent",
};

// cold -> warm -> hot. Used to enforce "escalate only" — a manual change
// must strictly raise the rank; it can never lower it. The one place
// leadTemperature legitimately goes down is the automatic not_sold rule
// in the record_outcome action, which bypasses this check entirely.
export const temperatureRank: Record<LeadTemperature, number> = {
  cold: 0,
  warm: 1,
  hot: 2,
};

export function isEscalation(from: LeadTemperature, to: LeadTemperature): boolean {
  return temperatureRank[to] > temperatureRank[from];
}
```

## `src/lib/content.ts`

```ts
export const testimonials = [
  {
    name: "Marcus Feld",
    role: "First-time buyer",
    quote:
      "Belgrove made a process I dreaded genuinely enjoyable. Every inspection was scheduled within a day and the agent showed up prepared with answers.",
  },
  {
    name: "Renata Cho",
    role: "Downsizing seller",
    quote:
      "I sold my family home of 22 years with Belgrove. They understood what the house meant to me and found it a buyer who felt the same way.",
  },
  {
    name: "Aaron & Priya Douglas",
    role: "Growing family",
    quote:
      "We booked four inspections in one week through their site. The confirmation emails and reference codes made it easy to keep track of everything.",
  },
  {
    name: "Levi Okafor",
    role: "Investor",
    quote:
      "Responsive, sharp, and honest about a property's flaws before I wasted time touring it. That candor is rare in this market.",
  },
];

export const galleryItems = [
  { id: 1, category: "Interiors", title: "Sunlit living room, Maple Street" },
  { id: 2, category: "Exteriors", title: "Craftsman facade, Birchwood" },
  { id: 3, category: "Kitchens", title: "Chef's kitchen, Harbor View" },
  { id: 4, category: "Interiors", title: "Reading nook, Cedar Hollow" },
  { id: 5, category: "Exteriors", title: "Twilight porch, Elm Ridge" },
  { id: 6, category: "Kitchens", title: "Marble island, Stonegate" },
  { id: 7, category: "Interiors", title: "Primary suite, Fairview" },
  { id: 8, category: "Exteriors", title: "Garden entry, Willowbrook" },
  { id: 9, category: "Interiors", title: "Home office, Ashford Court" },
];

export const galleryCategories = ["All", "Interiors", "Exteriors", "Kitchens"] as const;

export const timeSlots = [
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
];
```

## `src/lib/ref.ts`

```ts
import { prisma } from "@/lib/prisma";
import { randomInt } from "node:crypto";

export function generateRef(): string {
  const year = new Date().getFullYear();
  // crypto-secure 5-digit sequence (10000-99999) — Math.random is predictable
  const seq = randomInt(10000, 100000);
  return `BEL-${year}-${seq}`;
}

export async function generateUniqueRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const ref = generateRef();
    const existing = await prisma.inspectionBooking.findUnique({
      where: { ref },
      select: { id: true },
    });
    if (!existing) return ref;
  }
  throw new Error("Failed to generate a unique booking reference after 5 attempts");
}
```

## `src/lib/email/sendEmail.ts`

```ts
import nodemailer from "nodemailer";

export type EmailResult = { sent: boolean; error: string | null };

let transporter: nodemailer.Transporter | null = null;
let transporterFingerprint: string | null = null;

function getTransporterFingerprint(): string {
  // Fingerprint the config that determines transport — if env changes between
  // calls (e.g. ZOHO disabled mid-run, MailHog creds swapped) we must rebuild.
  return [
    process.env.ZOHO_APP_PASSWORD ?? "",
    process.env.SMTP_HOST ?? "",
    process.env.SMTP_PORT ?? "",
    process.env.SMTP_USER ?? "",
  ].join("|");
}

function getTransporter() {
  const fp = getTransporterFingerprint();
  if (!transporter || transporterFingerprint !== fp) {
    transporterFingerprint = fp;
    // Zoho (production) — uses ZOHO_APP_PASSWORD + info@belgrovehomes.com
    // Falls back to generic SMTP_HOST for local dev (MailHog)
    if (process.env.ZOHO_APP_PASSWORD) {
      transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 587,
        secure: false,
        auth: {
          user: "info@belgrovehomes.com",
          pass: process.env.ZOHO_APP_PASSWORD,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: false,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    }
  }
  return transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const from = process.env.SMTP_FROM;
  if (!from) {
    const msg = "SMTP_FROM is not configured — email not sent";
    console.error(msg);
    return { sent: false, error: msg };
  }
  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { sent: false, error: "No recipients" };
  }
  try {
    await getTransporter().sendMail({
      from,
      to,
      subject,
      html,
    });
    return { sent: true, error: null };
  } catch (err) {
    console.error("Email send failed:", err);
    return { sent: false, error: err instanceof Error ? err.message : "Unknown email error" };
  }
}
```

## `src/lib/email/templates.ts`

```ts
function layout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; color: #2b2620;">
    <div style="background: #3a3226; padding: 24px 32px;">
      <span style="color: #f5ece1; font-size: 20px; letter-spacing: 0.05em;">BELGROVE HOMES</span>
    </div>
    <div style="padding: 32px; background: #fdfbf7;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding: 16px 32px; background: #efe8dc; font-size: 12px; color: #6b6055;">
      Belgrove Homes &middot; This is an automated message regarding your inspection booking.
    </div>
  </div>`;
}

function fmtDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function bookingReceivedTemplate(params: {
  name: string;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  location: string;
  phone?: string | null;
}): string {
  const { name, ref, preferredDate, preferredTime, location, phone } = params;
  return layout(
    "We've received your inspection request",
    `
    <p>Hi ${name},</p>
    <p>Thank you for booking a property inspection with Belgrove Homes. Here's what you submitted:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Reference</td><td style="padding:6px 0; font-weight:bold;">${ref}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Requested date</td><td style="padding:6px 0;">${fmtDate(preferredDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Requested time</td><td style="padding:6px 0;">${preferredTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
      ${phone ? `<tr><td style="padding:6px 0; color:#6b6055;">Phone</td><td style="padding:6px 0;">${phone}</td></tr>` : ""}
    </table>
    <p>Keep your reference code <strong>${ref}</strong> handy — an agent will follow up shortly to confirm.</p>
    `
  );
}

export function adminNewBookingAlertTemplate(params: {
  name: string;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  location: string;
  agentName?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  const { name, ref, preferredDate, preferredTime, location, agentName, phone, email } = params;
  return layout(
    "New inspection booking submitted",
    `
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Reference</td><td style="padding:6px 0; font-weight:bold;">${ref}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Visitor</td><td style="padding:6px 0;">${name}</td></tr>
      ${email ? `<tr><td style="padding:6px 0; color:#6b6055;">Email</td><td style="padding:6px 0;">${email}</td></tr>` : ""}
      ${phone ? `<tr><td style="padding:6px 0; color:#6b6055;">Phone</td><td style="padding:6px 0;">${phone}</td></tr>` : ""}
      <tr><td style="padding:6px 0; color:#6b6055;">Requested date</td><td style="padding:6px 0;">${fmtDate(preferredDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Requested time</td><td style="padding:6px 0;">${preferredTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Agent</td><td style="padding:6px 0;">${agentName || "— not provided —"}</td></tr>
    </table>
    <p>Review this booking in the admin dashboard.</p>
    `
  );
}

export function bookingApprovedTemplate(params: {
  name: string;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  location: string;
}): string {
  const { name, ref, preferredDate, preferredTime, location } = params;
  return layout(
    "Your inspection is confirmed",
    `
    <p>Hi ${name},</p>
    <p>Your inspection booking <strong>${ref}</strong> has been confirmed as requested:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Date</td><td style="padding:6px 0; font-weight:bold;">${fmtDate(preferredDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Time</td><td style="padding:6px 0; font-weight:bold;">${preferredTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
    </table>
    <p>We look forward to seeing you then.</p>
    `
  );
}

export function bookingRescheduledTemplate(params: {
  name: string;
  ref: string;
  rescheduledDate: Date | string;
  rescheduledTime: string;
  location: string;
}): string {
  const { name, ref, rescheduledDate, rescheduledTime, location } = params;
  return layout(
    "Your inspection has been rescheduled",
    `
    <p>Hi ${name},</p>
    <p>Your inspection booking <strong>${ref}</strong> has a new date and time:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">New date</td><td style="padding:6px 0; font-weight:bold;">${fmtDate(rescheduledDate)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">New time</td><td style="padding:6px 0; font-weight:bold;">${rescheduledTime}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
    </table>
    <p>If this doesn't work for you, reply to this email and we'll help find another time.</p>
    `
  );
}

const statusCopy: Record<string, { title: string; body: string }> = {
  on_hold: {
    title: "Your inspection booking is on hold",
    body: "Your booking has been placed on hold while we confirm a few details. We'll follow up shortly.",
  },
  under_review: {
    title: "Your inspection booking is under review",
    body: "Your booking is being reviewed by our team. We'll be in touch soon to confirm next steps.",
  },
};

export function bookingStatusTemplate(params: {
  name: string;
  ref: string;
  status: "on_hold" | "under_review";
}): string {
  const { name, ref, status } = params;
  const copy = statusCopy[status];
  return layout(
    copy.title,
    `
    <p>Hi ${name},</p>
    <p>${copy.body}</p>
    <p>Reference: <strong>${ref}</strong></p>
    `
  );
}

export function saleConfirmationTemplate(params: {
  name: string;
  ref: string;
  location: string;
}): string {
  const { name, ref, location } = params;
  return layout(
    "Congratulations on your new property!",
    `
    <p>Hi ${name},</p>
    <p>We're delighted to confirm the sale associated with your inspection at <strong>${location}</strong> (ref <strong>${ref}</strong>) is complete.</p>
    <p>Thank you for choosing Belgrove Homes — our team will be in touch with next steps.</p>
    `
  );
}

export function agentAssignmentTemplate(params: {
  agentName: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  ref: string;
  preferredDate: Date | string;
  preferredTime: string;
  rescheduledDate?: Date | string | null;
  rescheduledTime?: string | null;
  location: string;
  agentCategory?: string | null;
}): string {
  const {
    agentName,
    clientName,
    clientEmail,
    clientPhone,
    ref,
    preferredDate,
    preferredTime,
    rescheduledDate,
    rescheduledTime,
    location,
    agentCategory,
  } = params;
  const dateToShow = rescheduledDate ?? preferredDate;
  const timeToShow = rescheduledTime ?? preferredTime;
  const isRescheduled = !!rescheduledDate;
  return layout(
    `New client assigned — ${ref}`,
    `
    <p>Hi ${agentName},</p>
    <p>You have been assigned a new inspection booking to follow up. Please contact the client promptly:</p>
    <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding:6px 0; color:#6b6055;">Reference</td><td style="padding:6px 0; font-weight:bold;">${ref}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Client</td><td style="padding:6px 0;">${clientName}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Email</td><td style="padding:6px 0;"><a href="mailto:${clientEmail}">${clientEmail}</a></td></tr>
      ${clientPhone ? `<tr><td style="padding:6px 0; color:#6b6055;">Phone</td><td style="padding:6px 0;"><a href="tel:${clientPhone}">${clientPhone}</a></td></tr>` : ""}
      <tr><td style="padding:6px 0; color:#6b6055;">${isRescheduled ? "Rescheduled date" : "Requested date"}</td><td style="padding:6px 0; font-weight:bold;">${fmtDate(dateToShow)}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Time</td><td style="padding:6px 0; font-weight:bold;">${timeToShow}</td></tr>
      <tr><td style="padding:6px 0; color:#6b6055;">Location</td><td style="padding:6px 0;">${location}</td></tr>
      ${agentCategory ? `<tr><td style="padding:6px 0; color:#6b6055;">Your category</td><td style="padding:6px 0; text-transform: capitalize;">${agentCategory.replace("_", " ")}</td></tr>` : ""}
    </table>
    <p style="background:#fef3c7; border:1px solid #fcd34d; padding:12px; border-radius:4px; font-size:13px;">Action required: Contact <strong>${clientName}</strong> within 24 hours to confirm the inspection and provide directions. Reply to this email if you need admin support.</p>
    <p>Client reference: <strong>${ref}</strong></p>
    `
  );
}
```

## `src/lib/email/emailService.ts`

```ts
import { sendEmail, type EmailResult } from "./sendEmail";
import {
  bookingReceivedTemplate,
  adminNewBookingAlertTemplate,
  bookingApprovedTemplate,
  bookingRescheduledTemplate,
  bookingStatusTemplate,
  saleConfirmationTemplate,
  agentAssignmentTemplate,
} from "./templates";

type BookingLike = {
  name: string;
  ref: string;
  preferredDate: Date;
  preferredTime: string;
  location: string;
  agentName?: string | null;
  phone?: string | null;
  email?: string | null;
};

export async function sendBookingReceived(to: string, booking: BookingLike): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Booking received — ${booking.ref}`,
    html: bookingReceivedTemplate(booking),
  });
}

export async function sendAdminNewBookingAlert(
  adminEmails: string[],
  booking: BookingLike
): Promise<EmailResult> {
  if (adminEmails.length === 0) return { sent: false, error: "No admin recipients configured" };
  return sendEmail({
    to: adminEmails,
    subject: `New inspection booking — ${booking.ref}`,
    html: adminNewBookingAlertTemplate(booking),
  });
}

export async function sendBookingApproved(to: string, booking: BookingLike): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection confirmed — ${booking.ref}`,
    html: bookingApprovedTemplate(booking),
  });
}

export async function sendBookingRescheduled(
  to: string,
  booking: { name: string; ref: string; rescheduledDate: Date; rescheduledTime: string; location: string }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Inspection rescheduled — ${booking.ref}`,
    html: bookingRescheduledTemplate(booking),
  });
}

export async function sendBookingStatusEmail(
  to: string,
  booking: { name: string; ref: string },
  status: "on_hold" | "under_review"
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Booking update — ${booking.ref}`,
    html: bookingStatusTemplate({ ...booking, status }),
  });
}

export async function sendSaleConfirmation(
  to: string,
  booking: { name: string; ref: string; location: string }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `Sale confirmed — ${booking.ref}`,
    html: saleConfirmationTemplate(booking),
  });
}

export async function sendAgentAssignment(
  to: string,
  params: {
    agentName: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string | null;
    ref: string;
    preferredDate: Date;
    preferredTime: string;
    rescheduledDate?: Date | null;
    rescheduledTime?: string | null;
    location: string;
    agentCategory?: string | null;
  }
): Promise<EmailResult> {
  return sendEmail({
    to,
    subject: `New client assigned — ${params.ref}: ${params.clientName} (${params.location})`,
    html: agentAssignmentTemplate(params),
  });
}
```

## `src/auth.ts`

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id as string;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
```

## `src/proxy.ts`

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";

export const proxy = auth((req) => {
  const isInternalUser = isInternalRole(req.auth?.user?.role);
  const isLoginPage = req.nextUrl.pathname === "/admin/login";
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/admin");

  if (isLoginPage) {
    if (isInternalUser) {
      return NextResponse.redirect(new URL("/admin/bookings", req.url));
    }
    return NextResponse.next();
  }

  if (!isInternalUser) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
```

## `src/types/next-auth.d.ts`

```ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
  }
}
```

## `src/app/api/bookings/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { generateRef, generateUniqueRef } from "@/lib/ref";
import { bookingSubmissionSchema } from "@/lib/validation";
import { sendBookingReceived, sendAdminNewBookingAlert } from "@/lib/email/emailService";

function isUniqueRefConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray((err.meta as { target?: unknown })?.target) &&
    (err.meta!.target as string[]).includes("ref")
  );
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bookingSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, phone, preferredDate, preferredTime, location, agentName } = parsed.data;

  const preferredDateObj = new Date(preferredDate);
  if (Number.isNaN(preferredDateObj.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  // Preferred date should not be in the past (allow today)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const prefDay = new Date(preferredDateObj);
  prefDay.setHours(0, 0, 0, 0);
  if (prefDay.getTime() < today.getTime()) {
    return NextResponse.json({ error: "Preferred date cannot be in the past" }, { status: 400 });
  }

  // generateUniqueRef checks for a collision before insert, but that check
  // and the insert aren't atomic — under concurrent submissions two requests
  // could both pass the check for the same ref. Retry on the DB's unique
  // constraint as the actual source of truth.
  let ref = await generateUniqueRef();
  let booking;
  for (let attempt = 0; ; attempt++) {
    try {
      booking = await prisma.inspectionBooking.create({
        data: {
          ref,
          name,
          email,
          phone,
          preferredDate: preferredDateObj,
          preferredTime,
          location,
          agentName: agentName || null,
          status: "new",
        },
      });
      break;
    } catch (err) {
      if (isUniqueRefConflict(err) && attempt < 4) {
        ref = generateRef();
        continue;
      }
      throw err;
    }
  }

  // Visitor confirmation — blocking, they need the reference code before we respond.
  await sendBookingReceived(booking.email, booking);

  // Admin/staff alert — fire-and-forget, must not delay or fail the visitor's response.
  // Notifications are created even if email fails; email failure is logged only.
  prisma.user
    .findMany({ where: { role: { in: ["admin", "staff"] } }, select: { id: true, email: true } })
    .then(async (recipients) => {
      if (recipients.length === 0) return;
      const emailPromise = sendAdminNewBookingAlert(
        recipients.map((r) => r.email),
        booking
      )
        .then((r) => {
          if (!r.sent) console.error("Admin alert email failed:", r.error);
        })
        .catch((err) => console.error("Admin alert email threw:", err));
      const notifPromise = prisma.notification
        .createMany({
          data: recipients.map((r) => ({
            userId: r.id,
            type: "new_booking",
            message: `New inspection booking ${booking.ref} from ${booking.name}`,
            bookingId: booking.id,
          })),
        })
        .catch((err) => console.error("Notification create failed:", err));
      await Promise.allSettled([emailPromise, notifPromise]);
    })
    .catch((err) => console.error("Admin alert/notification lookup failed:", err));

  return NextResponse.json({ ref: booking.ref, id: booking.id }, { status: 201 });
}
```

## `src/app/api/agents/route.ts`

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public — for site booking form datalist: only name + category, no contact PII needed for tally suggestions.
export async function GET() {
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
    select: { name: true, category: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ agents });
}
```

## `src/app/api/admin/agents/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { agentSchema } from "@/lib/validation";

export async function GET() {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const agents = await prisma.agent.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { bookings: true } } },
  });

  return NextResponse.json({ agents });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = agentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const agent = await prisma.agent.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        category: parsed.data.category,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (err: unknown) {
    // Prisma unique violation on email
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "An agent with this email already exists" }, { status: 409 });
    }
    throw err;
  }
}
```

## `src/app/api/admin/agents/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { agentUpdateSchema } from "@/lib/validation";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const agent = await prisma.agent.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const parsed = agentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  try {
    const agent = await prisma.agent.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.email !== undefined ? { email: parsed.data.email } : {}),
        ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone } : {}),
        ...(parsed.data.category !== undefined ? { category: parsed.data.category } : {}),
        ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      },
    });
    return NextResponse.json({ agent });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "An agent with this email already exists" }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const existing = await prisma.agent.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
  if (!existing) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // If agent has bookings, prevent hard delete — deactivate instead.
  if (existing._count.bookings > 0) {
    const agent = await prisma.agent.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ agent, deactivated: true, message: "Agent has bookings — deactivated instead of deleted" });
  }

  await prisma.agent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

## `src/app/api/admin/bookings/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { bookingActionSchema } from "@/lib/validation";
import { isTransitionAllowed, actionLabels, isEscalation } from "@/lib/booking-transitions";
import { isInternalRole } from "@/lib/authz";
import type { EmailResult } from "@/lib/email/sendEmail";
import type { InspectionBooking, BookingStatus } from "@/generated/prisma/client";
import {
  sendBookingApproved,
  sendBookingRescheduled,
  sendBookingStatusEmail,
  sendSaleConfirmation,
  sendAgentAssignment,
} from "@/lib/email/emailService";

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const actorId = session!.user.id;
  const actorName = session!.user.name ?? session!.user.email ?? "Unknown";

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bookingActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const booking = await prisma.inspectionBooking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const input = parsed.data;

  // Optimistic concurrency: if the client's copy is stale, refuse the write
  // rather than silently overwriting whatever another admin just did.
  // Allow 1s tolerance for clock/serialization skew (ISO ms truncation, PG microsecond rounding).
  if (input.expectedUpdatedAt) {
    const expectedMs = new Date(input.expectedUpdatedAt).getTime();
    if (Number.isNaN(expectedMs)) {
      return NextResponse.json({ error: "Invalid expectedUpdatedAt" }, { status: 400 });
    }
    const currentMs = booking.updatedAt.getTime();
    if (Math.abs(expectedMs - currentMs) > 1000) {
      return NextResponse.json(
        {
          error: "This booking was updated by someone else since you loaded it. Refresh and try again.",
          booking,
        },
        { status: 409 }
      );
    }
  }

  // Server-side state machine enforcement — the UI hides invalid actions,
  // but the API is the actual source of truth (raw requests, stale tabs,
  // races between two admins must not be able to corrupt the lifecycle).
  if (!isTransitionAllowed(input.action, booking.status)) {
    return NextResponse.json(
      {
        error: `"${actionLabels[input.action]}" isn't valid from status "${booking.status}".`,
      },
      { status: 409 }
    );
  }

  let updated: InspectionBooking;
  let note: string | null = null;
  let emailResult: EmailResult = { sent: false, error: null };
  let emailAttempted = false;
  const fromStatus: BookingStatus = booking.status;

  switch (input.action) {
    case "approve": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { status: "approved", reviewedById: actorId, reviewedAt: new Date() },
      });
      // If this booking was previously rescheduled, "approve" confirms the
      // rescheduled date/time — not the stale original request.
      const confirmedDate = updated.rescheduledDate ?? updated.preferredDate;
      const confirmedTime = updated.rescheduledTime ?? updated.preferredTime;
      emailResult = await sendBookingApproved(updated.email, {
        ...updated,
        preferredDate: confirmedDate,
        preferredTime: confirmedTime,
      });
      emailAttempted = true;
      note = input.note || null;
      break;
    }

    case "reschedule": {
      const rescheduledDate = new Date(input.rescheduledDate);
      if (Number.isNaN(rescheduledDate.getTime())) {
        return NextResponse.json({ error: "Invalid rescheduled date" }, { status: 400 });
      }
      // Rescheduled date must not be in the past (date-only comparison, time slot defines hour)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const resDay = new Date(rescheduledDate);
      resDay.setHours(0, 0, 0, 0);
      if (resDay.getTime() < today.getTime()) {
        return NextResponse.json({ error: "Rescheduled date cannot be in the past" }, { status: 400 });
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          status: "rescheduled",
          rescheduledDate,
          rescheduledTime: input.rescheduledTime,
          reviewedById: actorId,
          reviewedAt: new Date(),
        },
      });
      note = `New time: ${rescheduledDate.toDateString()} at ${input.rescheduledTime}`;
      if (input.note) note += ` — ${input.note}`;
      emailResult = await sendBookingRescheduled(updated.email, {
        name: updated.name,
        ref: updated.ref,
        rescheduledDate: updated.rescheduledDate!,
        rescheduledTime: updated.rescheduledTime!,
        location: updated.location,
      });
      emailAttempted = true;
      break;
    }

    case "hold": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { status: "on_hold", reviewedById: actorId, reviewedAt: new Date() },
      });
      emailResult = await sendBookingStatusEmail(updated.email, updated, "on_hold");
      emailAttempted = true;
      note = input.note || null;
      break;
    }

    case "under_review": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          status: "under_review",
          reviewedById: actorId,
          reviewedAt: new Date(),
          ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
        },
      });
      if (input.assignedToId !== undefined) {
        note = input.assignedToId ? "Reassigned" : "Unassigned";
      }
      if (input.note) note = note ? `${note} — ${input.note}` : input.note;
      emailResult = await sendBookingStatusEmail(updated.email, updated, "under_review");
      emailAttempted = true;
      break;
    }

    case "mark_active": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { status: "active", internalNote: input.internalNote },
      });
      note = input.internalNote;
      // Internal-use only per spec — no visitor email for this transition.
      break;
    }

    case "record_outcome": {
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          status: "closed",
          outcome: input.outcome,
          leadTemperature: input.outcome === "not_sold" ? "warm" : booking.leadTemperature,
        },
      });
      note = input.outcome === "sold" ? "Sold" : "Not sold — kept warm for follow-up";
      if (input.note) note += ` — ${input.note}`;
      if (input.outcome === "sold") {
        emailResult = await sendSaleConfirmation(updated.email, updated);
        emailAttempted = true;
      }
      break;
    }

    case "save": {
      const changes: string[] = [];
      if (input.agentName !== undefined && input.agentName !== (booking.agentName ?? "")) {
        changes.push(`agent → ${input.agentName || "(cleared)"}`);
      }
      if (input.internalNote !== undefined && input.internalNote !== (booking.internalNote ?? "")) {
        changes.push("internal note updated");
      }
      if (input.assignedToId !== undefined && input.assignedToId !== booking.assignedToId) {
        changes.push(input.assignedToId ? "reassigned" : "unassigned");
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: {
          ...(input.agentName !== undefined ? { agentName: input.agentName || null } : {}),
          ...(input.internalNote !== undefined ? { internalNote: input.internalNote } : {}),
          ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
        },
      });
      note = changes.length > 0 ? changes.join("; ") : null;
      break;
    }

    case "escalate_lead": {
      // Enforced here, not just hidden in the UI — a raw request can't use
      // this action to cool a lead off, only to raise it.
      if (!isEscalation(booking.leadTemperature, input.leadTemperature)) {
        return NextResponse.json(
          {
            error: `Can't change lead temperature from "${booking.leadTemperature}" to "${input.leadTemperature}" — this action only escalates.`,
          },
          { status: 400 }
        );
      }
      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { leadTemperature: input.leadTemperature },
      });
      note = `${booking.leadTemperature} → ${input.leadTemperature}`;
      if (input.note) note += ` — ${input.note}`;
      break;
    }

    case "assign_agent": {
      if (input.agentId === null) {
        // Unassign
        const prevAgent = booking.agentId ? await prisma.agent.findUnique({ where: { id: booking.agentId } }) : null;
        updated = await prisma.inspectionBooking.update({
          where: { id },
          data: { agentId: null, agentName: null },
        });
        note = prevAgent ? `Unassigned from ${prevAgent.name}` : "Unassigned agent";
        if (input.note) note += ` — ${input.note}`;
        break;
      }

      const agent = await prisma.agent.findUnique({ where: { id: input.agentId } });
      if (!agent) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
      if (!agent.isActive) {
        return NextResponse.json({ error: "Agent is deactivated" }, { status: 400 });
      }

      updated = await prisma.inspectionBooking.update({
        where: { id },
        data: { agentId: agent.id, agentName: agent.name },
      });

      // Notify agent via email with client info for follow-up
      emailResult = await sendAgentAssignment(agent.email, {
        agentName: agent.name,
        clientName: updated.name,
        clientEmail: updated.email,
        clientPhone: updated.phone,
        ref: updated.ref,
        preferredDate: updated.preferredDate,
        preferredTime: updated.preferredTime,
        rescheduledDate: updated.rescheduledDate,
        rescheduledTime: updated.rescheduledTime,
        location: updated.location,
        agentCategory: agent.category,
      });
      emailAttempted = true;

      note = `Assigned to ${agent.name} (${agent.category.replace("_", " ")})`;
      if (input.note) note += ` — ${input.note}`;
      break;
    }
  }

  await prisma.bookingActivity.create({
    data: {
      bookingId: id,
      actorId,
      actorName,
      action: input.action,
      fromStatus,
      toStatus: updated.status,
      note,
      emailSent: emailAttempted ? emailResult.sent : null,
      emailError: emailResult.error,
    },
  });

  return NextResponse.json({ booking: updated, emailResult });
}
```

## `src/app/api/admin/bookings/[id]/messages/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = await prisma.inspectionBooking.findUnique({ where: { id }, select: { id: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  const messages = await prisma.bookingMessage.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const booking = await prisma.inspectionBooking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // Messaging is available until booking is closed — after closed it's read-only (spec).
  if (booking.status === "closed") {
    return NextResponse.json({ error: "Booking is closed — messaging is read-only" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (message.length > 5000) return NextResponse.json({ error: "Message too long (max 5000)" }, { status: 400 });

  const authorId = session!.user.id;
  const authorName = session!.user.name ?? session!.user.email ?? "Unknown";

  const msg = await prisma.bookingMessage.create({
    data: {
      bookingId: id,
      authorId,
      authorName,
      message,
    },
  });

  // Also append to activity timeline for audit continuity
  await prisma.bookingActivity.create({
    data: {
      bookingId: id,
      actorId: authorId,
      actorName: authorName,
      action: "message",
      fromStatus: booking.status,
      toStatus: booking.status,
      note: message.slice(0, 1000),
    },
  });

  return NextResponse.json({ message: msg }, { status: 201 });
}
```

## `src/app/api/admin/bookings/export/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";
import { allStatuses, allTemperatures } from "@/lib/booking-ui";
import type { Prisma, BookingStatus, LeadTemperature } from "@/generated/prisma/client";

const COLUMNS = [
  { key: "id", header: "ID" },
  { key: "ref", header: "Reference" },
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "preferredDate", header: "Preferred Date" },
  { key: "preferredTime", header: "Preferred Time" },
  { key: "location", header: "Location" },
  { key: "agentName", header: "Agent (site form)" },
  { key: "companyAgent", header: "Company Agent" },
  { key: "companyAgentEmail", header: "Agent Email" },
  { key: "companyAgentPhone", header: "Agent Phone" },
  { key: "companyAgentCategory", header: "Agent Category" },
  { key: "status", header: "Status" },
  { key: "assignedTo", header: "Assigned To" },
  { key: "internalNote", header: "Internal Note" },
  { key: "rescheduledDate", header: "Rescheduled Date" },
  { key: "rescheduledTime", header: "Rescheduled Time" },
  { key: "outcome", header: "Outcome" },
  { key: "leadTemperature", header: "Lead Temperature" },
  { key: "createdAt", header: "Created At" },
  { key: "updatedAt", header: "Updated At" },
  { key: "reviewedBy", header: "Reviewed By" },
  { key: "reviewedAt", header: "Reviewed At" },
] as const;

function fmt(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// CSV has no cell-type metadata, so spreadsheet apps guess a cell's type
// from its leading character on open/import — a value starting with
// =, +, -, or @ gets executed as a formula ("CSV injection"). Free text
// here (name, location, internalNote, agentName) is visitor/admin-supplied,
// so neutralize that before it ever reaches a cell. (The .xlsx path is
// unaffected — exceljs stores cell.value as a typed string, never a
// formula, unless a {formula: ...} object is explicitly passed.)
function sanitizeCsvCell(v: string): string {
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
}

function csvEscape(v: string): string {
  const safe = sanitizeCsvCell(v);
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  const where: Prisma.InspectionBookingWhereInput = {};
  const status = params.get("status");
  const leadTemperature = params.get("leadTemperature");
  const agent = params.get("agent");
  const missingAgent = params.get("missingAgent");
  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  const format = params.get("format") === "xlsx" ? "xlsx" : "csv";

  if (status && (allStatuses as readonly string[]).includes(status)) {
    where.status = status as BookingStatus;
  }
  if (leadTemperature && (allTemperatures as readonly string[]).includes(leadTemperature)) {
    where.leadTemperature = leadTemperature as LeadTemperature;
  }
  if (missingAgent === "1") where.agentId = null;
  else if (agent) {
    // Search both free-text agentName and assigned company agent name/email
    where.OR = [
      { agentName: { contains: agent, mode: "insensitive" } },
      { agent: { name: { contains: agent, mode: "insensitive" } } },
      { agent: { email: { contains: agent, mode: "insensitive" } } },
    ];
  }

  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return NextResponse.json({ error: "Invalid dateFrom/dateTo" }, { status: 400 });
  }
  if (from || to) {
    where.preferredDate = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const bookings = await prisma.inspectionBooking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { assignedToUser: true, reviewedByUser: true, agent: true },
  });

  const rows = bookings.map((b) => ({
    id: b.id,
    ref: b.ref,
    name: b.name,
    email: b.email,
    preferredDate: fmt(b.preferredDate),
    preferredTime: b.preferredTime,
    location: b.location,
    agentName: b.agentName ?? "",
    companyAgent: b.agent?.name ?? "",
    companyAgentEmail: b.agent?.email ?? "",
    companyAgentPhone: b.agent?.phone ?? "",
    companyAgentCategory: b.agent?.category ?? "",
    status: b.status,
    assignedTo: b.assignedToUser?.name ?? "",
    internalNote: b.internalNote ?? "",
    rescheduledDate: fmt(b.rescheduledDate),
    rescheduledTime: b.rescheduledTime ?? "",
    outcome: b.outcome ?? "",
    leadTemperature: b.leadTemperature,
    createdAt: fmt(b.createdAt),
    updatedAt: fmt(b.updatedAt),
    reviewedBy: b.reviewedByUser?.name ?? "",
    reviewedAt: fmt(b.reviewedAt),
  }));

  const filename = `inspection-bookings-${new Date().toISOString().split("T")[0]}`;

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Bookings");
    sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 20 }));
    sheet.addRows(rows);
    sheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  const header = COLUMNS.map((c) => csvEscape(c.header)).join(",");
  const body = rows
    .map((row) => COLUMNS.map((c) => csvEscape(fmt(row[c.key as keyof typeof row]))).join(","))
    .join("\n");
  const csv = `${header}\n${body}\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
```

## `src/app/api/admin/notifications/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isInternalRole } from "@/lib/authz";

export async function GET() {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session!.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { booking: { select: { ref: true } } },
    }),
    prisma.notification.count({ where: { userId: session!.user.id, read: false } }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!isInternalRole(session?.user?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (body?.all === true) {
    await prisma.notification.updateMany({
      where: { userId: session!.user.id, read: false },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (typeof body?.id === "string") {
    // userId in the where clause keeps this scoped to the caller's own
    // notifications — an admin can't mark someone else's as read.
    await prisma.notification.updateMany({
      where: { id: body.id, userId: session!.user.id },
      data: { read: true },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide { id } or { all: true }" }, { status: 400 });
}
```

## `src/app/api/auth/[...nextauth]/route.ts`

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

## `.env.example`

```ts
DATABASE_URL="postgresql://realestate:realestate@localhost:5544/realestate?schema=public"

NEXTAUTH_SECRET="replace-with-a-long-random-string"
NEXTAUTH_URL="http://localhost:3000"

SMTP_HOST="smtp.zoho.com"
SMTP_PORT="587"
SMTP_USER="info@belgrovehomes.com"
SMTP_PASS=""
SMTP_FROM="Belgrove Homes <info@belgrovehomes.com>"
# Zoho — app password for info@belgrovehomes.com (production). Set in .env as ZOHO_APP_PASSWORD
ZOHO_APP_PASSWORD=""

ADMIN_ALERT_EMAILS="admin@belgrovehomes.example"

SEED_ADMIN_EMAIL="admin@belgrovehomes.example"
SEED_ADMIN_PASSWORD="replace-with-a-strong-password"
SEED_ADMIN_NAME="Admin"
```

## `docker-compose.yml`

```ts
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: realestate
      POSTGRES_PASSWORD: realestate
      POSTGRES_DB: realestate
    ports:
      - "5544:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mailhog:
    image: mailhog/mailhog
    restart: unless-stopped
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # Web UI

volumes:
  postgres_data:
```

