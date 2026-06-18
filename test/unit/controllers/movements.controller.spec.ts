import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { MovementsController } from '../../../src/core/http/controller/movements.controller';
import { MovementsService } from '../../../src/core/services/movements.service';
import { JwtAuthGuard } from '../../../src/core/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/core/http/guards/roles.guard';

describe('MovementsController', () => {
  let app: INestApplication;
  const mockMovementsService = {
    findAll: jest.fn(),
    findBySlug: jest.fn(),
    findSimilar: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MovementsController],
      providers: [
        { provide: MovementsService, useValue: mockMovementsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /movements', () => {
    it('should return all movements', async () => {
      const movements = [
        { id: '1', name: 'Armbar', slug: 'armbar' },
        { id: '2', name: 'Triangle', slug: 'triangle' },
      ];
      mockMovementsService.findAll.mockResolvedValue(movements);

      const res = await request(app.getHttpServer())
        .get('/movements')
        .expect(200);

      expect(res.body).toEqual(movements);
      expect(mockMovementsService.findAll).toHaveBeenCalledWith({});
    });

    it('should pass query params to the service', async () => {
      const movements = [
        { id: '1', name: 'Armbar', slug: 'armbar', belt: 'BLUE' },
      ];
      mockMovementsService.findAll.mockResolvedValue(movements);

      await request(app.getHttpServer())
        .get('/movements')
        .query({ belt: 'BLUE', category: 'submission', gi: 'true' })
        .expect(200);

      expect(mockMovementsService.findAll).toHaveBeenCalledWith({
        belt: 'BLUE',
        category: 'submission',
        gi: 'true',
      });
    });
  });

  describe('GET /movements/similar', () => {
    it('should return semantically similar movements (not captured by :slug)', async () => {
      const similar = [
        { movementId: '1', name: 'Armbar', description: null, score: 0.91 },
      ];
      mockMovementsService.findSimilar.mockResolvedValue(similar);

      const res = await request(app.getHttpServer())
        .get('/movements/similar')
        .query({ name: 'Juji Gatame' })
        .expect(200);

      expect(res.body).toEqual(similar);
      expect(mockMovementsService.findSimilar).toHaveBeenCalledWith(
        'Juji Gatame',
        undefined,
      );
      expect(mockMovementsService.findBySlug).not.toHaveBeenCalled();
    });
  });

  describe('GET /movements/:slug', () => {
    it('should return a movement by slug', async () => {
      const movement = { id: '1', name: 'Armbar', slug: 'armbar' };
      mockMovementsService.findBySlug.mockResolvedValue(movement);

      const res = await request(app.getHttpServer())
        .get('/movements/armbar')
        .expect(200);

      expect(res.body).toEqual(movement);
      expect(mockMovementsService.findBySlug).toHaveBeenCalledWith('armbar');
    });

    it('should return 404 when movement is not found', async () => {
      mockMovementsService.findBySlug.mockRejectedValue(
        new NotFoundException("Movement 'nonexistent' not found"),
      );

      const res = await request(app.getHttpServer())
        .get('/movements/nonexistent')
        .expect(404);

      expect(res.body.message).toBe("Movement 'nonexistent' not found");
    });
  });
});
