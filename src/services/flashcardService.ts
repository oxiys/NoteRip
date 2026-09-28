import type {
  FlashcardItem,
  FlashcardProgress,
  FlashcardRating,
  FlashcardDeckSummary,
  NoteItem,
} from '../types';
import { tauriBridge } from './tauriBridge';

const STORAGE_KEY_CARDS = 'noterip_standalone_flashcards_v2';
const STORAGE_KEY_PROGRESS = 'noterip_flashcards_progress_v1';
const FLASHCARD_FILE = '.noterip_flashcards.json';

/**
 * Deterministic hash to uniquely identify a card across sessions
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function generateCardId(): string {
  return `card_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export function createDefaultProgress(): FlashcardProgress {
  return {
    repetition: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: Date.now(),
    lastReviewed: null,
    state: 'new',
    reviewsCount: 0,
  };
}

/**
 * SuperMemo SM-2 Spaced Repetition Algorithm
 * Computes next repetition count, interval (in days), easeFactor and dueDate.
 */
export function calculateSM2Review(
  current: FlashcardProgress,
  rating: FlashcardRating
): FlashcardProgress {
  let { repetition, interval, easeFactor, reviewsCount } = current;
  reviewsCount += 1;

  switch (rating) {
    case 'again':
      // Reset streak upon failure
      repetition = 0;
      interval = 1; // Due in 1 day (or immediate review)
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;

    case 'hard':
      // Modest interval increase, ease factor reduced slightly
      interval = Math.max(1, Math.round(interval * 1.2));
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      break;

    case 'good':
      // Standard successful progression
      if (repetition === 0) {
        interval = 1;
      } else if (repetition === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetition += 1;
      break;

    case 'easy':
      // Great recall, bonus interval and increase ease
      if (repetition === 0) {
        interval = 4;
      } else {
        interval = Math.round(interval * easeFactor * 1.3);
      }
      repetition += 1;
      easeFactor = Math.min(3.5, easeFactor + 0.15);
      break;
  }

  const now = Date.now();
  const nextDue = now + interval * 24 * 60 * 60 * 1000;

  return {
    repetition,
    interval,
    easeFactor: Math.round(easeFactor * 100) / 100,
    dueDate: nextDue,
    lastReviewed: now,
    state: rating === 'again' ? 'learning' : 'review',
    reviewsCount,
  };
}

/**
 * Filter cards that are due for review today or are completely new
 */
export function getDueCards(cards: FlashcardItem[]): FlashcardItem[] {
  const now = Date.now();
  return cards.filter((c) => c.progress.state === 'new' || c.progress.dueDate <= now);
}

/**
 * Generates summary stats per deck
 */
export function getDeckSummaries(cards: FlashcardItem[]): FlashcardDeckSummary[] {
  const now = Date.now();
  const map: Record<string, FlashcardDeckSummary> = {};

  for (const card of cards) {
    const deckName = card.deck || card.folder || 'Generale';
    if (!map[deckName]) {
      map[deckName] = {
        deck: deckName,
        folder: deckName,
        totalCards: 0,
        dueCards: 0,
        newCards: 0,
        learnedCards: 0,
      };
    }

    map[deckName].totalCards += 1;
    if (card.progress.state === 'new') {
      map[deckName].newCards += 1;
      map[deckName].dueCards += 1;
    } else if (card.progress.dueDate <= now) {
      map[deckName].dueCards += 1;
    } else {
      map[deckName].learnedCards += 1;
    }
  }

  return Object.values(map).sort((a, b) => b.dueCards - a.dueCards);
}

export const DEFAULT_SEED_CARDS: FlashcardItem[] = [
  {
    id: 'seed_1',
    deck: 'Architettura degli Elaboratori',
    front: 'Qual è la differenza principale tra un\'architettura CISC e una RISC?',
    back: 'CISC possiede un set di istruzioni complesso e variabile con molti modi di indirizzamento; RISC impiega un set ridotto di istruzioni uniformi a ciclo singolo, ottimizzate per pipeline hardware veloci.',
    progress: createDefaultProgress(),
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'seed_2',
    deck: 'Architettura degli Elaboratori',
    front: 'Come si calcola il complemento a due di una parola binaria a $n$ bit?',
    back: 'Si applica l\'inversione logica di tutti i bit (complemento a uno, NOT) e si addiziona 1 al bit meno significativo (LSB).',
    progress: createDefaultProgress(),
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'seed_3',
    deck: 'Logica Booleana',
    front: 'Scrivi le due leggi di De Morgan per la logica booleana.',
    back: '1. $\\overline{A \\cdot B} = \\bar{A} + \\bar{B}$\n2. $\\overline{A + B} = \\bar{A} \\cdot \\bar{B}$\nLa negazione del prodotto logico è la somma delle negazioni, e viceversa.',
    progress: createDefaultProgress(),
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'seed_4',
    deck: 'Sistemi Operativi',
    front: 'Cosa si intende per Deadlock (Stallo) nei Sistemi Operativi e quali sono le 4 condizioni di Coffman?',
    back: 'Uno stato in cui due o più processi rimangono bloccati in attesa di risorse reciprocamente trattenute.\nLe 4 condizioni necessarie sono:\n1. Mutua Esclusione\n2. Possesso e Attesa (Hold and Wait)\n3. Nessuna Prelazione (No Preemption)\n4. Attesa Circolare (Circular Wait)',
    progress: createDefaultProgress(),
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'seed_5',
    deck: 'Algoritmi e Strutture Dati',
    front: 'Qual è la complessità temporale nel caso medio e peggiore del Quicksort?',
    back: 'Caso medio: $O(n \\log n)$\nCaso peggiore: $O(n^2)$ (quando il pivot scelto è sistematicamente l\'elemento minimo o massimo)',
    progress: createDefaultProgress(),
    createdAt: Date.now() - 86400000,
  },
];

/**
 * Load standalone flashcards from vault file (.noterip_flashcards.json) or localStorage
 */
export async function loadStandaloneFlashcards(vaultPath?: string | null): Promise<FlashcardItem[]> {
  // 1. If vaultPath is provided, try reading from vault file
  if (vaultPath) {
    try {
      const normalizedVault = vaultPath.replace(/\\/g, '/');
      const filePath = `${normalizedVault}/${FLASHCARD_FILE}`;
      const content = await tauriBridge.readNote(filePath);
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(parsed));
          return parsed;
        }
      }
    } catch {
      // Vault file may not exist yet, fall through to localStorage
    }
  }

  // 2. Try loading from localStorage
  try {
    const data = localStorage.getItem(STORAGE_KEY_CARDS);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load flashcards from localStorage:', err);
  }

  // 3. Fallback: Seed with high quality initial cards
  try {
    localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(DEFAULT_SEED_CARDS));
  } catch {
    // ignore
  }
  return DEFAULT_SEED_CARDS;
}

