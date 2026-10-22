-- AlterEnum
ALTER TYPE "AiPurpose" ADD VALUE 'CHAT_SUPPORT';
ALTER TYPE "AiPurpose" ADD VALUE 'CHAT_SALES';

-- CreateEnum
CREATE TYPE "ChatKind" AS ENUM ('SUPPORT', 'SALES');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" TEXT NOT NULL,
    "kind" "ChatKind" NOT NULL,
    "userId" TEXT,
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" "ChatRole" NOT NULL,
    "content" TEXT NOT NULL,
    "source" "ClassificationSource",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatThread_updatedAt_idx" ON "ChatThread"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_userId_kind_key" ON "ChatThread"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ChatThread_sessionId_kind_key" ON "ChatThread"("sessionId", "kind");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatThread" ADD CONSTRAINT "ChatThread_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
