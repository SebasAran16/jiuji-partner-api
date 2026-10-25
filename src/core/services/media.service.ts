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
import type {
  FrameInfo,
  FrameQuality,
  ScoredFrame,
  VideoProbe,
} from '../../../const';
import { withDeadline } from '../util/deadline';

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

// Parses `ffprobe -show_entries format=duration:stream=codec_type -of json`.
export function parseProbeOutput(stdout: string): VideoProbe {
  const probe = JSON.parse(stdout) as {
    streams?: { codec_type?: string }[];
    format?: { duration?: string };
  };
  return {
    durationSeconds: parseFloat(probe.format?.duration ?? '') || 0,
    hasAudio: (probe.streams ?? []).some((s) => s.codec_type === 'audio'),
  };
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  // Per-operation deadlines, all comfortably under the job timeout so a hang is
  // attributed to the stage that caused it rather than to the job as a whole.
  private readonly downloadTimeoutMs: number;
  private readonly ffprobeTimeoutMs: number;
  private readonly ffmpegTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.downloadTimeoutMs = Number(
      this.configService.get<string>('VIDEO_DOWNLOAD_TIMEOUT_MS', '1200000'),
    );
    this.ffprobeTimeoutMs = Number(
      this.configService.get<string>('FFPROBE_TIMEOUT_MS', '60000'),
    );
    this.ffmpegTimeoutMs = Number(
      this.configService.get<string>('FFMPEG_TIMEOUT_MS', '1800000'),
    );
  }

  async createWorkDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'video-import-'));
  }

  async cleanupWorkDir(workDir: string) {
    await rm(workDir, { recursive: true, force: true });
  }

  async downloadVideo(
    url: string,
    workDir: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const destination = join(workDir, 'source.mp4');
    // One deadline for headers AND body: a download that stalls mid-stream is
    // the failure mode that matters, and it is invisible to a headers-only timeout.
    const deadline = withDeadline(this.downloadTimeoutMs, signal);

    // Google API URLs are stored without credentials; authenticate per-request
    const headers: Record<string, string> = {};
    if (new URL(url).hostname === 'www.googleapis.com') {
      const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
      if (apiKey) {
        headers['X-Goog-Api-Key'] = apiKey;
      }
    }

    const response = await fetch(url, { headers, signal: deadline });
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
      { signal: deadline },
    );
    return destination;
  }

  // Proxy-open a video URL for the dashboard player. Range passthrough makes
  // the response seekable, which the suggestion-review UI depends on
  // (jumping straight to the evidence timestamp).
  async openVideoStream(
    url: string,
    range?: string,
  ): Promise<{
    status: number;
    headers: Record<string, string>;
    stream: Readable;
  }> {
    const headers: Record<string, string> = {};
    if (range) {
      headers['Range'] = range;
    }
    if (new URL(url).hostname === 'www.googleapis.com') {
      const apiKey = this.configService.get<string>('GOOGLE_API_KEY');
      if (apiKey) {
        headers['X-Goog-Api-Key'] = apiKey;
      }
    }

    const response = await fetch(url, { headers });
    if (!response.ok || !response.body) {
      throw new Error(`Upstream returned ${response.status} for ${url}`);
    }

    const passthrough: Record<string, string> = {};
    for (const name of [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
    ]) {
      const value = response.headers.get(name);
      if (value) {
        passthrough[name] = value;
      }
    }

    return {
      status: response.status,
      headers: passthrough,
      stream: Readable.fromWeb(response.body as any),
    };
  }

  // Duration and audio presence from one ffprobe call. Knowing up front whether
  // there is an audio stream lets extraction ask ffmpeg for exactly the outputs
  // that can exist, instead of inferring "no audio" from a failed decode.
  async probeVideo(
    videoPath: string,
    signal?: AbortSignal,
  ): Promise<VideoProbe> {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration:stream=codec_type',
        '-of',
        'json',
        videoPath,
      ],
      this.childProcessOptions(this.ffprobeTimeoutMs, signal),
    );
    return parseProbeOutput(stdout);
  }

  // `timeout` + `killSignal` are what actually reap the child: an aborted
  // promise alone would leave ffmpeg/ffprobe running. `signal` additionally
  // carries job-level cancellation down to the process.
  private childProcessOptions(
    timeoutMs: number,
    signal: AbortSignal | undefined,
    maxBuffer?: number,
  ) {
    return {
      signal: withDeadline(timeoutMs, signal),
      timeout: timeoutMs,
      killSignal: 'SIGKILL' as const,
      ...(maxBuffer ? { maxBuffer } : {}),
    };
  }

  // One ffmpeg decode pass that produces BOTH the captioning frames and the
  // Whisper audio, so a video is decoded once regardless of its length (a long
  // instructional used to be decoded twice — once for frames, once for audio).
  // `hasAudio` comes from probeVideo(): a silent video simply gets no audio
  // output, and any ffmpeg failure is a real error that propagates.
  async extractFramesAndAudio(
    videoPath: string,
    workDir: string,
    hasAudio: boolean,
    signal?: AbortSignal,
  ): Promise<{ frames: FrameInfo[]; audioPath: string | null }> {
    const framesDir = join(workDir, 'frames');
    const audioPath = hasAudio ? join(workDir, 'audio.wav') : null;

    // Primary pass: scene-change frames (+ audio when there is any)
    const sceneFrames = await this.runExtraction(
      videoPath,
      framesDir,
      `select='gt(scene,${SCENE_CHANGE_THRESHOLD})',showinfo`,
      audioPath,
      signal,
    );
    if (sceneFrames.length >= MIN_SCENE_FRAMES) {
      return { frames: sceneFrames, audioPath };
    }

    // Too few scene changes (static instructional) → interval sampling. The
    // audio was already produced above, so this decode is frames-only.
    this.logger.log(
      `Only ${sceneFrames.length} scene-change frames in ${videoPath}; falling back to 1 frame / ${FALLBACK_SAMPLE_INTERVAL_SECONDS}s`,
    );
    const frames = await this.runExtraction(
      videoPath,
      join(workDir, 'frames-fallback'),
      `fps=1/${FALLBACK_SAMPLE_INTERVAL_SECONDS},showinfo`,
      null,
      signal,
    );
    return { frames, audioPath };
  }

  // One ffmpeg invocation: frames through `filter`, plus a 16kHz mono WAV from
  // the same decode when `audioPath` is given (null = frames only).
  private async runExtraction(
    videoPath: string,
    framesDir: string,
    filter: string,
    audioPath: string | null,
    signal?: AbortSignal,
  ): Promise<FrameInfo[]> {
    await execFileAsync('mkdir', ['-p', framesDir]);
    const args = [
      '-y',
      '-i',
      videoPath,
      // Frame output
      '-vf',
      filter,
      '-fps_mode',
      'vfr',
      '-q:v',
      '2',
      join(framesDir, 'frame_%05d.jpg'),
    ];
    if (audioPath) {
      // Audio output, same decode: 16kHz mono WAV is what Whisper expects
      args.push('-vn', '-ac', '1', '-ar', '16000', audioPath);
    }
    const { stderr } = await execFileAsync(
      'ffmpeg',
      args,
      this.childProcessOptions(this.ffmpegTimeoutMs, signal, FFMPEG_MAX_BUFFER),
    );
    return this.collectFrames(stderr, framesDir);
  }

  // Pair each emitted frame with its timestamp. showinfo writes
  // "n: 0 ... pts_time:12.345" to stderr per frame, in output order.
  private async collectFrames(
    stderr: string,
    framesDir: string,
  ): Promise<FrameInfo[]> {
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
