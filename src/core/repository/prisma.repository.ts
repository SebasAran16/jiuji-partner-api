import type { PaginatedQuery, PaginatedResult } from '../../../const';
import { PrismaService } from '../../prisma/prisma.service';

export type EntityClass<T> = new (data: Partial<T>) => T;

export abstract class PrismaRepository<T, CreateInput, UpdateInput> {
  protected abstract readonly model: keyof PrismaService;
  private readonly entityClass?: EntityClass<T>;

  constructor(
    protected readonly prisma: PrismaService,
    entityClass?: EntityClass<T>,
  ) {
    this.entityClass = entityClass;
  }

  private get raw() {
    return this.prisma[this.model] as any;
  }

  private toEntity(data: any): T {
    if (!this.entityClass || data === null || data === undefined) return data;
    return new this.entityClass(data);
  }

  private toEntityList(data: any[]): T[] {
    if (!this.entityClass) return data;
    return data.map((item) => new this.entityClass!(item));
  }

  async findUnique(args: Record<string, any>): Promise<T | null> {
    const result = await this.raw.findUnique(args);
    return this.toEntity(result);
  }

  async findUniqueOrThrow(args: Record<string, any>): Promise<T> {
    const result = await this.raw.findUniqueOrThrow(args);
    return this.toEntity(result);
  }

  async findFirst(args?: Record<string, any>): Promise<T | null> {
    const result = await this.raw.findFirst(args);
    return this.toEntity(result);
  }

  async findFirstOrThrow(args?: Record<string, any>): Promise<T> {
    const result = await this.raw.findFirstOrThrow(args);
    return this.toEntity(result);
  }

  async findMany(args?: Record<string, any>): Promise<T[]> {
    const results = await this.raw.findMany(args);
    return this.toEntityList(results);
  }

  async findById(id: string | number): Promise<T | null> {
    return this.findUnique({ where: { id } });
  }

  async findOne(where: Partial<T>): Promise<T | null> {
    return this.findFirst({ where });
  }

  async findAll(): Promise<T[]> {
    return this.findMany();
  }

  async create(data: CreateInput): Promise<T> {
    const result = await this.raw.create({ data });
    return this.toEntity(result);
  }

  async createMany(data: CreateInput[]): Promise<{ count: number }> {
    return this.raw.createMany({ data });
  }

  async update(id: string, data: UpdateInput): Promise<T> {
    const result = await this.raw.update({ where: { id }, data });
    return this.toEntity(result);
  }

  async updateWhere(where: Record<string, any>, data: UpdateInput): Promise<T> {
    const result = await this.raw.update({ where, data });
    return this.toEntity(result);
  }

  async delete(id: string): Promise<T> {
    const result = await this.raw.delete({ where: { id } });
    return this.toEntity(result);
  }

  async count(args?: Record<string, any>): Promise<number> {
    return this.raw.count(args);
  }

  async findManyPaginated(params: PaginatedQuery & {
    where?: Record<string, any>;
    orderBy?: Record<string, any>;
    include?: Record<string, any>;
  }): Promise<PaginatedResult<T>> {
    const page = params.page || 1;
    const perPage = params.perPage || 10;
    const skip = (page - 1) * perPage;
    const [data, total] = await Promise.all([
      this.raw.findMany({
        skip,
        take: perPage,
        where: params.where,
        orderBy: params.orderBy,
        include: params.include,
      }),
      this.raw.count({ where: params.where }),
    ]);
    return {
      data: this.toEntityList(data),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  }

  async exists(where: Record<string, any>): Promise<boolean> {
    const count = await this.raw.count({ where });
    return count > 0;
  }
}
