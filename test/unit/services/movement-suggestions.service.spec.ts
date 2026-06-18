import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MovementSuggestionsService } from '../../../src/core/services/movement-suggestions.service';
import { MovementSuggestionRepository } from '../../../src/core/repository/movement-suggestion.repository';
import { MovementRepository } from '../../../src/core/repository/movement.repository';
import { VideoMovementRepository } from '../../../src/core/repository/video-movement.repository';
import { MovementsService } from '../../../src/core/services/movements.service';

const mockSuggestion = (overrides: Record<string, any> = {}) => ({
  id: 'sug-1',
  name: 'Berimbolo',
  normalizedName: 'berimbolo',
  description: 'Inverted back-take from de la Riva.',
  category: null,
  type: null,
  gi: null,
  confidence: 0.8,
  videoId: 'video-1',
  timestampStart: 120,
  timestampEnd: 150,
  evidence: 'Inverted back-take from de la Riva.',
  status: 'PENDING',
  reviewedAt: null,
  createdMovementId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const detection = (overrides: Record<string, any> = {}) => ({
  name: 'Berimbolo',
  description: 'Inverted back-take from de la Riva.',
  startTime: 120,
  endTime: 150,
  confidence: 0.8,
  ...overrides,
});

describe('MovementSuggestionsService', () => {
  let service: MovementSuggestionsService;
  let suggestionRepository: jest.Mocked<MovementSuggestionRepository>;
  let movementRepository: jest.Mocked<MovementRepository>;
  let videoMovementRepository: jest.Mocked<VideoMovementRepository>;
  let movementsService: jest.Mocked<MovementsService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementSuggestionsService,
        {
          provide: MovementSuggestionRepository,
          useValue: {
            findByNormalizedName: jest.fn(),
            findById: jest.fn(),
            findManyPaginated: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: MovementRepository,
          useValue: { create: jest.fn(), findBySlug: jest.fn() },
        },
        {
          provide: VideoMovementRepository,
          useValue: { createForVideo: jest.fn() },
        },
        {
          provide: MovementsService,
          useValue: { indexMovement: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(MovementSuggestionsService);
    suggestionRepository = module.get(MovementSuggestionRepository);
    movementRepository = module.get(MovementRepository);
    videoMovementRepository = module.get(VideoMovementRepository);
    movementsService = module.get(MovementsService);
  });

  describe('recordDetection', () => {
    it('creates a PENDING suggestion for a new technique', async () => {
      suggestionRepository.findByNormalizedName.mockResolvedValue(null);
      suggestionRepository.create.mockResolvedValue(mockSuggestion());

      const result = await service.recordDetection('video-1', detection());

      expect(suggestionRepository.findByNormalizedName).toHaveBeenCalledWith(
        'berimbolo',
      );
      expect(suggestionRepository.create).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('normalizes punctuation and case for the dedupe key', async () => {
      suggestionRepository.findByNormalizedName.mockResolvedValue(null);
      suggestionRepository.create.mockResolvedValue(mockSuggestion());

      await service.recordDetection(
        'video-1',
        detection({ name: '  Beri-Bolo!! ' }),
      );

      expect(suggestionRepository.findByNormalizedName).toHaveBeenCalledWith(
        'beri bolo',
      );
    });

    it('skips when a suggestion with the same name exists in ANY status', async () => {
      suggestionRepository.findByNormalizedName.mockResolvedValue(
        mockSuggestion({ status: 'DECLINED' }),
      );

      const result = await service.recordDetection('video-1', detection());

      expect(result).toBeNull();
      expect(suggestionRepository.create).not.toHaveBeenCalled();
    });

    it('treats a unique-constraint race as a benign duplicate', async () => {
      suggestionRepository.findByNormalizedName.mockResolvedValue(null);
      suggestionRepository.create.mockRejectedValue({ code: 'P2002' });

      const result = await service.recordDetection('video-1', detection());

      expect(result).toBeNull();
    });
  });

  describe('approve', () => {
    beforeEach(() => {
      suggestionRepository.findById.mockResolvedValue(mockSuggestion());
      movementRepository.findBySlug.mockResolvedValue(null);
      movementRepository.create.mockResolvedValue({
        id: 'mov-new',
        name: 'Berimbolo',
        slug: 'berimbolo',
        description: 'Inverted back-take from de la Riva.',
      } as any);
    });

    it('creates the movement with admin edits winning over the AI proposal', async () => {
      await service.approve('sug-1', {
        name: 'Berimbolo (DLR entry)',
        description: 'Admin description.',
        category: 'SWEEP',
        type: 'TRANSITION',
        minBelt: 'BLUE' as any,
        gi: true,
      });

      expect(movementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Berimbolo (DLR entry)',
          description: 'Admin description.',
          category: 'SWEEP',
          minBelt: 'BLUE',
        }),
      );
    });

    it('falls back to AI-proposed fields when admin leaves them empty', async () => {
      await service.approve('sug-1', { category: 'SWEEP', type: 'TRANSITION' });

      expect(movementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Berimbolo',
          description: 'Inverted back-take from de la Riva.',
          minBelt: 'WHITE',
        }),
      );
    });

    it('links the evidence video and indexes the new movement', async () => {
      await service.approve('sug-1', { category: 'SWEEP', type: 'TRANSITION' });

      expect(videoMovementRepository.createForVideo).toHaveBeenCalledWith(
        'video-1',
        [
          expect.objectContaining({
            movementId: 'mov-new',
            timestampStart: 120,
            timestampEnd: 150,
          }),
        ],
      );
      expect(movementsService.indexMovement).toHaveBeenCalled();
      expect(suggestionRepository.update).toHaveBeenCalledWith(
        'sug-1',
        expect.objectContaining({
          status: 'APPROVED',
          createdMovementId: 'mov-new',
        }),
      );
    });

    it('deduplicates the slug when it already exists', async () => {
      movementRepository.findBySlug
        .mockResolvedValueOnce({ id: 'existing' } as any)
        .mockResolvedValueOnce(null);

      await service.approve('sug-1', { category: 'SWEEP', type: 'TRANSITION' });

      expect(movementRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'berimbolo-2' }),
      );
    });

    it('rejects approving an already-reviewed suggestion', async () => {
      suggestionRepository.findById.mockResolvedValue(
        mockSuggestion({ status: 'DECLINED' }),
      );

      await expect(
        service.approve('sug-1', { category: 'SWEEP', type: 'TRANSITION' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws for an unknown suggestion id', async () => {
      suggestionRepository.findById.mockResolvedValue(null);

      await expect(
        service.approve('missing', { category: 'SWEEP', type: 'TRANSITION' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('decline', () => {
    it('marks a pending suggestion DECLINED with review timestamp', async () => {
      suggestionRepository.findById.mockResolvedValue(mockSuggestion());
      suggestionRepository.update.mockResolvedValue(
        mockSuggestion({ status: 'DECLINED' }),
      );

      await service.decline('sug-1');

      expect(suggestionRepository.update).toHaveBeenCalledWith(
        'sug-1',
        expect.objectContaining({ status: 'DECLINED' }),
      );
    });

    it('rejects declining an already-reviewed suggestion', async () => {
      suggestionRepository.findById.mockResolvedValue(
        mockSuggestion({ status: 'APPROVED' }),
      );

      await expect(service.decline('sug-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
