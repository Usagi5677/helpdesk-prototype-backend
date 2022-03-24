/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Site` will be added. If there are existing duplicate values, this will fail.
  - Made the column `code` on table `Site` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Site" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");
