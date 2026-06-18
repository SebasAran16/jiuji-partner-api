import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Belt } from '../../../../../const';

export class ApproveSuggestionDto {
  // Optional overrides: admin can correct the AI-proposed name/description
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // Taxonomy fields the AI cannot decide — the admin must
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsEnum(Belt)
  minBelt?: Belt;

  @IsOptional()
  @IsBoolean()
  gi?: boolean;
}
