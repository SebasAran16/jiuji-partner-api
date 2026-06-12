import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import type { VideoImportData } from '../../../const';
import { VideosService } from './videos.service';

@Injectable()
export class ImportService {
  constructor(
    private readonly videosService: VideosService,
    @InjectQueue('video-import') private readonly queue: Queue,
  ) {}

  async importVideos(videos: VideoImportData[]) {
    const videoIds = await this.videosService.createBatch(videos);
    // One job per video: independent retries, per-video visibility in Bull Board
    await this.queue.addBulk(videoIds.map((videoId) => ({ data: { videoId } })));
    return { queued: videoIds.length };
  }
}
