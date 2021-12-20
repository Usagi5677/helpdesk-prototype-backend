-- DropForeignKey
ALTER TABLE "UserGroupUser" DROP CONSTRAINT "UserGroupUser_userGroupId_fkey";

-- DropForeignKey
ALTER TABLE "UserGroupUser" DROP CONSTRAINT "UserGroupUser_userId_fkey";

-- AlterTable
ALTER TABLE "TicketCategory" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "UserGroupUser" ADD CONSTRAINT "UserGroupUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGroupUser" ADD CONSTRAINT "UserGroupUser_userGroupId_fkey" FOREIGN KEY ("userGroupId") REFERENCES "UserGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
