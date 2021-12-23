/*
  Warnings:

  - A unique constraint covering the columns `[userId,ticketId]` on the table `TicketFollowing` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TicketFollowing_userId_ticketId_key" ON "TicketFollowing"("userId", "ticketId");
