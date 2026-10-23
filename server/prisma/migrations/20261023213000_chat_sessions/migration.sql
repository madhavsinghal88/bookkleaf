-- DropIndex
DROP INDEX "ChatThread_userId_kind_key";

-- DropIndex
DROP INDEX "ChatThread_sessionId_kind_key";

-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN "title" TEXT;

-- Backfill titles from the first thing the visitor asked.
UPDATE "ChatThread" AS thread
SET "title" = LEFT(first_message."content", 80)
FROM (
  SELECT DISTINCT ON ("threadId") "threadId", "content"
  FROM "ChatMessage"
  WHERE "role" = 'USER'
  ORDER BY "threadId", "createdAt" ASC, "id" ASC
) AS first_message
WHERE thread."id" = first_message."threadId";

-- CreateIndex
CREATE INDEX "ChatThread_userId_kind_updatedAt_idx" ON "ChatThread"("userId", "kind", "updatedAt");

-- CreateIndex
CREATE INDEX "ChatThread_sessionId_kind_updatedAt_idx" ON "ChatThread"("sessionId", "kind", "updatedAt");
