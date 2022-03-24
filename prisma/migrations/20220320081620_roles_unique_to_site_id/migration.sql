/*
  Warnings:

  - A unique constraint covering the columns `[userId,role,siteId]` on the table `UserRole` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UserRole_userId_role_key";

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_siteId_key" ON "UserRole"("userId", "role", "siteId");
