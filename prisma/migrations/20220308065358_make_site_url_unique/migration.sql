/*
  Warnings:

  - A unique constraint covering the columns `[url]` on the table `Site` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Site_url_key" ON "Site"("url");
