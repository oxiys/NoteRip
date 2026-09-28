import type { NoteItem } from '../types';
import { normalizeNoteName } from './indexer';

// Common Italian and English academic/general stop-words that should NEVER trigger auto-mentions
const STOP_WORDS = new Set([
  // Italian articles and prepositions
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'di', 'a', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  // Conjunctions & Pronouns
  'e', 'ed', 'o', 'od', 'ma', 'se', 'non', 'che', 'chi', 'cui',
  'quale', 'quali', 'questo', 'questa', 'questi', 'queste',
  'quello', 'quella', 'quelli', 'quelle', 'tutto', 'tutti', 'tutta', 'tutte',
  'ogni', 'come', 'dove', 'quando', 'perche', 'perché', 'anche', 'ancora',
  'gia', 'già', 'poi', 'piu', 'più', 'meno', 'molto', 'poco', 'bene', 'male',
  // Common generic nouns and academic terms too vague to be useful links alone
  'cosa', 'cose', 'modo', 'modi', 'anno', 'anni', 'giorno', 'giorni',
  'tempo', 'parte', 'parti', 'punto', 'punti', 'caso', 'casi', 'fatto', 'fatti',
  'primo', 'prima', 'primi', 'prime', 'secondo', 'seconda', 'secondi', 'seconde',
  'nota', 'note', 'appunto', 'appunti', 'studio', 'test', 'esempio', 'esempi',
  'definizione', 'definizioni', 'introduzione', 'conclusione', 'indice',
  'capitolo', 'capitoli', 'lezione', 'lezioni', 'sezione', 'sezioni',
  'corso', 'corsi', 'esame', 'esami', 'argomento', 'argomenti',
  'riassunto', 'riassunti', 'schema', 'schemi', 'approfondimento',
  'sistema', 'sistemi', 'analisi', 'problema', 'problemi', 'soluzione', 'soluzioni',
  'base', 'basi', 'dati', 'dato', 'valore', 'valori', 'tipo', 'tipi', 'funzione', 'funzioni',
  'livello', 'livelli', 'metodo', 'metodi', 'processo', 'processi', 'struttura', 'strutture',
  'proprieta', 'proprietà', 'relazione', 'relazioni', 'concetto', 'concetti',
  'modello', 'modelli', 'risultato', 'risultati', 'elemento', 'elementi', 'numero', 'numeri',
  'gruppo', 'gruppi', 'fine', 'inizio', 'fase', 'fasi', 'passo', 'passi',
  'informazione', 'informazioni', 'teoria', 'teorie', 'algoritmo', 'algoritmi',
  'programma', 'programmi', 'sviluppo', 'ricerca', 'uso', 'applicazione', 'applicazioni',

  // English stop words
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
  'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
  'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
  'further', 'then', 'once', 'here', 'there', 'all', 'any', 'both', 'each',
  'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
  'now', 'note', 'notes', 'doc', 'docs', 'readme', 'index', 'summary',
  'data', 'base', 'system', 'systems', 'type', 'types', 'time', 'case', 'cases'
]);

export interface DetectedMention {
  sourcePath: string;
  sourceTitle: string;
  targetPath: string;
  targetTitle: string;
  matchedTerm: string;
  occurrenceCount: number;
  snippet: string;
  confidence: 'alta' | 'media' | 'bassa';
  score: number;
}

export interface SharedTagLink {
  sourcePath: string;
  sourceTitle: string;
  targetPath: string;
  targetTitle: string;
  sharedTags: string[];
  count: number;
}

/**
 * Generates morphological variants for Italian & English terms (singular <-> plural)
 */
function generateVariants(word: string): string[] {
  const w = word.trim().toLowerCase();
  const variants = new Set<string>([w]);

  // Italian singular <-> plural rules
  if (w.endsWith('a') && w.length > 3) {
    variants.add(w.slice(0, -1) + 'e');
  } else if (w.endsWith('e') && w.length > 3) {
    variants.add(w.slice(0, -1) + 'a');
    variants.add(w.slice(0, -1) + 'i');
  }

  if (w.endsWith('o') && w.length > 3) {
    variants.add(w.slice(0, -1) + 'i');
  } else if (w.endsWith('i') && w.length > 3) {
    variants.add(w.slice(0, -1) + 'o');
    variants.add(w.slice(0, -1) + 'e');
  }

  // English singular <-> plural
  if (w.endsWith('s') && w.length > 3) {
    variants.add(w.slice(0, -1));
  } else if (w.length > 3) {
    variants.add(w + 's');
  }

  return Array.from(variants);
}

