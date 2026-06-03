import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { UsersController } from '../../../src/core/http/controller/users.controller';
import { UsersService } from '../../../src/core/services/users.service';
import { JwtAuthGuard } from '../../../src/core/http/guards/jwt-auth.guard';
import { UpdateUserDto } from '../../../src/core/http/request/users/index';

describe('UsersController', () => {
  let app: INestApplication;
  const mockUsersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
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
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /users/me', () => {
    it('should return the user profile', async () => {
      const profile = {
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      mockUsersService.getProfile.mockResolvedValue(profile);

      const res = await request(app.getHttpServer())
        .get('/users/me')
        .expect(200);

      expect(res.body).toEqual(profile);
      expect(mockUsersService.getProfile).toHaveBeenCalledWith('user-1');
    });
  });

  describe('PATCH /users/me', () => {
    it('should update and return the user profile', async () => {
      const dto: UpdateUserDto = { firstName: 'Jane' };
      const updated = {
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'Jane',
        lastName: 'Doe',
      };
      mockUsersService.updateProfile.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/users/me')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual(updated);
      expect(mockUsersService.updateProfile).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });
});
