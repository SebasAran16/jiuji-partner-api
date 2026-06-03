import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from '../../../src/core/http/controller/auth.controller';
import { AuthService } from '../../../src/core/services/auth.service';
import { JwtAuthGuard } from '../../../src/core/http/guards/jwt-auth.guard';
import { RegisterDto, LoginDto } from '../../../src/core/http/request/auth/index';

describe('AuthController', () => {
  let app: INestApplication;
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    completeOnboarding: jest.fn(),
    verifyEmail: jest.fn(),
    resendVerification: jest.fn(),
    getProfile: jest.fn(),
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
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
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

  describe('POST /auth/register', () => {
    it('should register a user and return an access token', async () => {
      const dto: RegisterDto = { email: 'test@test.com', password: 'password123' };
      mockAuthService.register.mockResolvedValue({ accessToken: 'token-123' });

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dto)
        .expect(201);

      expect(res.body).toEqual({ accessToken: 'token-123' });
      expect(mockAuthService.register).toHaveBeenCalledWith(
        'test@test.com',
        'password123',
      );
    });

    it('should return 409 when email is already in use', async () => {
      const dto: RegisterDto = { email: 'existing@test.com', password: 'password123' };
      mockAuthService.register.mockRejectedValue(
        new ConflictException('Email already in use'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(dto)
        .expect(409);

      expect(res.body.message).toBe('Email already in use');
    });
  });

  describe('POST /auth/login', () => {
    it('should login and return an access token', async () => {
      const dto: LoginDto = { email: 'test@test.com', password: 'password123' };
      mockAuthService.login.mockResolvedValue({ accessToken: 'token-123' });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(dto)
        .expect(200);

      expect(res.body).toEqual({ accessToken: 'token-123' });
      expect(mockAuthService.login).toHaveBeenCalledWith(
        'test@test.com',
        'password123',
      );
    });

    it('should return 401 on invalid credentials', async () => {
      const dto: LoginDto = { email: 'test@test.com', password: 'wrong' };
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Invalid email or password'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send(dto)
        .expect(401);

      expect(res.body.message).toBe('Invalid email or password');
    });
  });

  describe('PUT /auth/onboarding', () => {
    it('should complete onboarding and return 200', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        age: 25,
        belt: 'WHITE',
        stripes: 0,
        bjjAcademy: 'Gracie Barra',
        timeTraining: 12,
        trainingsPerWeek: 3,
        objective: 'COMPETITION',
        intensity: 'MODERATE',
      };
      mockAuthService.completeOnboarding.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .put('/auth/onboarding')
        .send(dto)
        .expect(200);

      expect(mockAuthService.completeOnboarding).toHaveBeenCalledWith(
        'user-1',
        dto,
      );
    });
  });

  describe('POST /auth/verify-email', () => {
    it('should verify email', async () => {
      mockAuthService.verifyEmail.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: 'valid-token' })
        .expect(200);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid-token');
    });

    it('should return 400 on invalid token', async () => {
      mockAuthService.verifyEmail.mockRejectedValue(
        new BadRequestException('Invalid or expired verification token'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/verify-email')
        .send({ token: 'invalid' })
        .expect(400);

      expect(res.body.message).toBe('Invalid or expired verification token');
    });
  });

  describe('POST /auth/resend-verification', () => {
    it('should resend verification email', async () => {
      mockAuthService.resendVerification.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'test@test.com' })
        .expect(200);

      expect(mockAuthService.resendVerification).toHaveBeenCalledWith(
        'test@test.com',
      );
    });

    it('should return 400 on failure', async () => {
      mockAuthService.resendVerification.mockRejectedValue(
        new BadRequestException('No account found with this email'),
      );

      const res = await request(app.getHttpServer())
        .post('/auth/resend-verification')
        .send({ email: 'unknown@test.com' })
        .expect(400);

      expect(res.body.message).toBe('No account found with this email');
    });
  });

  describe('GET /auth/me', () => {
    it('should return the user profile', async () => {
      const profile = {
        id: 'user-1',
        email: 'test@test.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      mockAuthService.getProfile.mockResolvedValue(profile);

      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .expect(200);

      expect(res.body).toEqual(profile);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1');
    });
  });
});
