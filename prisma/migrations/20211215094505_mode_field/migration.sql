-- AlterTable
ALTER TABLE "TicketAttachment" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT E'Private';

-- AlterTable
ALTER TABLE "TicketComment" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT E'Private';

-- AlterTable
ALTER TABLE "UserGroup" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT E'Private';
