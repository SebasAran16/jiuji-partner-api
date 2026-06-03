import { MovementEntity } from './movement.entity';

export class TrainingSessionMovementEntity {
  id: string;
  sessionId: string;
  movementId: string;
  timeSpentMinutes: number;
  notes: string | null;
  movement?: MovementEntity;

  constructor(partial: Partial<TrainingSessionMovementEntity>) {
    Object.assign(this, partial);
  }
}
