/*
  Warnings:

  - You are about to drop the column `active` on the `TicketCategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "TicketCategory" DROP COLUMN "active";
