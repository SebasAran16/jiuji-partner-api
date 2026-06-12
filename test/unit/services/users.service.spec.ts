import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../../../src/core/services/users.service';
import { UserRepository } from '../../../src/core/repository/user.repository';

const mockUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  email: 'test@test.com',
  passwordHash: '$2b$12$...',
  firstName: 'John',
  lastName: 'Doe',
  belt: 'BLUE',
  stripes: 2,
  age: 28,
  weight: 80,
  bjjAcademy: 'Gracie',
  timeTraining: 24,
  trainingsPerWeek: 4,
  objective: 'COMPETITION',
  intensity: 'HIGH',
  isVerified: true,
  verificationToken: null,
  verificationTokenExpiresAt: null,
  avatarUrl: null,
  role: 'USER',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    userRepository = module.get(UserRepository);
  });

  describe('getProfile', () => {
    it('returns user without sensitive fields', async () => {
      const user = mockUser();
      userRepository.findById.mockResolvedValue(user);

      const profile = await service.getProfile('user-1');

      expect(userRepository.findById).toHaveBeenCalledWith('user-1');
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('verificationToken');
      expect(profile).not.toHaveProperty('verificationTokenExpiresAt');
      expect(profile).toHaveProperty('id', 'user-1');
      expect(profile).toHaveProperty('email', 'test@test.com');
    });

    it('throws NotFoundException when user is not found', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(service.getProfile('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates user and returns sanitized profile', async () => {
      const updatedUser = mockUser({ firstName: 'Jane' });
      userRepository.update.mockResolvedValue(updatedUser);

      const profile = await service.updateProfile('user-1', { firstName: 'Jane' });

      expect(userRepository.update).toHaveBeenCalledWith('user-1', { firstName: 'Jane' });
      expect(profile).not.toHaveProperty('passwordHash');
      expect(profile).not.toHaveProperty('verificationToken');
      expect(profile).not.toHaveProperty('verificationTokenExpiresAt');
      expect(profile).toHaveProperty('firstName', 'Jane');
    });
  });
});
