import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SuggestionApproval, UnknownTechnique } from '../../../const';
import { MovementSuggestionRepository } from '../repository/movement-suggestion.repository';
import { MovementRepository } from '../repository/movement.repository';
import { VideoMovementRepository } from '../repository/video-movement.repository';
import { MovementsService } from './movements.service';

@Injectable()
export class MovementSuggestionsService {
  private readonly logger = new Logger(MovementSuggestionsService.name);

  constructor(
    private readonly suggestionRepository: MovementSuggestionRepository,
    private readonly movementRepository: MovementRepository,
    private readonly videoMovementRepository: VideoMovementRepository,
    private readonly movementsService: MovementsService,
  ) {}

  async list(params: { status?: string; page?: number; perPage?: number }) {
    const where: Record<string, any> = {};
    if (params.status) {
      where.status = params.status;
    }
    return this.suggestionRepository.findManyPaginated({
      page: params.page,
      perPage: params.perPage,
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Called by the import pipeline for every unknown technique the LLM reports.
  // Dedupes against ALL prior suggestions (pending, declined, approved) so the
  // admin is never asked twice about the same name.
  async recordDetection(videoId: string, detection: UnknownTechnique) {
    const normalizedName = this.normalizeName(detection.name);
    if (!normalizedName) return null;

    const existing =
      await this.suggestionRepository.findByNormalizedName(normalizedName);
    if (existing) return null;

    try {
      return await this.suggestionRepository.create({
        name: detection.name,
        normalizedName,
        description: detection.description || null,
        confidence: detection.confidence,
        timestampStart: Math.round(detection.startTime),
        timestampEnd: Math.round(detection.endTime),
        evidence: detection.description || null,
        video: { connect: { id: videoId } },
      } as any);
    } catch (err: any) {
      // Unique-constraint race (two videos detecting the same technique
      // concurrently) is a benign duplicate, not an error
      if (err?.code === 'P2002') return null;
      throw err;
    }
  }

  // Approval creates the catalog entry with the admin's edits taking
  // precedence over the AI's proposal, links the evidence video, and indexes
  // the new movement for similarity search.
  async approve(id: string, edits: SuggestionApproval) {
    const suggestion = await this.suggestionRepository.findById(id);
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }
    if (suggestion.status !== 'PENDING') {
      throw new BadRequestException(`Suggestion is already ${suggestion.status}`);
    }

    const name = edits.name?.trim() || suggestion.name;
    const movement = await this.movementRepository.create({
      name,
      slug: await this.uniqueSlug(name),
      description: edits.description?.trim() || suggestion.description,
      category: edits.category,
      type: edits.type,
      minBelt: (edits.minBelt as any) ?? 'WHITE',
      gi: edits.gi ?? suggestion.gi ?? true,
    } as any);

    try {
      await this.movementsService.indexMovement(movement);
    } catch (err) {
      // Similarity index lags until next boot sync; the approval itself stands
      this.logger.warn(`Could not index approved movement ${movement.id}: ${err}`);
    }

    if (suggestion.videoId) {
      await this.videoMovementRepository.createForVideo(suggestion.videoId, [
        {
          movementId: movement.id,
          timestampStart: suggestion.timestampStart ?? 0,
          timestampEnd: suggestion.timestampEnd ?? 0,
          confidence: suggestion.confidence ?? 0.5,
        },
      ]);
    }

    await this.suggestionRepository.update(id, {
      status: 'APPROVED',
      reviewedAt: new Date(),
      createdMovementId: movement.id,
    } as any);

    return movement;
  }

  // Declined suggestions are kept forever: they are the dedupe memory that
  // stops the AI from re-proposing the same technique on every import.
  async decline(id: string) {
    const suggestion = await this.suggestionRepository.findById(id);
    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }
    if (suggestion.status !== 'PENDING') {
      throw new BadRequestException(`Suggestion is already ${suggestion.status}`);
    }

    return this.suggestionRepository.update(id, {
      status: 'DECLINED',
      reviewedAt: new Date(),
    } as any);
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'movement';

    let slug = base;
    for (let i = 2; await this.movementRepository.findBySlug(slug); i++) {
      slug = `${base}-${i}`;
    }
    return slug;
  }
}
