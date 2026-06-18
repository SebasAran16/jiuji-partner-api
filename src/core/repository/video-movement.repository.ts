import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VideoMovementEntity } from '../entities';
import { PrismaRepository } from './prisma.repository';

@Injectable()
export class VideoMovementRepository extends PrismaRepository<
  VideoMovementEntity,
  Prisma.VideoMovementCreateInput,
  Prisma.VideoMovementUpdateInput
> {
  protected readonly model = 'videoMovement' as const;

  constructor(prisma: PrismaService) {
    super(prisma, VideoMovementEntity);
  }

  // Reprocessing a video must replace its links, not accumulate them
  async deleteByVideoId(videoId: string): Promise<void> {
    await this.prisma.videoMovement.deleteMany({ where: { videoId } });
  }

  async createForVideo(
    videoId: string,
    links: {
      movementId: string;
      timestampStart: number;
      timestampEnd: number;
      confidence: number;
    }[],
  ): Promise<void> {
    if (!links.length) return;
    await this.prisma.videoMovement.createMany({
      data: links.map((link) => ({ videoId, ...link })),
    });
  }
}
