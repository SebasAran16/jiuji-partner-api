import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TrainingSessionsService } from '../../../src/core/services/training-sessions.service';
import { TrainingSessionRepository } from '../../../src/core/repository/training-session.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TrainingSessionEntity } from '../../../src/core/entities/training-session.entity';
import { CreateTrainingSessionDto } from '../../../src/core/http/request/training-sessions/create-training-session.dto';

describe('TrainingSessionsService', () => {
  let service: TrainingSessionsService;
  let repository: jest.Mocked<TrainingSessionRepository>;
  let prisma: jest.Mocked<PrismaService>;

  const mockTx = {
    trainingSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockPrisma = {
    $transaction: jest.fn((cb: (tx: typeof mockTx) => any) => cb(mockTx)),
    trainingSession: mockTx.trainingSession,
  } as any;

  const mockSessionData = {
    id: 'session-1',
    userId: 'user-1',
    date: new Date('2024-01-15'),
    durationMinutes: 90,
    intensityFeeling: 7,
    notes: 'Good session',
    movements: [
      {
        id: 'sm-1',
        trainingSessionId: 'session-1',
        movementId: 'movement-1',
        timeSpentMinutes: 10,
        notes: 'Worked on details',
        movement: { id: 'movement-1', name: 'Armbar', slug: 'armbar', category: 'SUBMISSION', type: 'SUBMISSION', minBelt: 'WHITE', gi: true, description: null, createdAt: new Date(), updatedAt: new Date() },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingSessionsService,
        {
          provide: TrainingSessionRepository,
          useValue: {
            findByUserIdPaginated: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get(TrainingSessionsService);
    repository = module.get(TrainingSessionRepository);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('creates a session with movements via transaction and returns entity', async () => {
      mockTx.trainingSession.create.mockResolvedValue(mockSessionData);

      const dto: CreateTrainingSessionDto = {
        durationMinutes: 90,
        intensityFeeling: 7,
        notes: 'Good session',
        movements: [
          { movementId: 'movement-1', timeSpentMinutes: 10, notes: 'Worked on details' },
        ],
      } as CreateTrainingSessionDto;

      const result = await service.create('user-1', dto);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.trainingSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            durationMinutes: 90,
            intensityFeeling: 7,
            notes: 'Good session',
            date: expect.any(Date),
            movements: {
              create: [
                { movementId: 'movement-1', timeSpentMinutes: 10, notes: 'Worked on details' },
              ],
            },
          }),
          include: {
            movements: {
              include: { movement: true },
            },
          },
        }),
      );
      expect(result).toBeInstanceOf(TrainingSessionEntity);
      expect(result.id).toBe('session-1');
    });

    it('creates a session without movements', async () => {
      mockTx.trainingSession.create.mockResolvedValue({
        ...mockSessionData,
        movements: [],
      });

      const dto: CreateTrainingSessionDto = {
        durationMinutes: 60,
        intensityFeeling: 5,
        notes: null,
        movements: [],
      } as CreateTrainingSessionDto;

      const result = await service.create('user-1', dto);

      expect(mockTx.trainingSession.create).toHaveBeenCalled();
      expect(result).toBeInstanceOf(TrainingSessionEntity);
    });
  });

  describe('findAll', () => {
    it('delegates to repository and returns paginated result', async () => {
      const paginatedResult = {
        data: [new TrainingSessionEntity(mockSessionData)],
        total: 1,
        page: 1,
        perPage: 10,
        totalPages: 1,
      };
      repository.findByUserIdPaginated.mockResolvedValue(paginatedResult);

      const result = await service.findAll('user-1', 1, 10);

      expect(repository.findByUserIdPaginated).toHaveBeenCalledWith('user-1', 1, 10);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findById', () => {
    it('returns entity when session exists', async () => {
      mockTx.trainingSession.findFirst.mockResolvedValue(mockSessionData);

      const result = await service.findById('user-1', 'session-1');

      expect(prisma.trainingSession.findFirst).toHaveBeenCalledWith({
        where: { id: 'session-1', userId: 'user-1' },
        include: {
          movements: {
            include: { movement: true },
          },
        },
      });
      expect(result).toBeInstanceOf(TrainingSessionEntity);
      expect(result.id).toBe('session-1');
    });

    it('throws NotFoundException when session does not exist', async () => {
      mockTx.trainingSession.findFirst.mockResolvedValue(null);

      await expect(service.findById('user-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
