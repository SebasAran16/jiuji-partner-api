import { IsOptional, IsBoolean, IsEnum, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Belt } from '@prisma/client';
import { Transform } from 'class-transformer';

export class QueryMovementsDto {
  @ApiPropertyOptional({ enum: Belt, description: 'Minimum belt level' })
  @IsOptional()
  @IsEnum(Belt)
  belt?: Belt;

  @ApiPropertyOptional({ description: 'Movement category', example: 'submission' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by gi/no-gi', example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  gi?: boolean;
}