/**
 * Save standalone flashcards to vault file and localStorage
 */
export async function saveStandaloneFlashcards(
  cards: FlashcardItem[],
  vaultPath?: string | null
): Promise<void> {
  const json = JSON.stringify(cards, null, 2);

  // 1. Always sync to localStorage
  try {
    localStorage.setItem(STORAGE_KEY_CARDS, json);
  } catch (err) {
    console.error('Failed to save flashcards to localStorage:', err);
  }

  // 2. Sync to vault file if vaultPath is set
  if (vaultPath) {
    try {
      const normalizedVault = vaultPath.replace(/\\/g, '/');
      const filePath = `${normalizedVault}/${FLASHCARD_FILE}`;
      await tauriBridge.writeNote(filePath, json);
    } catch (err) {
      console.warn('Could not write flashcards to vault file:', err);
    }
  }
}

/**
 * Load persisted SM-2 progress from localStorage (compat)
 */
export function loadFlashcardProgressMap(): Record<string, FlashcardProgress> {
  try {
    const data = localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load flashcard progress map:', err);
  }
  return {};
}

/**
 * Save updated SM-2 progress for a card (compat)
 */
export function saveCardProgress(cardId: string, progress: FlashcardProgress): void {
  try {
    const map = loadFlashcardProgressMap();
    map[cardId] = progress;
    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save flashcard progress:', err);
  }
}

/**
 * Legacy support: parse flashcards from markdown notes if migration is requested
 */
export function parseFlashcardsFromNote(
  content: string,
  notePath: string,
  noteTitle: string,
  folder: string,
  progressMap: Record<string, FlashcardProgress>
): FlashcardItem[] {
  const cards: FlashcardItem[] = [];
  const lines = content.split('\n');

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.startsWith('---')) {
      i++;
      continue;
    }

    // Inline Q::A
    const inlineMatch = rawLine.match(/^(\s*[-*]\s*)?([^:\n]+?)::([^\n]+)$/);
    if (inlineMatch) {
      const question = inlineMatch[2].trim();
      const answer = inlineMatch[3].trim();
      if (question.length > 1 && answer.length > 0) {
        const id = `legacy_${hashString(`${notePath}_${i}_${question}`)}`;
        const progress = progressMap[id] || createDefaultProgress();
        cards.push({
          id,
          deck: folder || 'Generale',
          notePath,
          noteTitle,
          folder: folder || 'Generale',
          type: 'basic',
          front: question,
          back: answer,
          rawText: rawLine,
          lineNumber: i + 1,
          progress,
          createdAt: Date.now(),
        });
      }
      i++;
      continue;
    }

    i++;
  }

  return cards;
}

export function parseAllFlashcards(
  notes: NoteItem[],
  progressMap: Record<string, FlashcardProgress>
): FlashcardItem[] {
  const allCards: FlashcardItem[] = [];
  for (const note of notes) {
    const noteCards = parseFlashcardsFromNote(
      note.content,
      note.path,
      note.title,
      note.folder,
      progressMap
    );
    allCards.push(...noteCards);
  }
  return allCards;
}
