import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DriveFileInfo } from '../../../const';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MAX_RETRIES = 3;
const RECURSIVE_DELAY_MS = 200;

interface DriveApiFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
}

interface DriveApiResponse {
  files: DriveApiFile[];
  nextPageToken?: string;
}

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('GOOGLE_API_KEY');
  }

  extractFolderId(url: string): string {
    const match =
      url.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
      url.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
      url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error('Invalid Google Drive folder URL');
    }
    return match[1];
  }

  async listVideosRecursive(folderId: string): Promise<DriveFileInfo[]> {
    const results: DriveFileInfo[] = [];
    await this.scanFolder(folderId, results);
    return results;
  }

  private async scanFolder(folderId: string, results: DriveFileInfo[], retries = 0): Promise<void> {
    const url = this.buildQueryUrl(folderId);

    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      this.logger.error(`Network error scanning folder ${folderId}: ${err}`);
      throw err;
    }

    if (res.status === 429) {
      if (retries >= MAX_RETRIES) {
        throw new Error('Rate limit exceeded — max retries reached');
      }
      const retryAfter = parseInt(res.headers.get('Retry-After') || '10', 10);
      this.logger.warn(`Rate limited, waiting ${retryAfter}s (retry ${retries + 1}/${MAX_RETRIES})`);
      await this.delay(retryAfter * 1000);
      return this.scanFolder(folderId, results, retries + 1);
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Google Drive API error ${res.status}: ${body}`);
    }

    const data: DriveApiResponse = await res.json();

    for (const file of data.files || []) {
      if (file.mimeType === FOLDER_MIME) {
        await this.delay(RECURSIVE_DELAY_MS);
        await this.scanFolder(file.id, results, retries);
      } else if (file.mimeType.startsWith('video/')) {
        results.push(this.toDriveFileInfo(file));
      }
    }

    if (data.nextPageToken) {
      await this.delay(RECURSIVE_DELAY_MS);
      await this.scanFolder(folderId, results, retries);
    }
  }

  private buildQueryUrl(folderId: string): string {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id,name,mimeType,size,webViewLink,webContentLink),nextPageToken',
      key: this.apiKey,
      pageSize: '100',
    });
    return `${DRIVE_API_BASE}?${params}`;
  }

  private toDriveFileInfo(file: DriveApiFile): DriveFileInfo {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size, 10) : null,
      webViewLink: file.webViewLink || '',
      // Drive API media endpoint streams real bytes. webContentLink/uc?export=download
      // return an HTML virus-scan page for files too large to scan, which then
      // fails ffprobe ("moov atom not found"). No key in the stored URL —
      // MediaService adds it per-request so it never lands in the DB.
      downloadUrl: `${DRIVE_API_BASE}/${file.id}?alt=media`,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
