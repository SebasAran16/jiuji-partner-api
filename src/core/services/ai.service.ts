import { Injectable } from '@nestjs/common';
import { LlmService } from './llm.service';
import { VectorStoreService } from './vector-store.service';
import type { RagChatResult } from '../../../const';

const DEFAULT_RESULT_LIMIT = 5;

@Injectable()
export class AiService {
  constructor(
    private readonly llmService: LlmService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  async chat(
    question: string,
    limit = DEFAULT_RESULT_LIMIT,
  ): Promise<RagChatResult> {
    const queryVector = await this.llmService.embedQuery(question);
    const sources = await this.vectorStoreService.search(queryVector, limit);

    if (!sources.length) {
      return {
        answer: 'No videos in the library match this question yet.',
        sources: [],
      };
    }

    const answer = await this.llmService.chatWithContext(question, sources);
    return { answer, sources };
  }
}
