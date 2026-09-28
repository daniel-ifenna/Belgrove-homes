-- Phase 3 action inbox: immutable audit trail for payment/transaction/
-- receipt mutations + notification resolution timestamps.
CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT NOT NULL DEFAULT 'System',
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

ALTER TABLE "Notification" ADD COLUMN "resolvedAt" TIMESTAMP(3);
CREATE INDEX "Notification_userId_resolvedAt_idx" ON "Notification"("userId", "resolvedAt");
