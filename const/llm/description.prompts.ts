import type {
  FrameCaption,
  TranscriptSegment,
  VideoDescriptionMeta,
} from '../ai.types';

export const DESCRIPTION_SYSTEM_PROMPT =
  'You are a Brazilian Jiu-Jitsu analyst. Write a 2-3 sentence factual description of a training video for a video library. No marketing tone, no speculation beyond the evidence given.';

// Timestamped evidence, formatted the same way movement-matching formats it so
// the model sees a consistent shape across the pipeline.
const formatEvidence = (
  captions: FrameCaption[],
  transcript: TranscriptSegment[],
): string =>
  [
    captions.length
      ? `What the frames show:\n${captions.map((c) => `[${Math.round(c.timestamp)}s] ${c.caption}`).join('\n')}`
      : '',
    transcript.length
      ? `Narration:\n${transcript.map((t) => `[${Math.round(t.start)}s-${Math.round(t.end)}s] ${t.text}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

const formatMeta = (meta: VideoDescriptionMeta): string[] =>
  [
    `Title: ${meta.title}`,
    meta.tags.length ? `Tags: ${meta.tags.join(', ')}` : '',
    meta.competitor ? `Competitor: ${meta.competitor}` : '',
    meta.competition ? `Competition: ${meta.competition}` : '',
  ].filter(Boolean);

// Single-pass description (short video): metadata + all evidence in one prompt.
export const buildDescriptionUserPrompt = (
  meta: VideoDescriptionMeta,
  captions: FrameCaption[],
  transcript: TranscriptSegment[],
): string =>
  [...formatMeta(meta), formatEvidence(captions, transcript)]
    .filter(Boolean)
    .join('\n');

// Map step: summarize one time-window so a long video's evidence never
// overflows the context window. One sentence keeps the reduce input small.
export const DESCRIPTION_CHUNK_SYSTEM_PROMPT =
  'You are a Brazilian Jiu-Jitsu analyst. In ONE factual sentence, state the technique(s) shown or taught in this portion of a training video. No marketing tone, no speculation.';

export const buildDescriptionChunkPrompt = (
  captions: FrameCaption[],
  transcript: TranscriptSegment[],
  startSeconds: number,
  endSeconds: number,
): string =>
  [
    `Video portion ${Math.round(startSeconds)}s-${Math.round(endSeconds)}s.`,
    formatEvidence(captions, transcript),
  ]
    .filter(Boolean)
    .join('\n');

// Reduce step: fold the per-window summaries into the final description.
export const buildDescriptionReducePrompt = (
  meta: VideoDescriptionMeta,
  windowSummaries: string[],
): string =>
  [
    ...formatMeta(meta),
    `Section summaries (in chronological order):\n${windowSummaries
      .map((s, i) => `${i + 1}. ${s}`)
      .join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');
