import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOllama, OllamaEmbeddings } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { VideoDescriptionMeta, VideoSearchResult } from '../../../const';
import {
  SKIP_TOKEN,
  buildCaptionSystemPrompt,
  DESCRIPTION_SYSTEM_PROMPT,
  buildDescriptionUserPrompt,
  RAG_CHAT_SYSTEM_PROMPT,
  buildRagUserPrompt,
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
  private readonly embeddings: OllamaEmbeddings;

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

    this.chatModel = new ChatOllama({
      baseUrl,
      model: chatModelName,
      temperature: 0.2,
    });
    // Same model today, but vision is a separate handle so it can diverge via env later
    this.visionModel = new ChatOllama({
      baseUrl,
      model: chatModelName,
      temperature: 0.1,
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

  async generateVideoDescription(meta: VideoDescriptionMeta): Promise<string> {
    const response = await this.chatModel.invoke([
      new SystemMessage(DESCRIPTION_SYSTEM_PROMPT),
      new HumanMessage(buildDescriptionUserPrompt(meta)),
    ]);
    return (response.content as string).trim();
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
