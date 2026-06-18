import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type {
  FrameCaption,
  MatchedMovement,
  MovementMatchResult,
  TranscriptSegment,
  UnknownTechnique,
  VideoDescriptionMeta,
  VideoSearchResult,
} from '../../../const';
import {
  SKIP_TOKEN,
  buildCaptionSystemPrompt,
  DESCRIPTION_SYSTEM_PROMPT,
  DESCRIPTION_CHUNK_SYSTEM_PROMPT,
  buildDescriptionUserPrompt,
  buildDescriptionChunkPrompt,
  buildDescriptionReducePrompt,
  RAG_CHAT_SYSTEM_PROMPT,
  buildRagUserPrompt,
  MOVEMENT_MATCHING_SYSTEM_PROMPT,
  buildMovementMatchingUserPrompt,
} from '../../../const';

// LlmService is the ONLY gateway to LLM inference: the rest of the app never
// imports a provider SDK. 'ollama' is the local/dev provider (containers exist
// to avoid API spend while testing); production will use a managed provider
// (TBD) selected via AI_PROVIDER — implement it here, nothing else changes.
// System prompts live in const/llm/.
const SUPPORTED_AI_PROVIDERS = ['ollama'] as const;

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly chatModel: ChatOllama;
  private readonly visionModel: ChatOllama;
  private readonly jsonModel: ChatOllama;
  private readonly embeddings: OllamaEmbeddings;
  // Token budget for one matching/description prompt, and the time-overlap
  // between adjacent chunks so a technique spanning a boundary isn't lost.
  private readonly chunkTokens: number;
  private readonly chunkOverlapSeconds: number;

  constructor(private readonly configService: ConfigService) {
    const provider = this.configService.get<string>('AI_PROVIDER', 'ollama');
    if (!SUPPORTED_AI_PROVIDERS.includes(provider as any)) {
      throw new Error(
        `AI_PROVIDER '${provider}' is not implemented. Supported: ${SUPPORTED_AI_PROVIDERS.join(', ')}. ` +
          'Add the provider to LlmService before deploying with this configuration.',
      );
    }

    const baseUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434',
    );
    const chatModelName = this.configService.get<string>(
      'OLLAMA_CHAT_MODEL',
      'gemma3:4b',
    );
    const embedModelName = this.configService.get<string>(
      'OLLAMA_EMBED_MODEL',
      'nomic-embed-text',
    );
    // Ollama defaults num_ctx to 2048 — far too small. A single video's worth
    // of captions + transcript runs ~10k+ tokens, so at the default the model
    // silently sees a truncated fragment and produces empty/garbage output
    // (matching, description, RAG chat all degrade). Size the window to fit a
    // full instructional video. Kept identical across all three handles so
    // Ollama doesn't reload the model with a different context between calls.
    // NOTE: a single call still can't exceed this; very long videos need the
    // chunked-matching follow-up.
    const numCtx = Number(
      this.configService.get<string>('OLLAMA_NUM_CTX', '16384'),
    );
    // Length-independent processing: captions + transcript are split into
    // time-windows whose prompt stays under this budget (well below num_ctx,
    // leaving room for the system prompt + JSON output), matched per window and
    // merged. A short video produces a single window — identical to before.
    this.chunkTokens = Number(
      this.configService.get<string>('MATCH_CHUNK_TOKENS', '6000'),
    );
    this.chunkOverlapSeconds = Number(
      this.configService.get<string>('MATCH_CHUNK_OVERLAP_SECONDS', '30'),
    );

    this.chatModel = new ChatOllama({
      baseUrl,
      model: chatModelName,
      temperature: 0.2,
      numCtx,
    });
    // Same model today, but vision is a separate handle so it can diverge via env later
    this.visionModel = new ChatOllama({
      baseUrl,
      model: chatModelName,
      temperature: 0.1,
      numCtx,
    });
    // JSON mode constrains generation to valid JSON — required for structured
    // tasks with small models, which otherwise wrap output in prose/markdown
    this.jsonModel = new ChatOllama({
      baseUrl,
      model: chatModelName,
      temperature: 0,
      format: 'json',
      numCtx,
    });
    this.embeddings = new OllamaEmbeddings({ baseUrl, model: embedModelName });
  }

  // nomic-embed-text is trained with task prefixes; mismatched or missing
  // prefixes measurably degrade retrieval quality
  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(
      texts.map((t) => `search_document: ${t}`),
    );
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(`search_query: ${text}`);
  }

  async captionFrame(
    imageBase64: string,
    movementVocabulary: string[],
  ): Promise<string | null> {
    const response = await this.visionModel.invoke([
      new SystemMessage(buildCaptionSystemPrompt(movementVocabulary)),
      new HumanMessage({
        content: [
          {
            type: 'image_url',
            image_url: `data:image/jpeg;base64,${imageBase64}`,
          },
        ],
      }),
    ]);

    const caption = (response.content as string).trim();
    if (!caption || caption.toUpperCase().startsWith(SKIP_TOKEN)) {
      return null;
    }
    return caption;
  }

  // Short video → one prompt. Long video → map-reduce: summarize each
  // time-window, then fold those summaries into the final description. Either
  // way the evidence in any single prompt stays under the context window.
  async generateVideoDescription(
    meta: VideoDescriptionMeta,
    captions: FrameCaption[],
    transcript: TranscriptSegment[],
  ): Promise<string> {
    const chunks = this.chunkEvidence(captions, transcript);

    if (chunks.length <= 1) {
      const response = await this.chatModel.invoke([
        new SystemMessage(DESCRIPTION_SYSTEM_PROMPT),
        new HumanMessage(buildDescriptionUserPrompt(meta, captions, transcript)),
      ]);
      return (response.content as string).trim();
    }

    // Map: one factual sentence per window
    const summaries: string[] = [];
    for (const chunk of chunks) {
      const response = await this.chatModel.invoke([
        new SystemMessage(DESCRIPTION_CHUNK_SYSTEM_PROMPT),
        new HumanMessage(
          buildDescriptionChunkPrompt(
            chunk.captions,
            chunk.transcript,
            chunk.start,
            chunk.end,
          ),
        ),
      ]);
      const summary = (response.content as string).trim();
      if (summary) summaries.push(summary);
    }

    // Reduce: fold the window summaries into the final description
    const response = await this.chatModel.invoke([
      new SystemMessage(DESCRIPTION_SYSTEM_PROMPT),
      new HumanMessage(buildDescriptionReducePrompt(meta, summaries)),
    ]);
    return (response.content as string).trim();
  }

  // Locate catalog techniques in the video (→ VideoMovement links) and surface
  // non-catalog techniques (→ MovementSuggestion review). The evidence is split
  // into context-sized time-windows, matched per window, then merged — so a
  // video of any length is processed without overflowing the model's context.
  async matchMovements(
    catalog: string[],
    captions: FrameCaption[],
    transcript: TranscriptSegment[],
  ): Promise<MovementMatchResult> {
    // Only evidence is required. An empty catalog is the normal early state
    // (the catalog is grown from imports), and must NOT skip matching — with no
    // vocabulary, `known` stays empty and every real technique is surfaced as
    // an `unknown` suggestion, which is exactly the discovery we want.
    if (!captions.length && !transcript.length) {
      return { known: [], unknown: [] };
    }

    const chunks = this.chunkEvidence(captions, transcript);
    if (chunks.length <= 1) {
      return this.matchMovementsChunk(catalog, captions, transcript);
    }

    this.logger.log(
      `Matching: evidence split into ${chunks.length} chunks (~${this.chunkTokens} token budget, ${this.chunkOverlapSeconds}s overlap)`,
    );
    const perChunk: MovementMatchResult[] = [];
    for (const [i, chunk] of chunks.entries()) {
      this.logger.log(
        `Matching chunk ${i + 1}/${chunks.length} [${Math.round(chunk.start)}-${Math.round(chunk.end)}s]`,
      );
      perChunk.push(
        await this.matchMovementsChunk(
          catalog,
          chunk.captions,
          chunk.transcript,
        ),
      );
    }
    return this.mergeMatchResults(perChunk);
  }

  // One matching call over a single window of evidence. JSON mode + hard
  // validation: anything malformed from the model is dropped, never written.
  private async matchMovementsChunk(
    catalog: string[],
    captions: FrameCaption[],
    transcript: TranscriptSegment[],
  ): Promise<MovementMatchResult> {
    const userPrompt = buildMovementMatchingUserPrompt(
      catalog,
      captions,
      transcript,
    );
    this.logger.log(
      `Matching input: catalog=${catalog.length} captions=${captions.length} transcript=${transcript.length} promptChars=${userPrompt.length} (~${Math.round(userPrompt.length / 4)} tokens)`,
    );
    const response = await this.jsonModel.invoke([
      new SystemMessage(MOVEMENT_MATCHING_SYSTEM_PROMPT),
      new HumanMessage(userPrompt),
    ]);

    const raw = (response.content as string) ?? '';
    try {
      const parsed = JSON.parse(this.extractJsonObject(raw));
      const catalogSet = new Set(catalog.map((n) => n.toLowerCase()));

      const known = (Array.isArray(parsed.known) ? parsed.known : [])
        .filter(
          (m: any) =>
            typeof m?.name === 'string' &&
            catalogSet.has(m.name.toLowerCase()) &&
            Number.isFinite(m.startTime) &&
            Number.isFinite(m.endTime),
        )
        .map((m: any) => ({
          name: m.name,
          startTime: Math.max(0, m.startTime),
          endTime: Math.max(m.startTime, m.endTime),
          confidence: this.clampConfidence(m.confidence),
        }));

      const unknown = (Array.isArray(parsed.unknown) ? parsed.unknown : [])
        .filter(
          (m: any) =>
            typeof m?.name === 'string' &&
            m.name.trim().length > 2 &&
            // A "new" technique whose name is already in the catalog is a
            // model mistake, not a discovery
            !catalogSet.has(m.name.toLowerCase()) &&
            Number.isFinite(m.startTime) &&
            Number.isFinite(m.endTime),
        )
        .map((m: any) => ({
          name: m.name.trim(),
          description: typeof m.description === 'string' ? m.description : '',
          startTime: Math.max(0, m.startTime),
          endTime: Math.max(m.startTime, m.endTime),
          confidence: this.clampConfidence(m.confidence),
        }));

      this.logger.log(
        `Matching output: rawLen=${raw.length} known=${known.length} unknown=${unknown.length}`,
      );
      return { known, unknown };
    } catch (err) {
      // Log a sample of the raw output so a recurrence is diagnosable instead
      // of silently yielding zero techniques. Empty/garbage here almost always
      // means the prompt overflowed num_ctx (raise OLLAMA_NUM_CTX).
      this.logger.warn(
        `Movement matching returned unparseable JSON: ${err}. Raw (first 200): ${raw.slice(0, 200)}`,
      );
      return { known: [], unknown: [] };
    }
  }

  // Small models sometimes wrap JSON in prose or ```json fences despite JSON
  // mode. Take the substring spanning the outermost braces before parsing.
  private extractJsonObject(raw: string): string {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    return start !== -1 && end > start ? raw.slice(start, end + 1) : raw;
  }

  private clampConfidence(value: unknown): number {
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value as number)) : 0.5;
  }

  // Split captions + transcript into context-sized time-windows. Evidence is
  // walked in time order and packed by an estimated char budget (≈ chars/4
  // tokens, conservative) until the next unit would overflow, then a window is
  // closed. Each window is widened backward by the overlap so a technique that
  // straddles a boundary is seen in both windows (the merge dedupes the
  // resulting double-detections). A short video yields a single window, leaving
  // the existing single-call path untouched.
  private chunkEvidence(
    captions: FrameCaption[],
    transcript: TranscriptSegment[],
  ): {
    captions: FrameCaption[];
    transcript: TranscriptSegment[];
    start: number;
    end: number;
  }[] {
    const budgetChars = this.chunkTokens * 4;
    // Per-unit char cost mirrors how the prompt formats each line (text + the
    // "[12s] " / "[12s-15s] " timestamp prefix).
    const units = [
      ...captions.map((c) => ({
        time: c.timestamp,
        cost: c.caption.length + 8,
      })),
      ...transcript.map((t) => ({ time: t.start, cost: t.text.length + 14 })),
    ].sort((a, b) => a.time - b.time);

    const maxTime = Math.max(
      0,
      ...captions.map((c) => c.timestamp),
      ...transcript.map((t) => t.end),
    );

    // Greedy time boundaries: [start, end) windows covering the whole timeline.
    const boundaries: [number, number][] = [];
    let windowStart = units.length ? units[0].time : 0;
    let acc = 0;
    for (const u of units) {
      if (acc > 0 && acc + u.cost > budgetChars) {
        boundaries.push([windowStart, u.time]);
        windowStart = u.time;
        acc = 0;
      }
      acc += u.cost;
    }
    boundaries.push([windowStart, maxTime + 1]);

    return boundaries
      .map(([start, end]) => {
        // Overlap: pull the tail of the previous window into this one's head
        const from = Math.max(0, start - this.chunkOverlapSeconds);
        return {
          start,
          end,
          captions: captions.filter(
            (c) => c.timestamp >= from && c.timestamp < end,
          ),
          transcript: transcript.filter((t) => t.start < end && t.end > from),
        };
      })
      .filter((w) => w.captions.length || w.transcript.length);
  }

  // Combine per-window results into one. `known` and `unknown` are deduped
  // independently so a technique surfaced in overlapping windows collapses to a
  // single entry instead of producing duplicate links/suggestions.
  private mergeMatchResults(
    results: MovementMatchResult[],
  ): MovementMatchResult {
    return {
      known: this.mergeKnown(results.flatMap((r) => r.known)),
      unknown: this.mergeUnknown(results.flatMap((r) => r.unknown)),
    };
  }

  // Group by catalog name. Occurrences close in time (within the overlap) are
  // the same detection seen twice → merged into one widened range; occurrences
  // far apart (a technique taught, then revisited later) stay distinct, since
  // VideoMovement supports multiple links per movement.
  private mergeKnown(items: MatchedMovement[]): MatchedMovement[] {
    const byName = new Map<string, MatchedMovement[]>();
    for (const m of items) {
      const key = m.name.toLowerCase();
      const group = byName.get(key);
      if (group) group.push(m);
      else byName.set(key, [m]);
    }

    const merged: MatchedMovement[] = [];
    for (const group of byName.values()) {
      group.sort((a, b) => a.startTime - b.startTime);
      let current: MatchedMovement | null = null;
      for (const m of group) {
        if (
          current &&
          m.startTime <= current.endTime + this.chunkOverlapSeconds
        ) {
          current.endTime = Math.max(current.endTime, m.endTime);
          current.confidence = Math.max(current.confidence, m.confidence);
        } else {
          if (current) merged.push(current);
          current = { ...m };
        }
      }
      if (current) merged.push(current);
    }
    return merged;
  }

  // One suggestion per technique name. The widest time range is kept, and the
  // description/confidence from the most confident occurrence wins. (The
  // suggestion service then dedupes again across videos.)
  private mergeUnknown(items: UnknownTechnique[]): UnknownTechnique[] {
    const byName = new Map<string, UnknownTechnique>();
    for (const m of items) {
      const key = m.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, { ...m });
        continue;
      }
      existing.startTime = Math.min(existing.startTime, m.startTime);
      existing.endTime = Math.max(existing.endTime, m.endTime);
      if (m.confidence > existing.confidence) {
        existing.confidence = m.confidence;
        if (m.description) existing.description = m.description;
      } else if (!existing.description) {
        existing.description = m.description;
      }
    }
    return [...byName.values()];
  }

  async chatWithContext(
    question: string,
    sources: VideoSearchResult[],
  ): Promise<string> {
    const response = await this.chatModel.invoke([
      new SystemMessage(RAG_CHAT_SYSTEM_PROMPT),
      new HumanMessage(buildRagUserPrompt(question, sources)),
    ]);
    return (response.content as string).trim();
  }
}
