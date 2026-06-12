import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProfileUpdate } from '../../../const';
import { UserRepository } from '../repository/user.repository';

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

  async updateProfile(userId: string, data: ProfileUpdate) {
    const user = await this.userRepository.update(userId, data as any);
    const { passwordHash, verificationToken, verificationTokenExpiresAt, ...profile } = user;
    return profile;
  }
}
