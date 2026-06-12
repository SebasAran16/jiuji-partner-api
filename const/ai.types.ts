export interface FrameInfo {
  path: string;
  timestamp: number;
}

export interface FrameQuality {
  sharpness: number;
  brightness: number;
}

export interface ScoredFrame extends FrameInfo {
  quality: FrameQuality;
}

export interface FrameCaption {
  timestamp: number;
  caption: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface VideoSegmentDocument {
  videoId: string;
  segmentIndex: number;
  startTime: number;
  endTime: number;
  text: string;
  title: string;
  tags: string[];
}

export interface VideoDescriptionMeta {
  title: string;
  tags: string[];
  competitor?: string | null;
  competition?: string | null;
  captions: string[];
  transcriptExcerpt: string;
}

export interface VideoSearchResult {
  videoId: string;
  title: string;
  startTime: number;
  endTime: number;
  text: string;
  score: number;
}

export interface RagChatResult {
  answer: string;
  sources: VideoSearchResult[];
}
