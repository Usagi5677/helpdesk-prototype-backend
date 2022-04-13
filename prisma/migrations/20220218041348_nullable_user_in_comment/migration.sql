-- DropForeignKey
ALTER TABLE "TicketComment" DROP CONSTRAINT "TicketComment_userId_fkey";

-- AlterTable
ALTER TABLE "TicketComment" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
