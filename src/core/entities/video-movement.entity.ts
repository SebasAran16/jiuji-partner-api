export class VideoMovementEntity {
  id: string;
  videoId: string;
  movementId: string;
  timestampStart: number | null;
  timestampEnd: number | null;
  confidence: number | null;
  createdAt: Date;

  constructor(partial: Partial<VideoMovementEntity>) {
    Object.assign(this, partial);
  }
}
