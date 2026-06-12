export class VideoEntity {
  id: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  duration: number | null;
  competitor: string | null;
  competition: string | null;
  tags: string[];
  processingStatus: string;
  createdAt: Date;

  constructor(partial: Partial<VideoEntity>) {
    Object.assign(this, partial);
  }
}

