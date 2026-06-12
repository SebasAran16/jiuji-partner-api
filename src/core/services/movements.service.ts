import { Injectable, NotFoundException } from '@nestjs/common';
import type { MovementFilter } from '../../../const';
import { MovementRepository } from '../repository/movement.repository';

@Injectable()
export class MovementsService {
  constructor(private readonly movementRepository: MovementRepository) {}

  async findAll(params: MovementFilter) {
    return this.movementRepository.findFiltered(params);
  }

  async findBySlug(slug: string) {
    const movement = await this.movementRepository.findBySlug(slug);
    if (!movement) {
      throw new NotFoundException(`Movement '${slug}' not found`);
    }
    return movement;
  }
}
