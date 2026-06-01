import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MovementEntity } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class MovementRepository extends PrismaRepository<
  MovementEntity,
  Prisma.MovementCreateInput,
  Prisma.MovementUpdateInput
> {
  protected readonly model = 'movement' as const;

  constructor(prisma: PrismaService) {
    super(prisma, MovementEntity);
  }

  async findBySlug(slug: string): Promise<MovementEntity | null> {
    return this.findUnique({ where: { slug } });
  }

  async findFiltered(params: { belt?: string; category?: string; gi?: boolean }) {
    const where: Record<string, any> = {};
    if (params.belt) where.minBelt = params.belt;
    if (params.category) where.category = params.category;
    if (params.gi !== undefined) where.gi = params.gi;
    return this.findMany({ where });
  }
}
