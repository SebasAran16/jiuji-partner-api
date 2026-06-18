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

// Video-level metadata for description generation. The visual/audio evidence
// (captions + transcript) is passed separately so LlmService can chunk it.
export interface VideoDescriptionMeta {
  title: string;
  tags: string[];
  competitor?: string | null;
  competition?: string | null;
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
