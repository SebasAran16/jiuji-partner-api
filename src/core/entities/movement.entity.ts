import { Belt } from '../../../const';

export class MovementEntity {
  id: string;
  name: string;
  slug: string;
  category: string;
  type: string;
  minBelt: Belt;
  gi: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<MovementEntity>) {
    Object.assign(this, partial);
  }
}