/**
 * Extracts the core concept terms from a note title
 */
function extractTitleConcepts(rawTitle: string): { fullTitle: string; concepts: string[] } {
  const cleanTitle = normalizeNoteName(rawTitle).trim();
  const concepts = new Set<string>();

  // Add the direct clean title
  concepts.add(cleanTitle);

  // Strip leading numbers: "01 - Limiti", "1. Integrali", "Lezione 3: Alberi"
  const strippedNumber = cleanTitle
    .replace(/^(?:lezione|capitolo|modulo|classe|settimana)?\s*\d+[\s:._-]+/i, '')
    .trim();
  if (strippedNumber && strippedNumber !== cleanTitle) {
    concepts.add(strippedNumber);
  }

  // Strip parentheses: "Potenze (Algebra)" -> "Potenze"
  const strippedParens = cleanTitle.replace(/\s*\([^)]*\)$/, '').trim();
  if (strippedParens && strippedParens !== cleanTitle) {
    concepts.add(strippedParens);
  }

  // Also strip both numbers and parentheses
  const strippedBoth = strippedNumber.replace(/\s*\([^)]*\)$/, '').trim();
  if (strippedBoth && strippedBoth.length >= 3) {
    concepts.add(strippedBoth);
  }

  return {
    fullTitle: cleanTitle,
    concepts: Array.from(concepts).filter((c) => c.length >= 3),
  };
}

/**
 * Strips code blocks, URLs, and existing [[WikiLinks]] so text-mention search is accurate
 */
