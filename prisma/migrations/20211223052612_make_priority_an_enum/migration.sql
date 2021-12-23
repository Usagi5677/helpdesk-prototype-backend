/*
 Warnings:
 
 - You are about to drop the `Priority` table. If the table is not empty, all the data it contains will be lost.
 
 */
-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_priorityId_fkey";
-- DropTable
DROP TABLE "Priority";
-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('High', 'Normal', 'Low');
-- AlterTable
ALTER TABLE "Ticket"
ADD COLUMN "priority" "Priority";