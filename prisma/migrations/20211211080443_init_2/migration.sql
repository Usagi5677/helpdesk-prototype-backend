/*
  Warnings:

  - You are about to drop the column `categoryId` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `TicketCategory` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `TicketCategory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ticketId` to the `TicketCategory` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_categoryId_fkey";

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "categoryId";

-- AlterTable
ALTER TABLE "TicketCategory" DROP COLUMN "name",
ADD COLUMN     "categoryId" INTEGER NOT NULL,
ADD COLUMN     "ticketId" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
