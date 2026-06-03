import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TrainingSessionEntity } from '../entities/training-session.entity';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class TrainingSessionRepository extends PrismaRepository<
  TrainingSessionEntity,
  Prisma.TrainingSessionCreateInput,
  Prisma.TrainingSessionUpdateInput
> {
  protected readonly model = 'trainingSession' as const;

  constructor(prisma: PrismaService) {
    super(prisma, TrainingSessionEntity);
  }

  async findByUserIdPaginated(
    userId: string,
    page: number,
    perPage: number,
  ) {
    return this.findManyPaginated({
      page,
      perPage,
      where: { userId },
      orderBy: { date: 'desc' },
      include: {
        movements: {
          include: { movement: true },
        },
      },
    });
  }
}
