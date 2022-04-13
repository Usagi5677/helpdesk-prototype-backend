/*
  Warnings:

  - You are about to drop the column `openedAt` on the `Ticket` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "openedAt",
ADD COLUMN     "statusChangedAt" TIMESTAMP(3);
