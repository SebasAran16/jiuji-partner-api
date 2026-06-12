export interface VideoImportData {
  title: string;
  url: string;
  description?: string;
  thumbnailUrl?: string;
  competitor?: string;
  competition?: string;
  tags?: string[];
}

export interface VideoCreateData extends VideoImportData {
  duration?: number;
}

export interface VideoUpdate {
  title?: string;
  url?: string;
  description?: string;
  thumbnailUrl?: string;
  duration?: number;
  competitor?: string;
  competition?: string;
  tags?: string[];
  processingStatus?: string;
}

export interface VideoFilter {
  page?: number;
  perPage?: number;
  search?: string;
  status?: string;
}
