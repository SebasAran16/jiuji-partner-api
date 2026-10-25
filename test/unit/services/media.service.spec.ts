import { parseProbeOutput } from '../../../src/core/services/media.service';

// Real ffprobe JSON shapes (captured from ffprobe 7 on generated test videos)
const probeJson = (streams: string[], duration?: string) =>
  JSON.stringify({
    programs: [],
    streams: streams.map((codec_type) => ({ codec_type })),
    format: duration === undefined ? {} : { duration },
  });

describe('parseProbeOutput', () => {
  it('reads duration and detects an audio stream', () => {
    expect(parseProbeOutput(probeJson(['video', 'audio'], '30.000000'))).toEqual(
      { durationSeconds: 30, hasAudio: true },
    );
  });

  it('reports no audio for a video-only file', () => {
    expect(parseProbeOutput(probeJson(['video'], '12.5'))).toEqual({
      durationSeconds: 12.5,
      hasAudio: false,
    });
  });

  it('ignores non-audio streams such as subtitles and data', () => {
    expect(
      parseProbeOutput(probeJson(['video', 'subtitle', 'data'], '5')).hasAudio,
    ).toBe(false);
  });

  it('falls back to 0 when the container reports no duration', () => {
    expect(parseProbeOutput(probeJson(['video', 'audio'])).durationSeconds).toBe(
      0,
    );
  });
});
