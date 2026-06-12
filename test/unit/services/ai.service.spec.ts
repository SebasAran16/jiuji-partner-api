import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from '../../../src/core/services/ai.service';
import { LlmService } from '../../../src/core/services/llm.service';
import { VectorStoreService } from '../../../src/core/services/vector-store.service';

const mockSource = (overrides: Record<string, any> = {}) => ({
  videoId: 'video-1',
  title: 'Armbar from Closed Guard',
  startTime: 30,
  endTime: 60,
  text: 'Narration: control the wrist before swinging the leg over',
  score: 0.92,
  ...overrides,
});

describe('AiService', () => {
  let service: AiService;
  let llmService: jest.Mocked<LlmService>;
  let vectorStoreService: jest.Mocked<VectorStoreService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: LlmService,
          useValue: {
            embedQuery: jest.fn(),
            chatWithContext: jest.fn(),
          },
        },
        {
          provide: VectorStoreService,
          useValue: {
            search: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AiService);
    llmService = module.get(LlmService);
    vectorStoreService = module.get(VectorStoreService);
  });

  it('embeds the question, searches, and answers with context', async () => {
    const vector = [0.1, 0.2];
    const sources = [mockSource()];
    llmService.embedQuery.mockResolvedValue(vector);
    vectorStoreService.search.mockResolvedValue(sources);
    llmService.chatWithContext.mockResolvedValue(
      'Control the wrist first [1].',
    );

    const result = await service.chat('how do I finish the armbar?');

    expect(llmService.embedQuery).toHaveBeenCalledWith(
      'how do I finish the armbar?',
    );
    expect(vectorStoreService.search).toHaveBeenCalledWith(vector, 5);
    expect(llmService.chatWithContext).toHaveBeenCalledWith(
      'how do I finish the armbar?',
      sources,
    );
    expect(result).toEqual({ answer: 'Control the wrist first [1].', sources });
  });

  it('passes a custom result limit through to the search', async () => {
    llmService.embedQuery.mockResolvedValue([0.1]);
    vectorStoreService.search.mockResolvedValue([mockSource()]);
    llmService.chatWithContext.mockResolvedValue('answer');

    await service.chat('question', 10);

    expect(vectorStoreService.search).toHaveBeenCalledWith([0.1], 10);
  });

  it('returns an empty-library answer without calling the chat model', async () => {
    llmService.embedQuery.mockResolvedValue([0.1]);
    vectorStoreService.search.mockResolvedValue([]);

    const result = await service.chat('anything');

    expect(llmService.chatWithContext).not.toHaveBeenCalled();
    expect(result.sources).toEqual([]);
    expect(result.answer).toContain('No videos');
  });
});
