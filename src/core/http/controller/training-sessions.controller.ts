import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { TrainingSessionsService } from '../../services/training-sessions.service';
import { CreateTrainingSessionDto } from '../request/training-sessions/create-training-session.dto';
import { QueryTrainingSessionsDto } from '../request/training-sessions/query-training-sessions.dto';

@ApiTags('Training Sessions')
@Controller('training-sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TrainingSessionsController {
  constructor(private readonly trainingSessionsService: TrainingSessionsService) {}

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateTrainingSessionDto,
  ) {
    return this.trainingSessionsService.create(user.id, dto);
  }

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query() query: QueryTrainingSessionsDto,
  ) {
    const page = query.page ?? 1;
    const perPage = query.perPage ?? 10;
    return this.trainingSessionsService.findAll(user.id, page, perPage);
  }

  @Get(':id')
  async findById(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.trainingSessionsService.findById(user.id, id);
  }
}
