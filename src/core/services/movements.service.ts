import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import type { MovementFilter, SimilarMovement } from '../../../const';
import { MovementRepository } from '../repository/movement.repository';
import { LlmService } from './llm.service';
import { VectorStoreService } from './vector-store.service';

interface MovementLike {
  id: string;
  name: string;
  description: string | null;
}

@Injectable()
export class MovementsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MovementsService.name)

  constructor(
    private readonly movementRepository: MovementRepository,
    private readonly llmService: LlmService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  // Keep the 'movements' Qdrant collection in sync with the catalog so
  // similarity lookups work. Count check skips the work on hot reloads.
  async onApplicationBootstrap() {
    try {
      const movements = await this.movementRepository.findFiltered({});
      if (!movements.length) return;

      const indexed = await this.vectorStoreService.countMovements();
      if (indexed === movements.length) return;

      const vectors = await this.llmService.embedDocuments(
        movements.map((m) => this.embeddingText(m)),
      );
      for (let i = 0; i < movements.length; i++) {
        await this.vectorStoreService.upsertMovement(
          movements[i].id,
          vectors[i],
          { name: movements[i].name, description: movements[i].description },
        );
      }
      this.logger.log(`Synced ${movements.length} movements to Qdrant`);
    } catch (err) {
      this.logger.warn(`Movement catalog vector sync failed: ${err}`);
    }
  }

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

  // Called when a new movement enters the catalog (e.g. suggestion approval)
  async indexMovement(movement: MovementLike) {
    const [vector] = await this.llmService.embedDocuments([
      this.embeddingText(movement),
    ]);
    await this.vectorStoreService.upsertMovement(movement.id, vector, {
      name: movement.name,
      description: movement.description,
    });
  }

  async findSimilar(
    name: string,
    description?: string,
  ): Promise<SimilarMovement[]> {
    const vector = await this.llmService.embedQuery(
      description ? `${name}. ${description}` : name,
    );
    return this.vectorStoreService.searchMovements(vector, 5);
  }

  private embeddingText(movement: { name: string; description: string | null }): string {
    return movement.description
      ? `${movement.name}. ${movement.description}`
      : movement.name;
  }
}
