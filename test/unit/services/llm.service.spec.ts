import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../../../src/core/services/llm.service';

const mockInvoke = jest.fn();

jest.mock('@langchain/ollama', () => ({
  ChatOllama: jest.fn().mockImplementation(() => ({ invoke: mockInvoke })),
  OllamaEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn(),
    embedQuery: jest.fn(),
  })),
}));

describe('LlmService.matchMovements', () => {
  let service: LlmService;

  const captions = [{ timestamp: 5, caption: 'knee slice guard pass' }] as any;
  const transcript = [
    { start: 0, end: 10, text: 'Now we slice the knee through to pass.' },
  ] as any;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        // get(key, default) → return the default so the constructor picks ollama
        { provide: ConfigService, useValue: { get: (_k: string, d: any) => d } },
      ],
    }).compile();
    service = module.get(LlmService);
  });

  // Regression: an empty catalog is the normal early state now that movements
  // are grown from imports. Matching MUST still run so techniques are surfaced
  // as suggestions — the old `!catalog.length` short-circuit silently skipped it.
  it('still invokes the model and surfaces unknowns when the catalog is empty', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        known: [],
        unknown: [
          {
            name: 'Knee Slice Pass',
            description: 'Slicing the knee across to pass the guard.',
            startTime: 5,
            endTime: 10,
            confidence: 0.8,
          },
        ],
      }),
    });

    const result = await service.matchMovements([], captions, transcript);

    expect(mockInvoke).toHaveBeenCalled();
    expect(result.known).toHaveLength(0);
    expect(result.unknown).toHaveLength(1);
    expect(result.unknown[0].name).toBe('Knee Slice Pass');
  });

  it('short-circuits (no model call) only when there is no evidence', async () => {
    const result = await service.matchMovements([], [], []);

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result).toEqual({ known: [], unknown: [] });
  });

  it('recovers JSON wrapped in markdown fences / prose', async () => {
    mockInvoke.mockResolvedValue({
      content:
        'Here is the result:\n```json\n{"known": [], "unknown": [' +
        '{"name": "Stack Pass", "description": "d", "startTime": 1, "endTime": 4, "confidence": 0.9}]}\n```',
    });

    const result = await service.matchMovements([], captions, transcript);

    expect(result.unknown).toHaveLength(1);
    expect(result.unknown[0].name).toBe('Stack Pass');
  });

  it('rejects an "unknown" whose name collides with a catalog entry', async () => {
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({
        known: [],
        unknown: [
          {
            name: 'Armbar',
            description: 'dup of catalog',
            startTime: 1,
            endTime: 2,
            confidence: 0.9,
          },
        ],
      }),
    });

    const result = await service.matchMovements(['Armbar'], captions, transcript);

    expect(result.unknown).toHaveLength(0);
  });
});

// Length-independence: when the evidence exceeds the per-prompt token budget it
// is split into time-windows, matched per window, and merged. A small budget
// forces the split so we can exercise it on tiny fixtures.
describe('LlmService chunked matching + description', () => {
  const buildService = async (
    config: Record<string, string> = {},
  ): Promise<LlmService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmService,
        {
          provide: ConfigService,
          useValue: { get: (k: string, d: any) => config[k] ?? d },
        },
      ],
    }).compile();
    return module.get(LlmService);
  };

  // Two captions ~100s apart; tiny budget + no overlap → one window each
  const farApartCaptions = [
    { timestamp: 0, caption: 'side control' },
    { timestamp: 100, caption: 'closed guard' },
  ] as any;
  const smallBudget = {
    MATCH_CHUNK_TOKENS: '5',
    MATCH_CHUNK_OVERLAP_SECONDS: '0',
  };

  beforeEach(() => jest.clearAllMocks());

  it('matches each window and merges results across chunks', async () => {
    const service = await buildService(smallBudget);
    mockInvoke
      .mockResolvedValueOnce({
        content: JSON.stringify({
          known: [{ name: 'Armbar', startTime: 0, endTime: 5, confidence: 0.9 }],
          unknown: [
            {
              name: 'Foo Lock',
              description: 'first window',
              startTime: 0,
              endTime: 5,
              confidence: 0.7,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        content: JSON.stringify({
          known: [
            { name: 'Armbar', startTime: 100, endTime: 105, confidence: 0.8 },
          ],
          unknown: [
            {
              name: 'Foo Lock',
              description: 'second window',
              startTime: 100,
              endTime: 105,
              confidence: 0.6,
            },
          ],
        }),
      });

    const result = await service.matchMovements(
      ['Armbar'],
      farApartCaptions,
      [],
    );

    // one model call per window
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    // same technique seen ~100s apart stays as two distinct occurrences
    expect(result.known).toHaveLength(2);
    // the same unknown across windows collapses to one suggestion, widest range,
    // most-confident description kept
    expect(result.unknown).toHaveLength(1);
    expect(result.unknown[0]).toMatchObject({
      name: 'Foo Lock',
      description: 'first window',
      startTime: 0,
      endTime: 105,
      confidence: 0.7,
    });
  });

  it('map-reduces the description over windows for long videos', async () => {
    const service = await buildService(smallBudget);
    mockInvoke
      .mockResolvedValueOnce({ content: 'Window one summary.' })
      .mockResolvedValueOnce({ content: 'Window two summary.' })
      .mockResolvedValueOnce({ content: 'Final folded description.' });

    const result = await service.generateVideoDescription(
      { title: 'Guard Passing', tags: [] },
      farApartCaptions,
      [],
    );

    // two map calls (one per window) + one reduce call
    expect(mockInvoke).toHaveBeenCalledTimes(3);
    expect(result).toBe('Final folded description.');
  });

  it('uses a single call when the evidence fits the budget', async () => {
    const service = await buildService(); // default 6000-token budget
    mockInvoke.mockResolvedValue({
      content: JSON.stringify({ known: [], unknown: [] }),
    });

    await service.matchMovements(['Armbar'], farApartCaptions, []);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
