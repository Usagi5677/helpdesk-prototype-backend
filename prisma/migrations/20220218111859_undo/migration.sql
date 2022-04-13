/*
  Warnings:

  - Made the column `userId` on table `TicketComment` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "TicketComment" DROP CONSTRAINT "TicketComment_userId_fkey";

-- AlterTable
ALTER TABLE "TicketComment" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
