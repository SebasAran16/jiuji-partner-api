import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createWriteStream } from 'fs';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import sharp from 'sharp';
import type { FrameInfo, FrameQuality, ScoredFrame } from '../../../const';

const execFileAsync = promisify(execFile);
// showinfo logs one stderr line per frame; default 1MB buffer overflows on long videos
const FFMPEG_MAX_BUFFER = 64 * 1024 * 1024;

// Quality gate thresholds (greyscale 0-255). Heuristic, tuned for mat footage:
// Laplacian stdev below ~4 is motion blur / defocus; brightness outside the
// band is a fade, a black frame or a blown-out highlight.
const MIN_SHARPNESS = 4;
const MIN_BRIGHTNESS = 20;
const MAX_BRIGHTNESS = 235;
// Frames closer than this are near-duplicates of the same scene
const MIN_FRAME_GAP_SECONDS = 2;
// Hard cap on VLM calls per video
const MAX_FRAMES_PER_VIDEO = 24;
const SCENE_CHANGE_THRESHOLD = 0.25;
// Static instructional videos trigger few scene changes; fall back to interval sampling
const MIN_SCENE_FRAMES = 4;
const FALLBACK_SAMPLE_INTERVAL_SECONDS = 10;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly configService: ConfigService) {}

  async createWorkDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'video-import-'));
  }

  async cleanupWorkDir(workDir: string) {
    await rm(workDir, { recursive: true, force: true });
  }

  async downloadVideo(url: string, workDir: string): Promise<string> {
    const destination = join(workDir, 'source.mp4');

    // Google API URLs are stored without credentials; authenticate per-request
    const headers: Record<string, string> = {};
    if (new URL(url).hostname === 'www.googleapis.com') {
      const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
      if (apiKey) {
        headers['X-Goog-Api-Key'] = apiKey;
      }
    }

    const response = await fetch(url, { headers });
    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${response.status}) for ${url}`);
    }

    // A text/html body is an error page (e.g. Drive's virus-scan interstitial),
    // not a video — fail with a clear message instead of letting ffprobe choke
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/html')) {
      throw new Error(
        `Download returned an HTML page instead of a video file (content-type: ${contentType}) for ${url}`,
      );
    }

    await pipeline(
      Readable.fromWeb(response.body as any),
      createWriteStream(destination),
    );
    return destination;
  }

  async getDurationSeconds(videoPath: string): Promise<number> {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      videoPath,
    ]);
    return parseFloat(stdout.trim()) || 0;
  }

  async extractAudio(
    videoPath: string,
    workDir: string,
  ): Promise<string | null> {
    const audioPath = join(workDir, 'audio.wav');
    try {
      // 16kHz mono WAV is what Whisper expects
      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        videoPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        audioPath,
      ]);
      return audioPath;
    } catch (err) {
      this.logger.warn(`No extractable audio in ${videoPath}: ${err}`);
      return null;
    }
  }

  async extractCandidateFrames(
    videoPath: string,
    workDir: string,
  ): Promise<FrameInfo[]> {
    const framesDir = join(workDir, 'frames');
    const sceneFrames = await this.runFrameExtraction(
      videoPath,
      framesDir,
      `select='gt(scene,${SCENE_CHANGE_THRESHOLD})',showinfo`,
    );
    if (sceneFrames.length >= MIN_SCENE_FRAMES) {
      return sceneFrames;
    }

    this.logger.log(
      `Only ${sceneFrames.length} scene-change frames in ${videoPath}; falling back to 1 frame / ${FALLBACK_SAMPLE_INTERVAL_SECONDS}s`,
    );
    const fallbackDir = join(workDir, 'frames-fallback');
    return this.runFrameExtraction(
      videoPath,
      fallbackDir,
      `fps=1/${FALLBACK_SAMPLE_INTERVAL_SECONDS},showinfo`,
    );
  }

  private async runFrameExtraction(
    videoPath: string,
    framesDir: string,
    filter: string,
  ): Promise<FrameInfo[]> {
    await execFileAsync('mkdir', ['-p', framesDir]);
    const { stderr } = await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        videoPath,
        '-vf',
        filter,
        '-fps_mode',
        'vfr',
        '-q:v',
        '2',
        join(framesDir, 'frame_%05d.jpg'),
      ],
      { maxBuffer: FFMPEG_MAX_BUFFER },
    );

    // showinfo writes "n: 0 ... pts_time:12.345" per emitted frame, in output order
    const timestamps = [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) =>
      parseFloat(m[1]),
    );
    const files = (await readdir(framesDir))
      .filter((f) => f.endsWith('.jpg'))
      .sort();

    return files.map((file, i) => ({
      path: join(framesDir, file),
      timestamp: timestamps[i] ?? 0,
    }));
  }

  async scoreFrame(framePath: string): Promise<FrameQuality> {
    const grey = sharp(framePath).greyscale();
    const [
      {
        channels: [plain],
      },
      {
        channels: [laplacian],
      },
    ] = await Promise.all([
      grey.clone().stats(),
      grey
        .clone()
        .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0] })
        .stats(),
    ]);
    return { brightness: plain.mean, sharpness: laplacian.stdev };
  }

  // The cheap pre-VLM gate: drop blurry/dark/blown frames, collapse near-duplicates,
  // cap the total. Order of filters = cheapest rejection first.
  async selectQualityFrames(frames: FrameInfo[]): Promise<ScoredFrame[]> {
    const scored: ScoredFrame[] = [];
    for (const frame of frames) {
      const quality = await this.scoreFrame(frame.path);
      if (
        quality.sharpness >= MIN_SHARPNESS &&
        quality.brightness >= MIN_BRIGHTNESS &&
        quality.brightness <= MAX_BRIGHTNESS
      ) {
        scored.push({ ...frame, quality });
      }
    }

    const deduped: ScoredFrame[] = [];
    for (const frame of scored.sort((a, b) => a.timestamp - b.timestamp)) {
      const last = deduped[deduped.length - 1];
      if (last && frame.timestamp - last.timestamp < MIN_FRAME_GAP_SECONDS) {
        if (frame.quality.sharpness > last.quality.sharpness) {
          deduped[deduped.length - 1] = frame;
        }
        continue;
      }
      deduped.push(frame);
    }

    if (deduped.length <= MAX_FRAMES_PER_VIDEO) {
      return deduped;
    }
    // Keep the sharpest frames, then restore chronological order
    return deduped
      .sort((a, b) => b.quality.sharpness - a.quality.sharpness)
      .slice(0, MAX_FRAMES_PER_VIDEO)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // Downscale before the VLM call: smaller payload, faster inference, no caption quality loss
  async frameToBase64(framePath: string, maxDimension = 768): Promise<string> {
    const buffer = await sharp(framePath)
      .resize(maxDimension, maxDimension, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    return buffer.toString('base64');
  }
}
