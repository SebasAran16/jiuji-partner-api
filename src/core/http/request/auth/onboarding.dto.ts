import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Belt, Objective, Intensity } from '@prisma/client';

export class OnboardingDto {
  @ApiProperty({ description: 'First name', example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ description: 'Age', example: 25 })
  @IsInt()
  @Min(5)
  @Max(120)
  @IsNotEmpty()
  age: number;

  @ApiProperty({ enum: Belt, description: 'Belt color' })
  @IsEnum(Belt)
  @IsNotEmpty()
  belt: Belt;

  @ApiProperty({ description: 'Number of stripes (0-4)', example: 0 })
  @IsInt()
  @Min(0)
  @Max(4)
  @IsNotEmpty()
  stripes: number;

  @ApiProperty({ description: 'BJJ academy name', example: 'Gracie Barra' })
  @IsString()
  @IsNotEmpty()
  bjjAcademy: string;

  @ApiProperty({ description: 'Time training in months', example: 12 })
  @IsInt()
  @Min(0)
  @IsNotEmpty()
  timeTraining: number;

  @ApiProperty({ description: 'Trainings per week (1-7)', example: 3 })
  @IsInt()
  @Min(1)
  @Max(7)
  @IsNotEmpty()
  trainingsPerWeek: number;

  @ApiProperty({ enum: Objective, description: 'Training objective' })
  @IsEnum(Objective)
  @IsNotEmpty()
  objective: Objective;

  @ApiProperty({ enum: Intensity, description: 'Training intensity' })
  @IsEnum(Intensity)
  @IsNotEmpty()
  intensity: Intensity;

  @ApiProperty({ description: 'Weight in kg', example: 80, required: false })
  @IsOptional()
  weight?: number;
}
