import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../repository/user.repository';
import { Belt, Objective, Intensity } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash, verificationToken, verificationTokenExpiresAt, ...profile } = user;
    return profile;
  }

  async updateProfile(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      belt?: Belt;
      stripes?: number;
      age?: number;
      weight?: number;
      bjjAcademy?: string;
      timeTraining?: number;
      trainingsPerWeek?: number;
      objective?: Objective;
      intensity?: Intensity;
      avatarUrl?: string;
    },
  ) {
    const user = await this.userRepository.update(userId, data as any);
    const { passwordHash, verificationToken, verificationTokenExpiresAt, ...profile } = user;
    return profile;
  }
}
