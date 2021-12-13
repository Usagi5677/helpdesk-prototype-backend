/*
  Warnings:

  - You are about to drop the column `level` on the `TicketCategory` table. All the data in the column will be lost.
  - Added the required column `name` to the `TicketCategory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TicketCategory" DROP COLUMN "level",
ADD COLUMN     "name" TEXT NOT NULL;
