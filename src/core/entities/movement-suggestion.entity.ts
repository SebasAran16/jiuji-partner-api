export class MovementSuggestionEntity {
  id: string;
  name: string;
  normalizedName: string;
  description: string | null;
  category: string | null;
  type: string | null;
  gi: boolean | null;
  confidence: number | null;
  videoId: string | null;
  timestampStart: number | null;
  timestampEnd: number | null;
  evidence: string | null;
  status: string;
  reviewedAt: Date | null;
  createdMovementId: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<MovementSuggestionEntity>) {
    Object.assign(this, partial);
  }
}
