import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from '../../../src/core/repository/user.repository.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

const mockUser = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
};

const mockPrismaService = {
  user: mockUser,
} as any;

describe('UserRepository', () => {
  let repository: UserRepository;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    repository = module.get<UserRepository>(UserRepository);
  });

  describe('findByEmail', () => {
    it('should call findUnique with correct where', async () => {
      const user = { id: '1', email: 'test@example.com', firstName: 'Test' };
      mockUser.findUnique.mockResolvedValue(user);

      const result = await repository.findByEmail('test@example.com');

      expect(mockUser.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(expect.objectContaining(user));
    });

    it('should return null when email not found', async () => {
      mockUser.findUnique.mockResolvedValue(null);

      const result = await repository.findByEmail('missing@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByVerificationToken', () => {
    it('should call findFirst with correct where', async () => {
      const user = {
        id: '1',
        email: 'test@example.com',
        verificationToken: 'abc123',
      };
      mockUser.findFirst.mockResolvedValue(user);

      const result = await repository.findByVerificationToken('abc123');

      expect(mockUser.findFirst).toHaveBeenCalledWith({
        where: { verificationToken: 'abc123' },
      });
      expect(result).toEqual(expect.objectContaining(user));
    });

    it('should return null when token not found', async () => {
      mockUser.findFirst.mockResolvedValue(null);

      const result = await repository.findByVerificationToken('invalid-token');

      expect(result).toBeNull();
    });
  });
});
