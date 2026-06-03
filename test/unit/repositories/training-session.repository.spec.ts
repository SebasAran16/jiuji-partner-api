import { Test, TestingModule } from '@nestjs/testing';
import { TrainingSessionRepository } from '../../../src/core/repository/training-session.repository.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const mockTrainingSession = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};

const mockPrismaService = {
  trainingSession: mockTrainingSession,
} as any;

describe('TrainingSessionRepository', () => {
  let repository: TrainingSessionRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingSessionRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<TrainingSessionRepository>(TrainingSessionRepository);
  });

  describe('findByUserIdPaginated', () => {
    it('should call findManyPaginated with userId, date desc, and movements.movement include', async () => {
      const sessions = [
        {
          id: '1',
          userId: 'user-1',
          date: new Date('2024-03-01'),
          durationMinutes: 60,
          movements: [],
        },
        {
          id: '2',
          userId: 'user-1',
          date: new Date('2024-02-28'),
          durationMinutes: 45,
          movements: [],
        },
      ];
      mockTrainingSession.findMany.mockResolvedValue(sessions);
      mockTrainingSession.count.mockResolvedValue(2);

      const result = await repository.findByUserIdPaginated('user-1', 1, 10);

      expect(mockTrainingSession.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: { userId: 'user-1' },
        orderBy: { date: 'desc' },
        include: {
          movements: {
            include: { movement: true },
          },
        },
      });
      expect(mockTrainingSession.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('should handle empty page (no sessions)', async () => {
      mockTrainingSession.findMany.mockResolvedValue([]);
      mockTrainingSession.count.mockResolvedValue(0);

      const result = await repository.findByUserIdPaginated('user-1', 1, 10);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.perPage).toBe(10);
      expect(result.totalPages).toBe(0);
    });
  });
});
