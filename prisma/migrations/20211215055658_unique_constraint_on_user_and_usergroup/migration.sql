/*
  Warnings:

  - A unique constraint covering the columns `[userId,userGroupId]` on the table `UserGroupUser` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserGroupUser_userId_userGroupId_key" ON "UserGroupUser"("userId", "userGroupId");
