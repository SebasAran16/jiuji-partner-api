import { IsString, IsOptional, IsArray, IsInt, IsUrl } from 'class-validator';
import type { VideoCreateData } from '../../../../../const';

export class CreateVideoDto implements VideoCreateData {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  duration?: number;

  @IsOptional()
  @IsString()
  competitor?: string;

  @IsOptional()
  @IsString()
  competition?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
