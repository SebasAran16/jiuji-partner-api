import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoEntity } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class VideoRepository extends PrismaRepository<
  VideoEntity,
  Prisma.VideoCreateInput,
  Prisma.VideoUpdateInput
> {
  protected readonly model = 'video' as const;

  constructor(prisma: PrismaService) {
    super(prisma, VideoEntity);
  }
}
