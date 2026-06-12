import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';
import type { VideoSegmentDocument, VideoSearchResult } from '../../../const';

// nomic-embed-text output size; must match the embedding model
export const EMBEDDING_DIMENSIONS = 768;

@Injectable()
export class VectorStoreService implements OnModuleInit {
  private readonly logger = new Logger(VectorStoreService.name);
  private readonly client: QdrantClient;
  private readonly collection: string;

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
  }

  async onModuleInit() {
    try {
      await this.ensureCollection();
    } catch (err) {
      // Boot must not depend on Qdrant being up; the processor will fail loudly instead
      this.logger.error(`Could not initialize Qdrant collection: ${err}`);
    }
  }

  async ensureCollection() {
    const { exists } = await this.client.collectionExists(this.collection);
    if (exists) return;

    await this.client.createCollection(this.collection, {
      vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' },
    });
    await this.client.createPayloadIndex(this.collection, {
      field_name: 'videoId',
      field_schema: 'keyword',
    });
    this.logger.log(`Created Qdrant collection '${this.collection}'`);
  }

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
}
