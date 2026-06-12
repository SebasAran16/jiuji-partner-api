import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import type { TranscriptSegment } from '../../../const';

// Only gateway to speech-to-text. 'whisper-local' is the dev provider (local
// container, zero API spend while testing); production will use a managed
// provider (TBD) selected via TRANSCRIPTION_PROVIDER — implement it here.
const SUPPORTED_TRANSCRIPTION_PROVIDERS = ['whisper-local'] as const;

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly whisperUrl: string;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>(
      'TRANSCRIPTION_PROVIDER',
      'whisper-local',
    );
    if (!SUPPORTED_TRANSCRIPTION_PROVIDERS.includes(provider as any)) {
      throw new Error(
        `TRANSCRIPTION_PROVIDER '${provider}' is not implemented. Supported: ${SUPPORTED_TRANSCRIPTION_PROVIDERS.join(', ')}. ` +
          'Add the provider to TranscriptionService before deploying with this configuration.',
      );
    }

    this.whisperUrl = this.configService.get<string>(
      'WHISPER_URL',
      'http://localhost:9000',
    );
  }

  // Empty result (no narration, whisper down) is a degraded-but-valid outcome:
  // frame captions and metadata still produce a usable document
  async transcribe(audioPath: string): Promise<TranscriptSegment[]> {
    try {
      const buffer = await readFile(audioPath);
      const form = new FormData();
      form.append('audio_file', new Blob([buffer]), basename(audioPath));

      const response = await fetch(
        `${this.whisperUrl}/asr?task=transcribe&output=json&encode=false`,
        {
          method: 'POST',
          body: form,
        },
      );
      if (!response.ok) {
        throw new Error(
          `Whisper returned ${response.status}: ${await response.text()}`,
        );
      }

      const result = (await response.json()) as {
        segments?: { start: number; end: number; text: string }[];
      };

      return (result.segments ?? [])
        .map((s) => ({ start: s.start, end: s.end, text: s.text.trim() }))
        .filter((s) => s.text.length > 0);
    } catch (err) {
      this.logger.warn(
        `Transcription failed for ${audioPath}, continuing without audio: ${err}`,
      );
      return [];
    }
  }
}
