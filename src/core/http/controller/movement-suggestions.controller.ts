import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MovementSuggestionsService } from '../../services/movement-suggestions.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { QuerySuggestionsDto } from '../request/movement-suggestions/query-suggestions.dto';
import { ApproveSuggestionDto } from '../request/movement-suggestions/approve-suggestion.dto';

@ApiTags('Movement Suggestions')
@Controller('movement-suggestions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class MovementSuggestionsController {
  constructor(
    private readonly suggestionsService: MovementSuggestionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List movement suggestions (admin)' })
  async list(@Query() query: QuerySuggestionsDto) {
    return this.suggestionsService.list(query);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Approve a suggestion: creates the Movement (admin edits win over AI proposal) and links the evidence video',
  })
  async approve(@Param('id') id: string, @Body() dto: ApproveSuggestionDto) {
    return this.suggestionsService.approve(id, dto);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Decline a suggestion (remembered — never re-suggested)',
  })
  async decline(@Param('id') id: string) {
    return this.suggestionsService.decline(id);
  }
}
