import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { VideosService } from '../services/videos.service';
import { MediaService } from '../services/media.service';
import { LlmService } from '../services/llm.service';
import { TranscriptionService } from '../services/transcription.service';
import { VectorStoreService } from '../services/vector-store.service';
import { MovementRepository } from '../repository/movement.repository';
import type {
  FrameCaption,
  TranscriptSegment,
  VideoSegmentDocument,
} from '../../../const';

const SEGMENT_SECONDS = 30;
const TRANSCRIPT_EXCERPT_CHARS = 1500;

@Processor('video-import')
export class VideoImportProcessor {
  private readonly logger = new Logger(VideoImportProcessor.name);

  constructor(
    private readonly videosService: VideosService,
    private readonly mediaService: MediaService,
    private readonly llmService: LlmService,
    private readonly transcriptionService: TranscriptionService,
    private readonly vectorStoreService: VectorStoreService,
    private readonly movementRepository: MovementRepository,
  ) {}

  @Process()
  async process(job: Job<{ videoId: string }>) {
    const { videoId } = job.data;
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;
    this.logger.log(
      `Processing video ${videoId} (job ${job.id}, attempt ${attempt}/${maxAttempts})`,
    );

    try {
      await this.videosService.setProcessingStatus(videoId, 'PROCESSING');
      await this.vectorizeVideo(videoId);
      await this.videosService.setProcessingStatus(videoId, 'COMPLETED');
      this.logger.log(`Video ${videoId} processed successfully`);
    } catch (err) {
      const isFinalAttempt = attempt >= maxAttempts;
      this.logger.error(
        `Attempt ${attempt}/${maxAttempts} failed for video ${videoId}: ${err}`,
      );
      // FAILED only when retries are exhausted; PENDING signals "will retry"
      await this.videosService.setProcessingStatus(
        videoId,
        isFinalAttempt ? 'FAILED' : 'PENDING',
      );
      // Rethrow so Bull records the failure and schedules the backoff retry
      throw err;
    }
  }

  private async vectorizeVideo(videoId: string) {
    const video = await this.videosService.findById(videoId);
    const workDir = await this.mediaService.createWorkDir();

    try {
      const videoPath = await this.mediaService.downloadVideo(
        video.url,
        workDir,
      );
      const duration = await this.mediaService.getDurationSeconds(videoPath);

      // Frames: sample → quality-gate → caption with the VLM
      const candidates = await this.mediaService.extractCandidateFrames(
        videoPath,
        workDir,
      );
      const qualityFrames =
        await this.mediaService.selectQualityFrames(candidates);
      this.logger.log(
        `Video ${videoId}: ${candidates.length} candidate frames, ${qualityFrames.length} after quality gate`,
      );

      const vocabulary = (await this.movementRepository.findFiltered({})).map(
        (m) => m.name,
      );
      const captions: FrameCaption[] = [];
      for (const frame of qualityFrames) {
        const image = await this.mediaService.frameToBase64(frame.path);
        const caption = await this.llmService.captionFrame(image, vocabulary);
        if (caption) {
          captions.push({ timestamp: frame.timestamp, caption });
        }
      }

      // Audio: extract → transcribe (both steps degrade gracefully to empty)
      const audioPath = await this.mediaService.extractAudio(
        videoPath,
        workDir,
      );
      const transcript = audioPath
        ? await this.transcriptionService.transcribe(audioPath)
        : [];

      let description = video.description;
      // Without visual or audio evidence a small model invents content from the
      // title alone; better no description than a confident hallucination
      const hasEvidence = captions.length > 0 || transcript.length > 0;
      if (!description && hasEvidence) {
        description = await this.llmService.generateVideoDescription({
          title: video.title,
          tags: video.tags,
          competitor: video.competitor,
          competition: video.competition,
          captions: captions.map((c) => c.caption),
          transcriptExcerpt: transcript
            .map((t) => t.text)
            .join(' ')
            .slice(0, TRANSCRIPT_EXCERPT_CHARS),
        });
      }

      await this.videosService.update(videoId, {
        description: description ?? undefined,
        duration: video.duration ?? Math.round(duration),
      });

      const segments = this.buildSegmentDocuments(
        { id: videoId, title: video.title, tags: video.tags, description },
        duration,
        captions,
        transcript,
      );

      const vectors = await this.llmService.embedDocuments(
        segments.map((s) => s.text),
      );
      // Reprocessing must not accumulate stale points
      await this.vectorStoreService.deleteByVideoId(videoId);
      await this.vectorStoreService.upsertSegments(segments, vectors);
      this.logger.log(
        `Video ${videoId}: upserted ${segments.length} segments to Qdrant`,
      );
    } finally {
      await this.mediaService.cleanupWorkDir(workDir);
    }
  }

  // One document per time window that has content, plus one video-level summary
  // document so whole-video questions ("do we have armbar videos?") also match.
  private buildSegmentDocuments(
    video: {
      id: string;
      title: string;
      tags: string[];
      description?: string | null;
    },
    duration: number,
    captions: FrameCaption[],
    transcript: TranscriptSegment[],
  ): VideoSegmentDocument[] {
    const documents: VideoSegmentDocument[] = [];
    const windowCount = Math.max(
      1,
      Math.ceil((duration || SEGMENT_SECONDS) / SEGMENT_SECONDS),
    );

    for (let i = 0; i < windowCount; i++) {
      const start = i * SEGMENT_SECONDS;
      const end = Math.min(
        (i + 1) * SEGMENT_SECONDS,
        Math.max(duration, SEGMENT_SECONDS),
      );

      const windowTranscript = transcript
        .filter((t) => t.start < end && t.end >= start)
        .map((t) => t.text)
        .join(' ');
      const windowCaptions = captions
        .filter((c) => c.timestamp >= start && c.timestamp < end)
        .map((c) => c.caption);

      if (!windowTranscript && !windowCaptions.length) continue;

      documents.push({
        videoId: video.id,
        segmentIndex: documents.length,
        startTime: start,
        endTime: end,
        title: video.title,
        tags: video.tags,
        text: [
          `${video.title} (${start}s-${Math.round(end)}s)`,
          windowCaptions.length ? `Shown: ${windowCaptions.join(' | ')}` : '',
          windowTranscript ? `Narration: ${windowTranscript}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      });
    }

    documents.push({
      videoId: video.id,
      segmentIndex: documents.length,
      startTime: 0,
      endTime: Math.round(duration),
      title: video.title,
      tags: video.tags,
      text: [
        video.title,
        video.description ?? '',
        video.tags.length ? `Tags: ${video.tags.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });

    return documents;
  }
}
