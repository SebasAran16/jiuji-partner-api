import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SuggestionStatus } from '../../../../../const';

export class QuerySuggestionsDto {
  @IsOptional()
  @IsEnum(SuggestionStatus)
  status?: SuggestionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number;
}
