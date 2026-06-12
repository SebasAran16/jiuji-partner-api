import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { VideoImportData, VideoCreateData, VideoUpdate, VideoFilter, DriveFileInfo } from '../../../const';
import { VideoRepository } from '../repository/video.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { VectorStoreService } from './vector-store.service';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly videoRepository: VideoRepository,
    private readonly prisma: PrismaService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async create(data: VideoCreateData) {
    return this.videoRepository.create({
      title: data.title,
      url: data.url,
      description: data.description ?? null,
      thumbnailUrl: data.thumbnailUrl ?? null,
      duration: data.duration ?? null,
      competitor: data.competitor ?? null,
      competition: data.competition ?? null,
      tags: data.tags ?? [],
    });
  }

  async findAll(params: VideoFilter) {
    const where: Record<string, any> = {};

    if (params.status) {
      where.processingStatus = params.status;
    }

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
        { competitor: { contains: params.search, mode: 'insensitive' } },
        { competition: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return this.videoRepository.findManyPaginated({
      page: params.page,
      perPage: params.perPage,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const video = await this.videoRepository.findById(id);
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  async update(id: string, data: VideoUpdate) {
    await this.findById(id);
    return this.videoRepository.update(id, data as any);
  }

  async setProcessingStatus(id: string, status: string) {
    await this.videoRepository.update(id, { processingStatus: status } as any);
  }

  async createBatch(items: VideoImportData[]): Promise<string[]> {
    return this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const item of items) {
        const video = await tx.video.create({
          data: {
            title: item.title,
            url: item.url,
            description: item.description ?? null,
            thumbnailUrl: item.thumbnailUrl ?? null,
            duration: null,
            competitor: item.competitor ?? null,
            competition: item.competition ?? null,
            tags: item.tags ?? [],
          },
        });
        ids.push(video.id);
      }
      return ids;
    });
  }

  async createBatchFromDrive(items: DriveFileInfo[]): Promise<string[]> {
    const videos: VideoImportData[] = items.map((item) => ({
      title: item.name.replace(/\.[^.]+$/, ''),
      url: item.downloadUrl,
      // Left empty on purpose: the import job generates a real description
      // from frame captions + transcript when none exists
      description: undefined,
      thumbnailUrl: undefined,
      competitor: undefined,
      competition: undefined,
      tags: ['google-drive'],
    }));
    return this.createBatch(videos);
  }

  async delete(id: string) {
    await this.findById(id);
    try {
      await this.vectorStoreService.deleteByVideoId(id);
    } catch (err) {
      // Orphaned vectors are tolerable; a DB row pointing nowhere is not
      this.logger.warn(`Could not purge vectors for video ${id}: ${err}`);
    }
    return this.videoRepository.delete(id);
  }
}
