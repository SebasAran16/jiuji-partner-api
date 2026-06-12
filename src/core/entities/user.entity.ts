import { Belt, Objective, Intensity, Role } from '../../../const';

export class UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  belt: Belt;
  stripes: number;
  age: number | null;
  weight: number | null;
  bjjAcademy: string | null;
  timeTraining: number | null;
  trainingsPerWeek: number | null;
  objective: Objective | null;
  intensity: Intensity | null;
  role: Role;
  isVerified: boolean;
  verificationToken: string | null;
  verificationTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
