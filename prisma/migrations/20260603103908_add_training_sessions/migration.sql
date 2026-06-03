-- CreateTable
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_minutes" INTEGER NOT NULL,
    "intensity_feeling" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_session_movements" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "movement_id" TEXT NOT NULL,
    "time_spent_minutes" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "training_session_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session_movements" ADD CONSTRAINT "training_session_movements_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_session_movements" ADD CONSTRAINT "training_session_movements_movement_id_fkey" FOREIGN KEY ("movement_id") REFERENCES "movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
