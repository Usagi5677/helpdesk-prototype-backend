/*
  Warnings:

  - A unique constraint covering the columns `[userId,ticketId]` on the table `TicketAssignment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TicketAssignment_userId_ticketId_key" ON "TicketAssignment"("userId", "ticketId");
