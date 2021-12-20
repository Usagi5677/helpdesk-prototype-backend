/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `UserGroup` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "UserGroup_name_key" ON "UserGroup"("name");
