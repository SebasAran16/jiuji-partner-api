import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TrainingSessionsController } from '../../../src/core/http/controller/training-sessions.controller';
import { TrainingSessionsService } from '../../../src/core/services/training-sessions.service';
import { JwtAuthGuard } from '../../../src/core/http/guards/jwt-auth.guard';

describe('TrainingSessionsController', () => {
  let app: INestApplication;
  const mockTrainingSessionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  const mockJwtAuthGuard = {
    canActivate: jest.fn((context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { id: 'user-1', email: 'test@test.com' };
      return true;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrainingSessionsController],
      providers: [
        { provide: TrainingSessionsService, useValue: mockTrainingSessionsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /training-sessions', () => {
    it('should create a training session', async () => {
      const dto = {
        durationMinutes: 90,
        intensityFeeling: 7,
        notes: 'Good session',
      };
      const session = {
        id: 'session-1',
        userId: 'user-1',
        durationMinutes: 90,
        intensityFeeling: 7,
        notes: 'Good session',
      };
      mockTrainingSessionsService.create.mockResolvedValue(session);

      const res = await request(app.getHttpServer())
        .post('/training-sessions')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual(session);
      expect(mockTrainingSessionsService.create).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  describe('GET /training-sessions', () => {
    it('should return paginated training sessions with defaults', async () => {
      const result = { data: [], total: 0, page: 1, perPage: 10 };
      mockTrainingSessionsService.findAll.mockResolvedValue(result);

      const res = await request(app.getHttpServer())
        .get('/training-sessions')
        .expect(200);

      expect(res.body).toEqual(result);
      expect(mockTrainingSessionsService.findAll).toHaveBeenCalledWith(
        'user-1',
        1,
        10,
      );
    });

    it('should pass page and perPage query params', async () => {
      const result = { data: [], total: 0, page: 2, perPage: 5 };
      mockTrainingSessionsService.findAll.mockResolvedValue(result);

      await request(app.getHttpServer())
        .get('/training-sessions')
        .query({ page: '2', perPage: '5' })
        .expect(200);

      expect(mockTrainingSessionsService.findAll).toHaveBeenCalledWith(
        'user-1',
        2,
        5,
      );
    });
  });

  describe('GET /training-sessions/:id', () => {
    it('should return a single training session', async () => {
      const session = {
        id: 'session-1',
        userId: 'user-1',
        durationMinutes: 90,
      };
      mockTrainingSessionsService.findById.mockResolvedValue(session);

      const res = await request(app.getHttpServer())
        .get('/training-sessions/session-1')
        .expect(200);

      expect(res.body).toEqual(session);
      expect(mockTrainingSessionsService.findById).toHaveBeenCalledWith(
        'user-1',
        'session-1',
      );
    });

    it('should return 404 when session is not found', async () => {
      mockTrainingSessionsService.findById.mockRejectedValue(
        new NotFoundException('Training session not found'),
      );

      const res = await request(app.getHttpServer())
        .get('/training-sessions/nonexistent')
        .expect(404);

      expect(res.body.message).toBe('Training session not found');
    });
  });
});
