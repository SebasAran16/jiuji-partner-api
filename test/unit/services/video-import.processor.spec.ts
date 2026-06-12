import { Test, TestingModule } from '@nestjs/testing';
import type { Job } from 'bull';
import { VideoImportProcessor } from '../../../src/core/queues/video-import.processor';
import { VideosService } from '../../../src/core/services/videos.service';
import { MediaService } from '../../../src/core/services/media.service';
import { LlmService } from '../../../src/core/services/llm.service';
import { TranscriptionService } from '../../../src/core/services/transcription.service';
import { VectorStoreService } from '../../../src/core/services/vector-store.service';
import { MovementRepository } from '../../../src/core/repository/movement.repository';

const mockVideo = (overrides: Record<string, any> = {}) => ({
  id: 'video-1',
  title: 'Armbar from Closed Guard',
  description: null,
  url: 'https://example.com/video.mp4',
  thumbnailUrl: null,
  duration: null,
  competitor: null,
  competition: null,
  tags: ['armbar'],
  processingStatus: 'PENDING',
  createdAt: new Date(),
  ...overrides,
});

const mockJob = (videoId: string, attemptsMade = 0, attempts = 3) =>
  ({
    id: 'job-1',
    data: { videoId },
    attemptsMade,
    opts: { attempts },
  }) as Job<{ videoId: string }>;

