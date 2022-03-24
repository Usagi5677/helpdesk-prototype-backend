/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Site` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'User';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "siteId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Information" ADD COLUMN     "siteId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "siteId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TicketStatusHistory" ADD COLUMN     "siteId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "UserGroup" ADD COLUMN     "siteId" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "UserRole" ADD COLUMN     "siteId" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Site_name_key" ON "Site"("name");

-- AddForeignKey
ALTER TABLE "Information" ADD CONSTRAINT "Information_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroup" ADD CONSTRAINT "UserGroup_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;
