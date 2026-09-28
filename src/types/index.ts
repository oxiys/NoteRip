export interface FileNode {
  path: string;
  name: string;
  is_dir: boolean;
  extension?: string | null;
  children?: FileNode[] | null;
  updated_at?: number | null;
  size?: number | null;
}

export interface NoteItem {
  path: string;
  title: string;
  rel_path: string;
  preview: string;
  content: string;
  updated_at: number;
  folder: string;
  tags: string[];
  outlinks: string[];
  backlinks: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  linkCount: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  index?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GitSyncResult {
  success: boolean;
  message: string;
  files_changed: number;
}

export interface CodeRunResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code?: number | null;
  execution_time_ms: number;
}

// ==========================================
// Flashcards & Spaced Repetition (SM-2) Types
// ==========================================
export type FlashcardType = 'basic' | 'cloze';
export type FlashcardState = 'new' | 'learning' | 'review';
export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

export interface FlashcardProgress {
  repetition: number;
  interval: number; // in days
  easeFactor: number; // default 2.5
  dueDate: number; // timestamp in ms
  lastReviewed: number | null;
  state: FlashcardState;
  reviewsCount: number;
}

export interface FlashcardItem {
  id: string;
  notePath: string;
  noteTitle: string;
  folder: string;
  type: FlashcardType;
  front: string; // Question or Cloze masked with [...]
  back: string; // Answer or revealed Cloze
  rawText: string;
  clozeIndex?: number;
  lineNumber: number;
  progress: FlashcardProgress;
}

export interface FlashcardDeckSummary {
  folder: string;
  totalCards: number;
  dueCards: number;
  newCards: number;
  learnedCards: number;
}

