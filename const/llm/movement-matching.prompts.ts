import type { FrameCaption, TranscriptSegment } from '../ai.types';

// Forces JSON output (paired with the model's JSON mode). `known` names must
// come from the provided catalog verbatim; everything else goes to `unknown`,
// which feeds MovementSuggestion review — never directly into the catalog.
export const MOVEMENT_MATCHING_SYSTEM_PROMPT =
  'You are a Brazilian Jiu-Jitsu analyst. You receive timestamped frame captions and narration from one training video, plus the catalog of known movement names. ' +
  'Identify which techniques appear in the video. Respond with ONLY a JSON object of this exact shape: ' +
  '{"known": [{"name": "<exact catalog name>", "startTime": <seconds>, "endTime": <seconds>, "confidence": <0-1>}], ' +
  '"unknown": [{"name": "<concise technique name>", "description": "<1-2 sentence description>", "startTime": <seconds>, "endTime": <seconds>, "confidence": <0-1>}]}. ' +
  'Rules: "known" entries MUST use a name from the catalog verbatim. Only report "unknown" techniques you are confident are real, distinct techniques clearly shown or explained — not positions mentioned in passing, not variations of a catalog entry. Empty arrays are valid.';

export const buildMovementMatchingUserPrompt = (
  catalog: string[],
  captions: FrameCaption[],
  transcript: TranscriptSegment[],
): string =>
  [
    catalog.length
      ? `Movement catalog:\n${catalog.join(', ')}`
      : 'Movement catalog: (empty — the catalog is still being built, so every real technique you identify is "unknown")',
    captions.length
      ? `Frame captions:\n${captions.map((c) => `[${Math.round(c.timestamp)}s] ${c.caption}`).join('\n')}`
      : '',
    transcript.length
      ? `Narration:\n${transcript.map((t) => `[${Math.round(t.start)}s-${Math.round(t.end)}s] ${t.text}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
