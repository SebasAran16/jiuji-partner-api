export interface UserIdentity {
  id: string;
  email: string;
  role: string;
}

export interface ProfileUpdate {
  firstName?: string;
  lastName?: string;
  belt?: string;
  stripes?: number;
  age?: number;
  weight?: number;
  bjjAcademy?: string;
  timeTraining?: number;
  trainingsPerWeek?: number;
  objective?: string;
  intensity?: string;
  avatarUrl?: string;
}

export interface OnboardingData {
  firstName: string;
  lastName: string;
  age: number;
  belt: string;
  stripes: number;
  bjjAcademy: string;
  timeTraining: number;
  trainingsPerWeek: number;
  objective: string;
  intensity: string;
  weight?: number;
}
