import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MovementsService } from '../../services/movements.service';
import { QueryMovementsDto } from '../request/movements/query-movements.dto';
import { SimilarMovementsDto } from '../request/movements/similar-movements.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('Movements')
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  @ApiOperation({ summary: 'List movements with optional filters' })
  async findAll(@Query() query: QueryMovementsDto) {
    return this.movementsService.findAll(query);
  }

  // Must be declared before :slug or 'similar' would be captured as a slug
  @Get('similar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Find catalog movements semantically similar to a name/description (admin)',
  })
  async findSimilar(@Query() query: SimilarMovementsDto) {
    return this.movementsService.findSimilar(query.name, query.description);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a movement by slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.movementsService.findBySlug(slug);
  }
}
