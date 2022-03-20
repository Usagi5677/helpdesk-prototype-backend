/*
  Warnings:

  - A unique constraint covering the columns `[createdAt,status,siteId]` on the table `TicketStatusHistory` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "TicketStatusHistory_createdAt_status_key";

-- CreateIndex
CREATE UNIQUE INDEX "TicketStatusHistory_createdAt_status_siteId_key" ON "TicketStatusHistory"("createdAt", "status", "siteId");
