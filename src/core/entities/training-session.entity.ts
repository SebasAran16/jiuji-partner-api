import { TrainingSessionMovementEntity } from './training-session-movement.entity';

export class TrainingSessionEntity {
  id: string;
  userId: string;
  date: Date;
  durationMinutes: number;
  intensityFeeling: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  movements?: TrainingSessionMovementEntity[];

  constructor(partial: Partial<TrainingSessionEntity>) {
    Object.assign(this, partial);
  }
}
