/*
  Warnings:

  - Added the required column `name` to the `Priority` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Priority" ADD COLUMN     "name" TEXT NOT NULL;
