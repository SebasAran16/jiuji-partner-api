export interface MovementFilter {
  belt?: string;
  category?: string;
  gi?: boolean;
}

// A known-catalog technique the LLM located in a video
export interface MatchedMovement {
  name: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

// A technique the LLM saw that is NOT in the catalog yet
export interface UnknownTechnique {
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface MovementMatchResult {
  known: MatchedMovement[];
  unknown: UnknownTechnique[];
}

// Admin-edited fields applied when approving a suggestion into the catalog
export interface SuggestionApproval {
  name?: string;
  description?: string;
  category: string;
  type: string;
  minBelt?: string;
  gi?: boolean;
}

export interface SimilarMovement {
  movementId: string;
  name: string;
  description: string | null;
  score: number;
}
