import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UserEntity } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class UserRepository extends PrismaRepository<
  UserEntity,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  protected readonly model = 'user' as const;

  constructor(prisma: PrismaService) {
    super(prisma, UserEntity);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.findUnique({ where: { email } });
  }

  async findByVerificationToken(token: string): Promise<UserEntity | null> {
    return this.findFirst({ where: { verificationToken: token } });
  }
}