describe('VideoImportProcessor', () => {
  let processor: VideoImportProcessor;
  let videosService: jest.Mocked<VideosService>;
  let mediaService: jest.Mocked<MediaService>;
  let llmService: jest.Mocked<LlmService>;
  let transcriptionService: jest.Mocked<TranscriptionService>;
  let vectorStoreService: jest.Mocked<VectorStoreService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoImportProcessor,
        {
          provide: VideosService,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
            setProcessingStatus: jest.fn(),
          },
        },
        {
          provide: MediaService,
          useValue: {
            createWorkDir: jest.fn().mockResolvedValue('/tmp/work'),
            cleanupWorkDir: jest.fn(),
            downloadVideo: jest.fn().mockResolvedValue('/tmp/work/source.mp4'),
            getDurationSeconds: jest.fn().mockResolvedValue(65),
            extractCandidateFrames: jest.fn().mockResolvedValue([]),
            selectQualityFrames: jest.fn().mockResolvedValue([]),
            frameToBase64: jest.fn().mockResolvedValue('base64data'),
            extractAudio: jest.fn().mockResolvedValue('/tmp/work/audio.wav'),
          },
        },
        {
          provide: LlmService,
          useValue: {
            captionFrame: jest.fn(),
            generateVideoDescription: jest
              .fn()
              .mockResolvedValue('Generated description.'),
            embedDocuments: jest.fn(),
          },
        },
        {
          provide: TranscriptionService,
          useValue: { transcribe: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: VectorStoreService,
          useValue: { deleteByVideoId: jest.fn(), upsertSegments: jest.fn() },
        },
        {
          provide: MovementRepository,
          useValue: {
            findFiltered: jest.fn().mockResolvedValue([{ name: 'Armbar' }]),
          },
        },
      ],
    }).compile();

    processor = module.get(VideoImportProcessor);
    videosService = module.get(VideosService);
    mediaService = module.get(MediaService);
    llmService = module.get(LlmService);
    transcriptionService = module.get(TranscriptionService);
    vectorStoreService = module.get(VectorStoreService);

    llmService.embedDocuments.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => [0.1, 0.2])),
    );
  });

  it('runs the full pipeline and marks the video COMPLETED', async () => {
    videosService.findById.mockResolvedValue(mockVideo());
    mediaService.selectQualityFrames.mockResolvedValue([
      {
        path: '/tmp/work/frames/f1.jpg',
        timestamp: 5,
        quality: { sharpness: 9, brightness: 120 },
      },
      {
        path: '/tmp/work/frames/f2.jpg',
        timestamp: 40,
        quality: { sharpness: 8, brightness: 110 },
      },
    ]);
    llmService.captionFrame
      .mockResolvedValueOnce('Closed guard, sleeve and collar grips.')
      .mockResolvedValueOnce(null); // VLM judged the frame unusable
    transcriptionService.transcribe.mockResolvedValue([
      { start: 0, end: 10, text: 'Start by controlling the wrist.' },
      { start: 35, end: 45, text: 'Swing the leg over the head.' },
    ]);

    await processor.process(mockJob('video-1'));

    expect(videosService.setProcessingStatus).toHaveBeenNthCalledWith(
      1,
      'video-1',
      'PROCESSING',
    );
    expect(videosService.setProcessingStatus).toHaveBeenNthCalledWith(
      2,
      'video-1',
      'COMPLETED',
    );

    // description was missing -> generated and saved along with duration
    expect(llmService.generateVideoDescription).toHaveBeenCalled();
    expect(videosService.update).toHaveBeenCalledWith('video-1', {
      description: 'Generated description.',
      duration: 65,
    });

    // stale points purged before upserting fresh ones
    expect(vectorStoreService.deleteByVideoId).toHaveBeenCalledWith('video-1');
    const [segments, vectors] = vectorStoreService.upsertSegments.mock.calls[0];
    expect(vectors).toHaveLength(segments.length);

    // 65s -> windows 0-30 (caption+transcript) and 30-60 (transcript), 60-65 empty
    // and skipped, plus the video-level summary document
    expect(segments).toHaveLength(3);
    expect(segments[0].text).toContain('Closed guard');
    expect(segments[0].text).toContain('controlling the wrist');
    expect(segments[1].text).toContain('Swing the leg');
    expect(segments[1].text).not.toContain('Closed guard');
    expect(segments[2].startTime).toBe(0);
    expect(segments[2].endTime).toBe(65);

    expect(mediaService.cleanupWorkDir).toHaveBeenCalledWith('/tmp/work');
  });

  it('keeps an existing description instead of generating one', async () => {
    videosService.findById.mockResolvedValue(
      mockVideo({ description: 'Hand-written.' }),
    );

    await processor.process(mockJob('video-1'));

    expect(llmService.generateVideoDescription).not.toHaveBeenCalled();
    expect(videosService.update).toHaveBeenCalledWith('video-1', {
      description: 'Hand-written.',
      duration: 65,
    });
  });

  it('does not generate a description without captions or transcript evidence', async () => {
    videosService.findById.mockResolvedValue(mockVideo());
    // defaults: no quality frames, empty transcript

    await processor.process(mockJob('video-1'));

    expect(llmService.generateVideoDescription).not.toHaveBeenCalled();
    expect(videosService.update).toHaveBeenCalledWith('video-1', {
      description: undefined,
      duration: 65,
    });
    expect(videosService.setProcessingStatus).toHaveBeenNthCalledWith(
      2,
      'video-1',
      'COMPLETED',
    );
  });

  it('skips transcription when the video has no audio stream', async () => {
    videosService.findById.mockResolvedValue(mockVideo());
    mediaService.extractAudio.mockResolvedValue(null);

    await processor.process(mockJob('video-1'));

    expect(transcriptionService.transcribe).not.toHaveBeenCalled();
    expect(videosService.setProcessingStatus).toHaveBeenNthCalledWith(
      2,
      'video-1',
      'COMPLETED',
    );
  });

  it('rethrows and resets to PENDING when a non-final attempt fails', async () => {
    videosService.findById.mockResolvedValue(mockVideo());
    mediaService.downloadVideo.mockRejectedValue(new Error('404'));

    // attempt 1 of 3 — Bull will retry, video must not be FAILED yet
    await expect(processor.process(mockJob('video-1', 0, 3))).rejects.toThrow(
      '404',
    );

    expect(videosService.setProcessingStatus).toHaveBeenNthCalledWith(
      2,
      'video-1',
      'PENDING',
    );
    expect(vectorStoreService.upsertSegments).not.toHaveBeenCalled();
    expect(mediaService.cleanupWorkDir).toHaveBeenCalledWith('/tmp/work');
  });

  it('marks the video FAILED and still cleans up on the final attempt', async () => {
    videosService.findById.mockResolvedValue(mockVideo());
    mediaService.downloadVideo.mockRejectedValue(new Error('404'));

    // attempt 3 of 3 — retries exhausted
    await expect(processor.process(mockJob('video-1', 2, 3))).rejects.toThrow(
      '404',
    );

    expect(videosService.setProcessingStatus).toHaveBeenNthCalledWith(
      2,
      'video-1',
      'FAILED',
    );
    expect(vectorStoreService.upsertSegments).not.toHaveBeenCalled();
    expect(mediaService.cleanupWorkDir).toHaveBeenCalledWith('/tmp/work');
  });
});
