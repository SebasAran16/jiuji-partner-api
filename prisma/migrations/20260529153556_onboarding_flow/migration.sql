-- CreateEnum
CREATE TYPE "Belt" AS ENUM ('WHITE', 'BLUE', 'PURPLE', 'BROWN', 'BLACK');

-- CreateEnum
CREATE TYPE "Objective" AS ENUM ('COMPETITION', 'RECREATIONAL', 'SELF_DEFENSE', 'CONDITIONING', 'TECHNICAL_DEVELOPMENT');

-- CreateEnum
CREATE TYPE "Intensity" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "belt" "Belt" NOT NULL DEFAULT 'WHITE',
    "stripes" INTEGER NOT NULL DEFAULT 0,
    "age" INTEGER,
    "weight" DOUBLE PRECISION,
    "bjj_academy" TEXT,
    "time_training" INTEGER,
    "trainings_per_week" INTEGER,
    "objective" "Objective",
    "intensity" "Intensity",
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verification_token" TEXT,
    "verification_token_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "min_belt" "Belt" NOT NULL DEFAULT 'WHITE',
    "gi" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "duration" INTEGER,
    "competitor" TEXT,
    "competition" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_verification_token_key" ON "users"("verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "movements_slug_key" ON "movements"("slug");
