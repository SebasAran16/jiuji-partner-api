import { Injectable, NotFoundException } from '@nestjs/common';
import { TrainingSessionRepository } from '../repository/training-session.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { TrainingSessionEntity } from '../entities/training-session.entity';
import { CreateTrainingSessionDto } from '../http/request/training-sessions/create-training-session.dto';

@Injectable()
export class TrainingSessionsService {
  constructor(
    private readonly repository: TrainingSessionRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(userId: string, dto: CreateTrainingSessionDto): Promise<TrainingSessionEntity> {
    const data = await this.prisma.$transaction(async (tx) => {
      const session = await tx.trainingSession.create({
        data: {
          userId,
          date: dto.date ? new Date(dto.date) : new Date(),
          durationMinutes: dto.durationMinutes,
          intensityFeeling: dto.intensityFeeling,
          notes: dto.notes,
          movements:
            dto.movements && dto.movements.length > 0
              ? {
                  create: dto.movements.map((m) => ({
                    movementId: m.movementId,
                    timeSpentMinutes: m.timeSpentMinutes,
                    notes: m.notes,
                  })),
                }
              : undefined,
        },
        include: {
          movements: {
            include: { movement: true },
          },
        },
      });
      return session;
    });
    return new TrainingSessionEntity(data as any);
  }

  async findAll(userId: string, page: number, perPage: number) {
    return this.repository.findByUserIdPaginated(userId, page, perPage);
  }

  async findById(userId: string, id: string): Promise<TrainingSessionEntity> {
    const session = await this.prisma.trainingSession.findFirst({
      where: { id, userId },
      include: {
        movements: {
          include: { movement: true },
        },
      },
    });
    if (!session) {
      throw new NotFoundException('Training session not found');
    }
    return new TrainingSessionEntity(session as any);
  }
}
