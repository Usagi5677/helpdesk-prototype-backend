-- AlterTable
ALTER TABLE "TicketAttachment" ALTER COLUMN "url" DROP NOT NULL,
ALTER COLUMN "mode" SET DEFAULT E'Public';
