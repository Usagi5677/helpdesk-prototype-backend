/*
  Warnings:

  - You are about to drop the column `userGroupId` on the `Ticket` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `UserGroup` table. All the data in the column will be lost.
  - Added the required column `title` to the `Ticket` table without a default value. This is not possible if the table is not empty.
  - Added the required column `createdById` to the `UserGroup` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "userGroupId",
ADD COLUMN     "body" TEXT,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "UserGroup" DROP COLUMN "createdBy",
ADD COLUMN     "createdById" INTEGER NOT NULL;
