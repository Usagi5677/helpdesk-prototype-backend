-- CreateTable
CREATE TABLE "Site" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT E'Public',

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);
