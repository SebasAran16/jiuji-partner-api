import { IsArray, IsString, IsOptional, IsUrl } from 'class-validator';
import type { VideoImportData } from '../../../../../const';

class ImportVideoItem implements VideoImportData {
  @IsString()
  title: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

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

export class ImportVideosDto {
  @IsArray()
  videos: ImportVideoItem[];
}
