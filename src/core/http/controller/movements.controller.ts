import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MovementsService } from '../../services/movements.service';
import { QueryMovementsDto } from '../request/movements/query-movements.dto';

@ApiTags('Movements')
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  @ApiOperation({ summary: 'List movements with optional filters' })
  async findAll(@Query() query: QueryMovementsDto) {
    return this.movementsService.findAll(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a movement by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.movementsService.findBySlug(slug);
  }
}
