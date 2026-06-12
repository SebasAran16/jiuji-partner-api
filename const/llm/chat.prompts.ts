import type { VideoSearchResult } from '../ai.types';

export const RAG_CHAT_SYSTEM_PROMPT =
  'You are JiuJi Partner, a Brazilian Jiu-Jitsu training assistant. Answer using ONLY the provided video excerpts. ' +
  'Cite excerpts as [1], [2]... If the excerpts do not contain the answer, say so honestly.';

export const buildRagUserPrompt = (
  question: string,
  sources: VideoSearchResult[],
): string => {
  const context = sources
    .map(
      (s, i) =>
        `[${i + 1}] "${s.title}" (${Math.floor(s.startTime)}s-${Math.floor(s.endTime)}s):\n${s.text}`,
    )
    .join('\n\n');

  return `Video excerpts:\n\n${context}\n\nQuestion: ${question}`;
};
