import type {
  FlashcardItem,
  FlashcardProgress,
  FlashcardRating,
  FlashcardDeckSummary,
  NoteItem,
} from '../types';

const STORAGE_KEY = 'noterip_flashcards_progress_v1';

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
 * Load persisted SM-2 progress from localStorage
 */
export function loadFlashcardProgressMap(): Record<string, FlashcardProgress> {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load flashcard progress map:', err);
  }
  return {};
}

/**
 * Save updated SM-2 progress for a card
 */
export function saveCardProgress(cardId: string, progress: FlashcardProgress): void {
  try {
    const map = loadFlashcardProgressMap();
    map[cardId] = progress;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save flashcard progress:', err);
  }
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
 * Extracts flashcards from markdown content:
 * 1. Inline Q::A (e.g. "Cos'è un bus?::Un canale di trasmissione")
 * 2. Multi-line Q / ? / A blocks
 * 3. Cloze deletion {c1::testo nascosto}
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

    // Skip empty lines, headings, comments or code block markers
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('```') || trimmed.startsWith('---')) {
      i++;
      continue;
    }

    // 1. Cloze Deletion syntax: {c1::hidden text}
    // Supports multiple clozes in same line: {c1::...} and {c2::...}
    const clozeMatches = Array.from(rawLine.matchAll(/\{c(\d+)::(.+?)\}/g));
    if (clozeMatches.length > 0) {
      // Find all unique cloze numbers in this line
      const clozeIndices = Array.from(new Set(clozeMatches.map((m) => parseInt(m[1], 10))));

      for (const cIndex of clozeIndices) {
        // Create card for this specific cloze index
        let frontText = rawLine;
        let answerText = '';

        // Replace the target cloze with [...] and other clozes with their normal text
        frontText = frontText.replace(/\{c(\d+)::(.+?)\}/g, (_match, num, hidden) => {
          if (parseInt(num, 10) === cIndex) {
            answerText = hidden;
            return `[...]`;
          }
          return hidden; // Other clozes displayed as plain text
        });

        // Clean bullet points from front
        const cleanFront = frontText.replace(/^\s*[-*]\s*/, '').trim();
        const id = `cloze_${hashString(`${notePath}_${i}_${cIndex}_${cleanFront}`)}`;
        const progress = progressMap[id] || createDefaultProgress();

        cards.push({
          id,
          notePath,
          noteTitle,
          folder: folder || 'Radice',
          type: 'cloze',
          front: cleanFront,
          back: answerText.trim(),
          rawText: rawLine,
          clozeIndex: cIndex,
          lineNumber: i + 1,
          progress,
        });
      }
      i++;
      continue;
    }

    // 2. Inline Basic Q::A syntax (e.g. "Domanda?::Risposta!")
    // Handles bullet points like "- Domanda::Risposta"
    const inlineMatch = rawLine.match(/^(\s*[-*]\s*)?([^:\n]+?)::([^\n]+)$/);
    if (inlineMatch) {
      const question = inlineMatch[2].trim();
      const answer = inlineMatch[3].trim();

      if (question.length > 1 && answer.length > 0) {
        const id = `basic_${hashString(`${notePath}_${i}_${question}`)}`;
        const progress = progressMap[id] || createDefaultProgress();

        cards.push({
          id,
          notePath,
          noteTitle,
          folder: folder || 'Radice',
          type: 'basic',
          front: question,
          back: answer,
          rawText: rawLine,
          lineNumber: i + 1,
          progress,
        });
      }
      i++;
      continue;
    }

    // 3. Multi-line Question / ? / Answer syntax
    // Question Line
    // ?
    // Answer Line(s)
    if (i + 2 < lines.length && lines[i + 1].trim() === '?') {
      const question = trimmed.replace(/^\s*[-*]\s*/, '');
      let answer = lines[i + 2].trim();
      let endLine = i + 2;

      // Collect multi-line answer until blank line or next element
      let j = i + 3;
      while (j < lines.length && lines[j].trim() && !lines[j].trim().startsWith('#') && lines[j].trim() !== '?') {
        answer += '\n' + lines[j].trim();
        endLine = j;
        j++;
      }

      if (question.length > 1 && answer.length > 0) {
        const id = `multiline_${hashString(`${notePath}_${i}_${question}`)}`;
        const progress = progressMap[id] || createDefaultProgress();

        cards.push({
          id,
          notePath,
          noteTitle,
          folder: folder || 'Radice',
          type: 'basic',
          front: question,
          back: answer,
          rawText: lines.slice(i, endLine + 1).join('\n'),
          lineNumber: i + 1,
          progress,
        });
      }

      i = endLine + 1;
      continue;
    }

    i++;
  }

  return cards;
}

/**
 * Scan all notes in the vault and aggregate all flashcards
 */
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

/**
 * Filter cards that are due for review today or are completely new
 */
export function getDueCards(cards: FlashcardItem[]): FlashcardItem[] {
  const now = Date.now();
  return cards.filter((c) => c.progress.state === 'new' || c.progress.dueDate <= now);
}

/**
 * Generates summary stats per subject/folder
 */
export function getDeckSummaries(cards: FlashcardItem[]): FlashcardDeckSummary[] {
  const now = Date.now();
  const map: Record<string, FlashcardDeckSummary> = {};

  for (const card of cards) {
    const f = card.folder || 'Radice';
    if (!map[f]) {
      map[f] = {
        folder: f,
        totalCards: 0,
        dueCards: 0,
        newCards: 0,
        learnedCards: 0,
      };
    }

    map[f].totalCards += 1;
    if (card.progress.state === 'new') {
      map[f].newCards += 1;
      map[f].dueCards += 1;
    } else if (card.progress.dueDate <= now) {
      map[f].dueCards += 1;
    } else {
      map[f].learnedCards += 1;
    }
  }

  return Object.values(map).sort((a, b) => b.dueCards - a.dueCards);
}
