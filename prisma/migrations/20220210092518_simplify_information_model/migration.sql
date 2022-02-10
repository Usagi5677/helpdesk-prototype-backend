/*
  Warnings:

  - You are about to drop the `KnowledgeBase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `KnowledgeBaseEntry` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "KnowledgeBaseEntry" DROP CONSTRAINT "KnowledgeBaseEntry_knowledgeBaseId_fkey";

-- DropForeignKey
ALTER TABLE "KnowledgeBaseEntry" DROP CONSTRAINT "KnowledgeBaseEntry_userId_fkey";

-- DropTable
DROP TABLE "KnowledgeBase";

-- DropTable
DROP TABLE "KnowledgeBaseEntry";

-- CreateTable
CREATE TABLE "Information" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "Information_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Information" ADD CONSTRAINT "Information_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
