import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SimilarMovementsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
