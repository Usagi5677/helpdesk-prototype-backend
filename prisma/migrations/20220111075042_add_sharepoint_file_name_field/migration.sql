/*
  Warnings:

  - You are about to drop the column `url` on the `TicketAttachment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "TicketAttachment" DROP COLUMN "url",
ADD COLUMN     "sharepointFileName" TEXT;
