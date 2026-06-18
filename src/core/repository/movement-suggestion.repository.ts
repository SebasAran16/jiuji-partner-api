import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MovementSuggestionEntity } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class MovementSuggestionRepository extends PrismaRepository<
  MovementSuggestionEntity,
  Prisma.MovementSuggestionCreateInput,
  Prisma.MovementSuggestionUpdateInput
> {
  protected readonly model = 'movementSuggestion' as const;

  constructor(prisma: PrismaService) {
    super(prisma, MovementSuggestionEntity);
  }

  // Dedupe across ALL statuses: pending → already queued, declined → the
  // admin said no (and the system must remember), approved → it's in the catalog
  async findByNormalizedName(
    normalizedName: string,
  ): Promise<MovementSuggestionEntity | null> {
    return this.findUnique({ where: { normalizedName } });
  }
}
