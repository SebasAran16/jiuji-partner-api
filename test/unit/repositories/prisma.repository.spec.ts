import { PrismaRepository } from '../../../src/core/repository/prisma.repository.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';

class TestEntity {
  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
  }
}

class TestRepository extends PrismaRepository<any, any, any> {
  protected readonly model = 'testModel' as const;
  constructor(prisma: PrismaService) {
    super(prisma, TestEntity);
  }
}

const mockModel = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  findMany: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
};

const mockPrismaService = {
  testModel: mockModel,
} as any;

describe('PrismaRepository', () => {
  let repository: TestRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TestRepository(mockPrismaService);
  });

  describe('findUnique', () => {
    it('should return entity when found', async () => {
      const data = { id: '1', name: 'test' };
      mockModel.findUnique.mockResolvedValue(data);

      const result = await repository.findUnique({ where: { id: '1' } });

      expect(mockModel.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(data));
    });

    it('should return null when not found', async () => {
      mockModel.findUnique.mockResolvedValue(null);

      const result = await repository.findUnique({ where: { id: 'missing' } });

      expect(result).toBeNull();
    });
  });

  describe('findFirst', () => {
    it('should work with args', async () => {
      const data = { id: '1', name: 'first' };
      mockModel.findFirst.mockResolvedValue(data);

      const result = await repository.findFirst({ where: { name: 'first' } });

      expect(mockModel.findFirst).toHaveBeenCalledWith({ where: { name: 'first' } });
      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(data));
    });
  });

  describe('findMany', () => {
    it('should return list of entities', async () => {
      const data = [
        { id: '1', name: 'a' },
        { id: '2', name: 'b' },
      ];
      mockModel.findMany.mockResolvedValue(data);

      const result = await repository.findMany();

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(TestEntity);
      expect(result[1]).toBeInstanceOf(TestEntity);
    });

    it('should handle empty list', async () => {
      mockModel.findMany.mockResolvedValue([]);

      const result = await repository.findMany();

      expect(result).toEqual([]);
    });
  });

  describe('findManyPaginated', () => {
    const allItems = Array.from({ length: 25 }, (_, i) => ({ id: String(i + 1), name: `item-${i + 1}` }));

    it('should return correct pagination shape for page 1', async () => {
      const page1 = allItems.slice(0, 10);
      mockModel.findMany.mockResolvedValue(page1);
      mockModel.count.mockResolvedValue(25);

      const result = await repository.findManyPaginated({ page: 1, perPage: 10 });

      expect(mockModel.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 10,
        where: undefined,
        orderBy: undefined,
        include: undefined,
      });
      expect(mockModel.count).toHaveBeenCalledWith({ where: undefined });
      expect(result).toEqual({
        data: page1.map((d) => expect.objectContaining(d)),
        total: 25,
        page: 1,
        perPage: 10,
        totalPages: 3,
      });
      expect(result.data[0]).toBeInstanceOf(TestEntity);
    });

    it('should return correct pagination shape for page 2', async () => {
      const page2 = allItems.slice(10, 20);
      mockModel.findMany.mockResolvedValue(page2);
      mockModel.count.mockResolvedValue(25);

      const result = await repository.findManyPaginated({ page: 2, perPage: 10 });

      expect(mockModel.findMany).toHaveBeenCalledWith({
        skip: 10,
        take: 10,
        where: undefined,
        orderBy: undefined,
        include: undefined,
      });
      expect(result.page).toBe(2);
      expect(result.data).toHaveLength(10);
      expect(result.totalPages).toBe(3);
    });

    it('should return correct pagination shape for last page', async () => {
      const page3 = allItems.slice(20, 25);
      mockModel.findMany.mockResolvedValue(page3);
      mockModel.count.mockResolvedValue(25);

      const result = await repository.findManyPaginated({ page: 3, perPage: 10 });

      expect(result.page).toBe(3);
      expect(result.data).toHaveLength(5);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('create', () => {
    it('should pass data and return entity', async () => {
      const input = { name: 'new-item' };
      const created = { id: '1', ...input };
      mockModel.create.mockResolvedValue(created);

      const result = await repository.create(input);

      expect(mockModel.create).toHaveBeenCalledWith({ data: input });
      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(created));
    });
  });

  describe('update', () => {
    it('should pass id and data', async () => {
      const data = { name: 'updated' };
      const updated = { id: '1', ...data };
      mockModel.update.mockResolvedValue(updated);

      const result = await repository.update('1', data);

      expect(mockModel.update).toHaveBeenCalledWith({ where: { id: '1' }, data });
      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(updated));
    });
  });

  describe('delete', () => {
    it('should pass id', async () => {
      const deleted = { id: '1', name: 'deleted' };
      mockModel.delete.mockResolvedValue(deleted);

      const result = await repository.delete('1');

      expect(mockModel.delete).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(deleted));
    });
  });

  describe('count', () => {
    it('should return number', async () => {
      mockModel.count.mockResolvedValue(42);

      const result = await repository.count();

      expect(result).toBe(42);
    });
  });

  describe('exists', () => {
    it('should return true when count > 0', async () => {
      mockModel.count.mockResolvedValue(1);

      const result = await repository.exists({ name: 'test' });

      expect(mockModel.count).toHaveBeenCalledWith({ where: { name: 'test' } });
      expect(result).toBe(true);
    });

    it('should return false when count is 0', async () => {
      mockModel.count.mockResolvedValue(0);

      const result = await repository.exists({ name: 'nonexistent' });

      expect(result).toBe(false);
    });
  });

  describe('findById', () => {
    it('should call findUnique with id', async () => {
      const data = { id: '42', name: 'by-id' };
      mockModel.findUnique.mockResolvedValue(data);

      const result = await repository.findById('42');

      expect(mockModel.findUnique).toHaveBeenCalledWith({ where: { id: '42' } });
      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(data));
    });
  });

  describe('findOne', () => {
    it('should call findFirst with where', async () => {
      const data = { id: '1', name: 'single' };
      mockModel.findFirst.mockResolvedValue(data);

      const result = await repository.findOne({ name: 'single' });

      expect(mockModel.findFirst).toHaveBeenCalledWith({ where: { name: 'single' } });
      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(data));
    });
  });

  describe('toEntity / toEntityList', () => {
    it('should transform single result via findUnique', async () => {
      const raw = { id: '1', name: 'transform' };
      mockModel.findUnique.mockResolvedValue(raw);

      const result = await repository.findUnique({ where: { id: '1' } });

      expect(result).toBeInstanceOf(TestEntity);
      expect(result).toEqual(expect.objectContaining(raw));
    });

    it('should transform list via findMany', async () => {
      const raw = [{ id: '1', name: 'a' }, { id: '2', name: 'b' }];
      mockModel.findMany.mockResolvedValue(raw);

      const results = await repository.findMany();

      results.forEach((r) => expect(r).toBeInstanceOf(TestEntity));
    });

    it('should return raw data when entityClass is not provided', async () => {
      class NoEntityRepo extends PrismaRepository<any, any, any> {
        protected readonly model = 'testModel' as const;
        constructor(prisma: PrismaService) {
          super(prisma);
        }
      }
      const raw = { id: '1', name: 'raw' };
      mockModel.findUnique.mockResolvedValue(raw);

      const repo = new NoEntityRepo(mockPrismaService);
      const result = await repo.findUnique({ where: { id: '1' } });

      expect(result).toEqual(raw);
      expect(result).not.toBeInstanceOf(TestEntity);
    });
  });

  describe('createMany', () => {
    it('should return { count }', async () => {
      const items = [{ name: 'a' }, { name: 'b' }];
      mockModel.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.createMany(items);

      expect(mockModel.createMany).toHaveBeenCalledWith({ data: items });
      expect(result).toEqual({ count: 2 });
    });
  });
});
