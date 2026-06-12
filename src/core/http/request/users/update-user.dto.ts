import { IsOptional, IsInt, IsNumber, IsString, Min, Max, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Belt, Objective, Intensity } from '../../../../../const';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ enum: Belt, description: 'Belt rank' })
  @IsOptional()
  @IsEnum(Belt)
  belt?: Belt;

  @ApiPropertyOptional({ description: 'Number of stripes', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  stripes?: number;

  @ApiPropertyOptional({ description: 'Age in years', example: 25 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ description: 'Weight in kg', example: 80.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({ description: 'BJJ Academy', example: 'Gracie Barra' })
  @IsOptional()
  @IsString()
  bjjAcademy?: string;

  @ApiPropertyOptional({ description: 'Time training in months', example: 12 })
  @IsOptional()
  @IsInt()
  @Min(0)
  timeTraining?: number;

  @ApiPropertyOptional({ description: 'Trainings per week', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  trainingsPerWeek?: number;

  @ApiPropertyOptional({ enum: Objective, description: 'Training objective' })
  @IsOptional()
  @IsEnum(Objective)
  objective?: Objective;

  @ApiPropertyOptional({ enum: Intensity, description: 'Training intensity' })
  @IsOptional()
  @IsEnum(Intensity)
  intensity?: Intensity;

  @ApiPropertyOptional({ description: 'Avatar image URL' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
