import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class MovementEntryDto {
  @ApiProperty({ description: 'Movement ID' })
  @IsString()
  movementId: string;

  @ApiProperty({ description: 'Minutes spent on this movement' })
  @IsInt()
  @Min(1)
  timeSpentMinutes: number;

  @ApiPropertyOptional({ description: 'Notes about this movement' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTrainingSessionDto {
  @ApiPropertyOptional({ description: 'Session date (ISO string)', default: new Date().toISOString() })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: 'Duration in minutes', example: 90 })
  @IsInt()
  @Min(1)
  @Max(600)
  durationMinutes: number;

  @ApiProperty({ description: 'Intensity feeling (1-10)', example: 7 })
  @IsInt()
  @Min(1)
  @Max(10)
  intensityFeeling: number;

  @ApiPropertyOptional({ description: 'General notes about the session' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Movements practiced', type: [MovementEntryDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MovementEntryDto)
  movements?: MovementEntryDto[];
}
