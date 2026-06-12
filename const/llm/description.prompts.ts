import type { VideoDescriptionMeta } from '../ai.types';

export const DESCRIPTION_SYSTEM_PROMPT =
  'You are a Brazilian Jiu-Jitsu analyst. Write a 2-3 sentence factual description of a training video for a video library. No marketing tone, no speculation beyond the evidence given.';

export const buildDescriptionUserPrompt = (
  meta: VideoDescriptionMeta,
): string =>
  [
    `Title: ${meta.title}`,
    meta.tags.length ? `Tags: ${meta.tags.join(', ')}` : '',
    meta.competitor ? `Competitor: ${meta.competitor}` : '',
    meta.competition ? `Competition: ${meta.competition}` : '',
    meta.captions.length
      ? `What the frames show:\n${meta.captions.join('\n')}`
      : '',
    meta.transcriptExcerpt
      ? `Transcript excerpt:\n${meta.transcriptExcerpt}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
