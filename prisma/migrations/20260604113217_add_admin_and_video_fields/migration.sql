-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "video_movements" (
    "id" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "movement_id" TEXT NOT NULL,
    "timestamp_start" INTEGER,
    "timestamp_end" INTEGER,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "video_movements" ADD CONSTRAINT "video_movements_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_movements" ADD CONSTRAINT "video_movements_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
