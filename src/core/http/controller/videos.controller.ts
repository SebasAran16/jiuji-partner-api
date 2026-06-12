import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { VideosService } from '../../services/videos.service';
import { ImportService } from '../../services/import.service';
import { GoogleDriveService } from '../../services/google-drive.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CreateVideoDto } from '../request/videos/create-video.dto';
import { QueryVideosDto } from '../request/videos/query-videos.dto';
import { ImportVideosDto } from '../request/videos/import-videos.dto';
import { ImportDriveDto } from '../request/videos/import-drive.dto';

@ApiTags('Videos')
@Controller('videos')
export class VideosController {
  constructor(
    private readonly videosService: VideosService,
    private readonly importService: ImportService,
    private readonly googleDriveService: GoogleDriveService,
    @InjectQueue('video-import') private readonly queue: Queue,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all videos (authenticated)' })
  async findAll(@Query() query: QueryVideosDto) {
    return this.videosService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get video by ID' })
  async findOne(@Param('id') id: string) {
    return this.videosService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new video and queue processing (admin)' })
  async create(@Body() dto: CreateVideoDto) {
    const video = await this.videosService.create(dto);
    await this.queue.add({ videoId: video.id });
    return video;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a video (admin)' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.videosService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a video (admin)' })
  async delete(@Param('id') id: string) {
    await this.videosService.delete(id);
    return { deleted: true };
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk import videos (admin)' })
  async import(@Body() dto: ImportVideosDto) {
    return this.importService.importVideos(dto.videos);
  }

  @Post('import/drive/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Preview videos from a Google Drive folder (admin)' })
  async previewDriveImport(@Body() dto: ImportDriveDto) {
    const folderId = this.googleDriveService.extractFolderId(dto.folderUrl);
    const videos = await this.googleDriveService.listVideosRecursive(folderId);
    const totalSize = videos.reduce((acc, v) => acc + (v.size || 0), 0);
    return { totalVideos: videos.length, totalSize, videos };
  }

  @Post('import/drive/confirm')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Import videos from a Google Drive folder (admin)' })
  async confirmDriveImport(@Body() dto: ImportDriveDto) {
    const folderId = this.googleDriveService.extractFolderId(dto.folderUrl);
    const allVideos = await this.googleDriveService.listVideosRecursive(folderId);
    const selected = dto.videoIds?.length
      ? allVideos.filter((v) => dto.videoIds!.includes(v.id))
      : allVideos;
    const videoIds = await this.videosService.createBatchFromDrive(selected);
    // One job per video: independent retries, per-video visibility in Bull Board
    await this.queue.addBulk(videoIds.map((videoId) => ({ data: { videoId } })));
    return { queued: videoIds.length };
  }
}
