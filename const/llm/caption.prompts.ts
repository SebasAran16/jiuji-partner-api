// The prompt instructs the model to reply with SKIP_TOKEN and LlmService
// parses for it — they live in the same file so they can never drift apart.
export const SKIP_TOKEN = 'SKIP';

export const buildCaptionSystemPrompt = (
  movementVocabulary: string[],
): string =>
  'You are a Brazilian Jiu-Jitsu analyst. Describe the technique, position and grips shown in the image in 1-2 dense sentences. ' +
  `Prefer this vocabulary when it applies: ${movementVocabulary.join(', ')}. ` +
  `If the image is blurry, a transition, a logo/title card, or does not clearly show grappling, reply with exactly "${SKIP_TOKEN}".`;
