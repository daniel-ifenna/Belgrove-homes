-- Phase 2 customer section delta: test-data flag on Customer (set by
-- scripts/mark-test-data.ts propagation for customers whose linked
-- records are all test).
ALTER TABLE "Customer" ADD COLUMN "isTest" BOOLEAN NOT NULL DEFAULT false;
