import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class ImportDriveDto {
  @IsString()
  @IsNotEmpty()
  folderUrl: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  videoIds?: string[];
}
