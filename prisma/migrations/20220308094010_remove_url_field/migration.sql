/*
  Warnings:

  - You are about to drop the column `url` on the `Site` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Site_url_key";

-- AlterTable
ALTER TABLE "Site" DROP COLUMN "url";
