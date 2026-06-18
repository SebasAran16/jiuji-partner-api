import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';
import type {
  SimilarMovement,
  VideoSearchResult,
  VideoSegmentDocument,
} from '../../../const';

// nomic-embed-text output size; must match the embedding model
export const EMBEDDING_DIMENSIONS = 768;

interface MovementPayload {
  movementId: string;
  name: string;
  description: string | null;
}

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private readonly client: QdrantClient;
  private readonly collection: string;
  private readonly movementsCollection: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new QdrantClient({
      url: this.configService.get<string>(
        'QDRANT_URL',
        'http://localhost:6333',
      ),
    });
    this.collection = this.configService.get<string>(
      'QDRANT_COLLECTION',
      'videos',
    );
    this.movementsCollection = this.configService.get<string>(
      'QDRANT_MOVEMENTS_COLLECTION',
      'movements',
    );
  }

  async onModuleInit() {
    try {
      await this.ensureCollection(this.collection, 'videoId');
      await this.ensureCollection(this.movementsCollection);
    } catch (err) {
      // Boot must not depend on Qdrant being up; the processor will fail loudly instead
      this.logger.error(`Could not initialize Qdrant collections: ${err}`);
    }
  }

  private async ensureCollection(name: string, indexField?: string) {
    const { exists } = await this.client.collectionExists(name);
    if (exists) return;

    await this.client.createCollection(name, {
      vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
    });
    if (indexField) {
      await this.client.createPayloadIndex(name, {
        field_name: indexField,
        field_schema: 'keyword',
      });
    }
    this.logger.log(`Created Qdrant collection '${name}'`);
  }

  // --- video segments ---

  async upsertSegments(segments: VideoSegmentDocument[], vectors: number[][]) {
    if (segments.length !== vectors.length) {
      throw new Error(
        `Segment/vector count mismatch: ${segments.length} vs ${vectors.length}`,
      );
    }
    if (!segments.length) return;

    await this.client.upsert(this.collection, {
      wait: true,
      points: segments.map((segment, i) => ({
        id: randomUUID(),
        vector: vectors[i],
        payload: { ...segment },
      })),
    });
  }

  async search(vector: number[], limit = 5): Promise<VideoSearchResult[]> {
    const hits = await this.client.search(this.collection, {
      vector,
      limit,
      with_payload: true,
    });

    return hits.map((hit) => {
      const payload = hit.payload as unknown as VideoSegmentDocument;
      return {
        videoId: payload.videoId,
        title: payload.title,
        startTime: payload.startTime,
        endTime: payload.endTime,
        text: payload.text,
        score: hit.score,
      };
    });
  }

  async deleteByVideoId(videoId: string) {
    await this.client.delete(this.collection, {
      wait: true,
      filter: { must: [{ key: 'videoId', match: { value: videoId } }] },
    });
  }

  // --- movement catalog (semantic similarity for suggestions + matching) ---

  // Point id = movementId, so re-upserting a movement overwrites in place
  async upsertMovement(
    movementId: string,
    vector: number[],
    payload: Omit<MovementPayload, 'movementId'>,
  ) {
    await this.client.upsert(this.movementsCollection, {
      wait: true,
      points: [{ id: movementId, vector, payload: { movementId, ...payload } }],
    });
  }

  async searchMovements(
    vector: number[],
    limit = 5,
  ): Promise<SimilarMovement[]> {
    const hits = await this.client.search(this.movementsCollection, {
      vector,
      limit,
      with_payload: true,
    });

    return hits.map((hit) => {
      const payload = hit.payload as unknown as MovementPayload;
      return {
        movementId: payload.movementId,
        name: payload.name,
        description: payload.description,
        score: hit.score,
      };
    });
  }

  async countMovements(): Promise<number> {
    const { count } = await this.client.count(this.movementsCollection, {
      exact: true,
    });
    return count;
  }

  async deleteMovement(movementId: string) {
    await this.client.delete(this.movementsCollection, {
      wait: true,
      points: [movementId],
    });
  }
}
