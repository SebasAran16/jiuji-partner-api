import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MovementsService } from '../../../src/core/services/movements.service';
import { MovementRepository } from '../../../src/core/repository/movement.repository';

const mockMovement = (overrides: Record<string, any> = {}) => ({
  id: 'movement-1',
  name: 'Armbar',
  slug: 'armbar',
  category: 'SUBMISSION',
  type: 'SUBMISSION',
  minBelt: 'WHITE',
  gi: true,
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('MovementsService', () => {
  let service: MovementsService;
  let movementRepository: jest.Mocked<MovementRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MovementsService,
        {
          provide: MovementRepository,
          useValue: {
            findFiltered: jest.fn(),
            findBySlug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(MovementsService);
    movementRepository = module.get(MovementRepository);
  });

  describe('findAll', () => {
    it('calls findFiltered with belt filter', async () => {
      movementRepository.findFiltered.mockResolvedValue([mockMovement()]);

      const result = await service.findAll({ belt: 'BLUE' });

      expect(movementRepository.findFiltered).toHaveBeenCalledWith({ belt: 'BLUE' });
      expect(result).toHaveLength(1);
    });

    it('calls findFiltered with belt and category filters', async () => {
      movementRepository.findFiltered.mockResolvedValue([]);

      await service.findAll({ belt: 'WHITE', category: 'ESCAPE' });

      expect(movementRepository.findFiltered).toHaveBeenCalledWith({
        belt: 'WHITE',
        category: 'ESCAPE',
      });
    });

    it('calls findFiltered with gi filter', async () => {
      movementRepository.findFiltered.mockResolvedValue([]);

      await service.findAll({ gi: true });

      expect(movementRepository.findFiltered).toHaveBeenCalledWith({ gi: true });
    });
  });

  describe('findBySlug', () => {
    it('returns movement when found', async () => {
      const movement = mockMovement();
      movementRepository.findBySlug.mockResolvedValue(movement);

      const result = await service.findBySlug('armbar');

      expect(movementRepository.findBySlug).toHaveBeenCalledWith('armbar');
      expect(result).toEqual(movement);
    });

    it('throws NotFoundException when not found', async () => {
      movementRepository.findBySlug.mockResolvedValue(null);

      await expect(service.findBySlug('unknown')).rejects.toThrow(NotFoundException);
    });
  });
});