function cleanContentForMentionSearch(content: string): string {
  return content
    // Remove multi-line code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // Remove inline code
    .replace(/`[^`]+`/g, ' ')
    // Remove image links
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    // Remove explicit WikiLinks so we only detect UNLINKED mentions
    .replace(/\[\[[^\]]+\]\]/g, ' ')
    // Remove regular markdown links, keeping only text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove LaTeX block math
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    // Remove inline math
    .replace(/\$[^$\n]+\$/g, ' ');
}

/**
 * Escapes characters for safe regex creation
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface TargetCandidate {
  path: string;
  originalTitle: string;
  cleanTitle: string;
  terms: Array<{
    term: string;
    isOriginal: boolean;
    isMultiWord: boolean;
  }>;
}

/**
 * Detects implicit, unlinked mentions across all notes in the vault with high precision & coherence
 */
export function detectUnlinkedMentions(
  notes: NoteItem[],
  minConfidence: 'alta' | 'media' | 'bassa' = 'bassa'
): DetectedMention[] {
  const mentions: DetectedMention[] = [];

  // Build list of valid candidate targets
  const targets: TargetCandidate[] = notes
    .map((note) => {
      const { fullTitle, concepts } = extractTitleConcepts(note.title);
      const termsSet = new Set<string>();
      const termObjects: TargetCandidate['terms'] = [];

      for (const concept of concepts) {
        const lowerConcept = concept.toLowerCase();

        // Check if single word is a stop word
        const words = lowerConcept.split(/\s+/);
        if (words.length === 1 && STOP_WORDS.has(lowerConcept)) {
          continue;
        }

        // Add variants (singular/plural)
        const variants = generateVariants(concept);
        for (const variant of variants) {
          if (variant.length < 3) continue;
          if (STOP_WORDS.has(variant)) continue;

          if (!termsSet.has(variant)) {
            termsSet.add(variant);
            const isMulti = variant.includes(' ');
            termObjects.push({
              term: variant,
              isOriginal: variant === lowerConcept,
              isMultiWord: isMulti,
            });
          }
        }
      }

      // Sort terms by length desc (longer phrases first)
      termObjects.sort((a, b) => b.term.length - a.term.length);

      return {
        path: note.path,
        originalTitle: note.title,
        cleanTitle: fullTitle,
        terms: termObjects,
      };
    })
    .filter((t) => t.terms.length > 0);

  // Scan each source note
  for (const sourceNote of notes) {
    const cleanedText = cleanContentForMentionSearch(sourceNote.content);
    if (!cleanedText.trim()) continue;

    // Set of target note paths that are already explicitly linked via [[WikiLinks]]
    const existingExplicitTargets = new Set<string>();
    sourceNote.outlinks.forEach((outlink) => {
      const norm = normalizeNoteName(outlink).toLowerCase();
      const target = notes.find((n) => normalizeNoteName(n.title).toLowerCase() === norm);
      if (target) {
        existingExplicitTargets.add(target.path);
      }
    });

    for (const target of targets) {
      if (target.path === sourceNote.path) continue;
      if (existingExplicitTargets.has(target.path)) continue;

      let totalMatches = 0;
      let bestSnippet = '';
      let bestTerm = '';
      let isDirectMatch = false;
      let isMultiWordMatch = false;

      for (const termObj of target.terms) {
        const escaped = escapeRegex(termObj.term);

        let regex: RegExp;
        try {
          regex = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gui');
        } catch {
          regex = new RegExp(`(?:^|[\\s.,;:!?"'()\\[\\]{}/<>-])${escaped}(?=[\\s.,;:!?"'()\\[\\]{}/<>-]|$)`, 'gi');
        }

        let match: RegExpExecArray | null;
        let termMatches = 0;

        while ((match = regex.exec(cleanedText)) !== null) {
          termMatches++;
          if (!bestSnippet) {
            const matchIndex = match.index;
            const snippetStart = Math.max(0, matchIndex - 35);
            const snippetEnd = Math.min(cleanedText.length, matchIndex + termObj.term.length + 35);
            const rawSnippet = cleanedText.slice(snippetStart, snippetEnd).replace(/\n+/g, ' ').trim();
            bestSnippet = '...' + rawSnippet + '...';
            bestTerm = match[0];
            isDirectMatch = termObj.isOriginal;
            isMultiWordMatch = termObj.isMultiWord;
          }
        }

        totalMatches += termMatches;
      }

      if (totalMatches > 0) {
        // High coherence criteria:
        // Multi-word matches or exact title matches are high confidence
        // Single words need multiple occurrences or length >= 6 to be high confidence
        let confidence: 'alta' | 'media' | 'bassa';
        if (isMultiWordMatch || (isDirectMatch && bestTerm.length >= 6) || totalMatches >= 3) {
          confidence = 'alta';
        } else if (totalMatches >= 2 || bestTerm.length >= 5) {
          confidence = 'media';
        } else {
          confidence = 'bassa';
        }

        // Apply confidence filter
        if (minConfidence === 'alta' && confidence !== 'alta') continue;
        if (minConfidence === 'media' && confidence === 'bassa') continue;

        const score = totalMatches * 10 + (isMultiWordMatch ? 25 : 0) + (isDirectMatch ? 15 : 5);

        mentions.push({
          sourcePath: sourceNote.path,
          sourceTitle: sourceNote.title,
          targetPath: target.path,
          targetTitle: target.cleanTitle,
          matchedTerm: bestTerm || target.cleanTitle,
          occurrenceCount: totalMatches,
          snippet: bestSnippet,
          confidence,
          score,
        });
      }
    }
  }

  // Sort mentions by relevance score descending
  mentions.sort((a, b) => b.score - a.score);

  return mentions;
}

/**
 * Criterion: Detects notes that share one or more #tags, creating thematic cluster links
 */
export function detectSharedTagLinks(notes: NoteItem[], minSharedTags: number = 1): SharedTagLink[] {
  const links: SharedTagLink[] = [];
  const processedPairs = new Set<string>();

  for (let i = 0; i < notes.length; i++) {
    const noteA = notes[i];
    const tagsA = new Set(noteA.tags.map((t) => t.toLowerCase()));
    if (tagsA.size === 0) continue;

    for (let j = i + 1; j < notes.length; j++) {
      const noteB = notes[j];
      const tagsB = new Set(noteB.tags.map((t) => t.toLowerCase()));
      if (tagsB.size === 0) continue;

      const pairKey = [noteA.path, noteB.path].sort().join('<->');
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      // Find intersection
      const shared: string[] = [];
      tagsA.forEach((tag) => {
        if (tagsB.has(tag)) {
          shared.push(tag);
        }
      });

      if (shared.length >= minSharedTags) {
        links.push({
          sourcePath: noteA.path,
          sourceTitle: noteA.title,
          targetPath: noteB.path,
          targetTitle: noteB.title,
          sharedTags: shared,
          count: shared.length,
        });
      }
    }
  }

  return links;
}
