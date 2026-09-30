-- Add deterministic dedupe key to EmailOutbox. Nullable so legacy rows are
-- untouched (Postgres allows multiple NULLs in a unique index); all new rows
-- set it, and the unique index turns a duplicate enqueue into a P2002 that
-- enqueueEmail converts into "return the existing row".
ALTER TABLE "EmailOutbox" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");
