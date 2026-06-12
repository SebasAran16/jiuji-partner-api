import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn(() => 'hashed'),
  compare: jest.fn(),
}));

import { AuthService } from '../../../src/core/services/auth.service';
import { UserRepository } from '../../../src/core/repository/user.repository';
import { MailService } from '../../../src/core/services/mail.service';

const mockUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  email: 'test@test.com',
  passwordHash: '$2b$12$...',
  firstName: null,
  lastName: null,
  belt: 'WHITE',
  stripes: 0,
  age: null,
  weight: null,
  bjjAcademy: null,
  timeTraining: null,
  trainingsPerWeek: null,
  objective: null,
  intensity: null,
  isVerified: false,
  verificationToken: 'token-123',
  verificationTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  avatarUrl: null,
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let mailService: jest.Mocked<MailService>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            findByVerificationToken: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(() => 'test-token') },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => 'test-value') },
        },
        {
          provide: MailService,
          useValue: { sendVerificationEmail: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepository = module.get(UserRepository);
    jwtService = module.get(JwtService);
    mailService = module.get(MailService);
  });

  describe('register', () => {
    it('creates a user with hashed password and returns accessToken', async () => {
      userRepository.findByEmail.mockResolvedValue(null);
      userRepository.create.mockResolvedValue(mockUser());

      const result = await service.register('test@test.com', 'Secure@123');

      expect(userRepository.findByEmail).toHaveBeenCalledWith('test@test.com');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@test.com',
          passwordHash: 'hashed',
          verificationToken: expect.any(String),
          verificationTokenExpiresAt: expect.any(Date),
        }),
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.com',
        expect.any(String),
      );
      expect(result).toEqual({ accessToken: 'test-token' });
    });

    it('throws ConflictException when email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser());

      await expect(service.register('test@test.com', 'password123')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('returns accessToken when credentials are valid', async () => {
      const user = mockUser({ isVerified: true });
      userRepository.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@test.com', 'password123');

      expect(result).toEqual({ accessToken: 'test-token' });
    });

    it('throws UnauthorizedException when email is not verified', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser());

      await expect(service.login('test@test.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      const user = mockUser({ isVerified: true });
      userRepository.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('test@test.com', 'wrongpass')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when email does not exist', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login('unknown@test.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('verifies user and clears verification fields', async () => {
      const user = mockUser();
      userRepository.findByVerificationToken.mockResolvedValue(user);

      await service.verifyEmail('token-123');

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiresAt: null,
      });
    });

    it('throws BadRequestException when token is invalid', async () => {
      userRepository.findByVerificationToken.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when token is expired', async () => {
      const user = mockUser({
        verificationTokenExpiresAt: new Date(Date.now() - 1000),
      });
      userRepository.findByVerificationToken.mockResolvedValue(user);

      await expect(service.verifyEmail('token-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerification', () => {
    it('updates verification token and sends email', async () => {
      const user = mockUser();
      userRepository.findByEmail.mockResolvedValue(user);

      await service.resendVerification('test@test.com');

      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        verificationToken: expect.any(String),
        verificationTokenExpiresAt: expect.any(Date),
      });
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        'test@test.com',
        expect.any(String),
      );
    });

    it('throws BadRequestException when email has no account', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(service.resendVerification('unknown@test.com')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when already verified', async () => {
      const user = mockUser({ isVerified: true });
      userRepository.findByEmail.mockResolvedValue(user);

      await expect(service.resendVerification('test@test.com')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeOnboarding', () => {
    const onboardingDto = {
      firstName: 'John',
      lastName: 'Doe',
      age: 28,
      belt: 'BLUE',
      stripes: 2,
      bjjAcademy: 'Gracie',
      timeTraining: 24,
      trainingsPerWeek: 4,
      objective: 'COMPETITION',
      intensity: 'HIGH',
      weight: 80,
    };

    it('updates user with all onboarding fields', async () => {
      const user = mockUser();
      userRepository.findById.mockResolvedValue(user);
      userRepository.update.mockResolvedValue(mockUser());

      await service.completeOnboarding('user-1', onboardingDto);

      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        firstName: 'John',
        lastName: 'Doe',
        age: 28,
        belt: 'BLUE',
        stripes: 2,
        bjjAcademy: 'Gracie',
        timeTraining: 24,
        trainingsPerWeek: 4,
        objective: 'COMPETITION',
        intensity: 'HIGH',
        weight: 80,
      });
    });

    it('throws BadRequestException when user is not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.completeOnboarding('unknown', onboardingDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getProfile', () => {
    it('returns user without sensitive fields', async () => {
      const user = mockUser({
        firstName: 'John',
        lastName: 'Doe',
      });
      userRepository.findById.mockResolvedValue(user);

      const profile = await service.getProfile('user-1');

      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('verificationToken');
      expect(profile).not.toHaveProperty('verificationTokenExpiresAt');
      expect(profile).toHaveProperty('firstName', 'John');
      expect(profile).toHaveProperty('email', 'test@test.com');
    });

    it('throws UnauthorizedException when user is not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.getProfile('unknown')).rejects.toThrow(UnauthorizedException);
    });
  });
});
