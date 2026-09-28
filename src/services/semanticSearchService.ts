import type { NoteItem } from '../types';

export interface VaultChunk {
  id: string;
  notePath: string;
  noteTitle: string;
  folder: string;
  sectionHeader: string;
  content: string;
  vector: Float32Array;
  stemTokens: Map<string, number>; // stem -> term frequency
  titleStems: Set<string>;
  headerStems: Set<string>;
  flashcards: { front: string; back: string }[];
  length: number;
}

export interface SemanticSearchResult {
  chunk: VaultChunk;
  score: number; // 0 to 1
  semanticScore: number;
  lexicalScore: number;
  matchedKeywords: string[];
  matchedStems: string[];
  coverage: number; // 0 to 1 (how many query keywords matched)
}

export interface SmartQAResponse {
  question: string;
  directAnswer: string;
  summary: string;
  confidence: number; // 0 to 100 percentage
  sources: {
    notePath: string;
    noteTitle: string;
    folder: string;
    sectionHeader: string;
    snippet: string;
    score: number;
    matchedKeywords: string[];
  }[];
  relatedConcepts: string[];
  matchedTerms: string[];
}

const VECTOR_DIM = 128;

/**
 * Comprehensive Italian Stopwords List
 * Excludes grammatical words, prepositions, articles, and common filler verbs
 */
export const ITALIAN_STOPWORDS = new Set([
  // Question & interrogative
  'come', 'cosa', 'cos', 'qual', 'quale', 'quali', 'chi', 'dove', 'quando', 'perché', 'perche',
  'quanto', 'quanta', 'quanti', 'quante',
  // Common verbs (essere, avere, fare, dovere, potere, etc.)
  'è', 'e', 'ed', 'era', 'erano', 'sarà', 'sara', 'saranno', 'sia', 'siano', 'stato', 'stata', 'stati', 'state', 'sono', 'essere',
  'ha', 'hanno', 'ho', 'abbiamo', 'aveva', 'avevano', 'avrà', 'avra', 'avuto', 'avuta', 'avere',
  'fa', 'fanno', 'fare', 'fatto', 'fatta', 'fatti', 'fatte', 'facendo',
  'può', 'puo', 'possono', 'potere', 'potrebbe', 'possa',
  'deve', 'devono', 'dovere', 'dovrebbe',
  'va', 'vanno', 'andare',
  'si', 'ci', 'vi', 'ti', 'mi', 'ne', 'se',
  // Prepositions (simple and articulated)
  'di', 'a', 'ad', 'da', 'in', 'con', 'su', 'per', 'tra', 'fra',
  'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'al', 'allo', 'alla', 'ai', 'agli', 'alle',
  'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
  'nel', 'nello', 'nella', 'nei', 'negli', 'nelle',
  'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle',
  // Articles & demonstratives
  'il', 'lo', 'la', 'i', 'gli', 'le', 'l',
  'un', 'uno', 'una',
  'questo', 'questa', 'questi', 'queste',
  'quello', 'quella', 'quelli', 'quelle', 'quel',
  'suo', 'sua', 'suoi', 'sue', 'loro',
  'mio', 'mia', 'miei', 'mie',
  'tuo', 'tua', 'tuoi', 'tue',
  'nostro', 'nostra', 'nostri', 'nostre',
  // Conjunctions & adverbs
  'che', 'cui', 'non', 'no', 'più', 'piu', 'meno', 'molto', 'molti', 'poco', 'pochi',
  'anche', 'ancora', 'solo', 'soltanto', 'invece', 'quindi', 'dunque', 'allora',
  'inoltre', 'oppure', 'ossia', 'ovvero', 'cioè', 'cioe', 'proprio', 'pure',
  'tutto', 'tutti', 'tutta', 'tutte', 'ogni', 'ciascun', 'ciascuno', 'ciascuna',
  'senza', 'dopo', 'prima', 'sopra', 'sotto', 'dentro', 'fuori',
]);

export const ENGLISH_STOPWORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did',
  'a', 'an', 'and', 'or', 'but', 'if', 'because', 'as', 'until', 'while',
  'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off',
  'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'can', 'will', 'just', 'should', 'now', 'what', 'which', 'who', 'this', 'that', 'these', 'those'
]);

/**
 * Fast, deterministic stemmer for Italian and technical vocabulary
 * Reduces plural/singular, gender, and verb variations to a common root
 */
export function stemItalian(word: string): string {
  if (word.length <= 3) return word.toLowerCase();

  let s = word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (s.endsWith('zionale') || s.endsWith('zionali')) return s.slice(0, -5);
  if (s.endsWith('zione') || s.endsWith('zioni')) return s.slice(0, -1); // 'addizion'
  if (/(?:ando|endo)$/.test(s) && s.length > 5) return s.replace(/(?:ando|endo)$/, '');
  if (/(?:ar|er|ir)[ei]$/.test(s) && s.length > 5) return s.replace(/(?:ar|er|ir)[ei]$/, '');
  if (/(?:at|ut|it)[oiae]$/.test(s) && s.length > 5) return s.replace(/(?:at|ut|it)[oiae]$/, '');
  if (/(?:ari[oaie]|ar[ioae])$/.test(s) && s.length > 5) return s.replace(/(?:ari[oaie]|ar[ioae])$/, 'ar'); // 'binar'
  if (/(?:ich[ei]|ic[ioae])$/.test(s) && s.length > 5) return s.replace(/(?:ich[ei]|ic[ioae])$/, 'ic'); // 'logic'
  if (/iv[ioae]$/.test(s) && s.length > 5) return s.replace(/iv[ioae]$/, 'iv');
  if (/ment[io]$/.test(s) && s.length > 5) return s.replace(/ment[io]$/, 'ment'); // 'complement'
  if (/(?:abil|ibil)[ei]$/.test(s) && s.length > 5) return s.replace(/(?:abil|ibil)[ei]$/, 'abil');

  // Strip trailing standard vowels if word is sufficiently long
  if (s.length > 4 && /[aeiou]$/.test(s)) {
    return s.slice(0, -1);
  }

  return s;
}

/**
 * Domain-specific synonym mappings (Math, Computer Science, Logic)
 */
const SYNONYM_STEMS: Record<string, string[]> = {
  addizion: ['somm', 'addizion'],
  somm: ['addizion', 'somm'],
  sottrazion: ['differenz', 'sottrazion'],
  differenz: ['sottrazion', 'differenz'],
  moltiplicazion: ['prodott', 'moltiplicazion'],
  prodott: ['moltiplicazion', 'prodott'],
  division: ['quozient', 'division'],
  quozient: ['division', 'quozient'],
  binar: ['bit', 'base 2', 'binar'],
  bit: ['binar', 'bit'],
  calcol: ['esegu', 'determin', 'trov', 'calcol'],
  funzionament: ['funzion', 'meccanism', 'process', 'funzionament'],
};

/**
 * Tokenize text into normalized lowercase words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s$]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export interface QueryAnalysis {
  raw: string;
  allTokens: string[];
  contentKeywords: string[];     // Non-stopword content words (e.g. ['addizione', 'binario'])
  stems: string[];               // Primary stems (e.g. ['addizion', 'binar'])
  expandedStems: Set<string>;    // Includes synonyms
}

/**
 * Analyze user query, stripping stopwords and extracting core search stems
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const allTokens = tokenize(query);

  // Filter out Italian and English stopwords
  let contentKeywords = allTokens.filter(
    (t) => !ITALIAN_STOPWORDS.has(t) && !ENGLISH_STOPWORDS.has(t)
  );

  // If query consists entirely of stopwords (e.g. "cosa fa"), fallback to all tokens
  if (contentKeywords.length === 0) {
    contentKeywords = allTokens;
  }

  const stems = contentKeywords.map(stemItalian);
  const expandedStems = new Set<string>(stems);

  // Add synonym stems
  for (const s of stems) {
    const syns = SYNONYM_STEMS[s];
    if (syns) {
      for (const syn of syns) {
        expandedStems.add(syn);
      }
    }
  }

  return {
    raw: query,
    allTokens,
    contentKeywords,
    stems,
    expandedStems,
  };
}

/**
 * Dense vector projection based on content terms only
 * Avoids stopword pollution and hashing collisions
 */
function computeDenseVector(contentTokens: string[]): Float32Array {
  const vec = new Float32Array(VECTOR_DIM);
  if (contentTokens.length === 0) return vec;

  for (let i = 0; i < contentTokens.length; i++) {
    const word = contentTokens[i];
    const weight = 1.0 / (1.0 + Math.log(1 + i * 0.1));

    // Word hash
    let h = 2166136261;
    for (let j = 0; j < word.length; j++) {
      h ^= word.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % VECTOR_DIM;
    const sign = (h & 0x80000000) === 0 ? 1.0 : -1.0;
    vec[idx] += sign * weight;

    // Subword character trigrams for semantic root matching
    if (word.length >= 3) {
      for (let k = 0; k <= word.length - 3; k++) {
        let sh = 2166136261;
        for (let m = 0; m < 3; m++) {
          sh ^= word.charCodeAt(k + m);
          sh = Math.imul(sh, 16777619);
        }
        const sidx = Math.abs(sh) % VECTOR_DIM;
        const ssign = (sh & 0x80000000) === 0 ? 0.35 : -0.35;
        vec[sidx] += ssign * weight;
      }
    }
  }

  // L2 unit normalization
  let norm = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_DIM; i++) {
      vec[i] /= norm;
    }
  }

  return vec;
}

/**
 * Cosine similarity between two unit vectors (0 to 1)
 */
function cosineSimilarity(v1: Float32Array, v2: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    dot += v1[i] * v2[i];
  }
  return Math.max(0, Math.min(1, dot));
}

/**
 * In-memory Semantic Vault Indexer & Retriever
 */
class SemanticVaultIndexer {
  private chunks: VaultChunk[] = [];
  private docFrequencies: Map<string, number> = new Map();
  private avgChunkLength = 0;
  private indexedHash = '';

  /**
   * Split a note into logical chunks based on Markdown headings, paragraphs and flashcards
   */
  private chunkNote(note: NoteItem): VaultChunk[] {
    const lines = note.content.split('\n');
    const noteChunks: VaultChunk[] = [];

    let currentHeader = 'Introduzione';
    let currentLines: string[] = [];
    let currentFlashcards: { front: string; back: string }[] = [];
    let chunkCounter = 0;

    const titleTokens = tokenize(note.title);
    const titleStems = new Set(titleTokens.map(stemItalian));

    const flushChunk = () => {
      const text = currentLines.join('\n').trim();
      if (text.length >= 15 || currentFlashcards.length > 0) {
        const rawTokensList = tokenize(text);
        const stemMap = new Map<string, number>();

        // Content tokens (excluding stopwords) for vector embedding
        const contentTokens: string[] = [];

        for (const t of rawTokensList) {
          const s = stemItalian(t);
          stemMap.set(s, (stemMap.get(s) || 0) + 1);

          if (!ITALIAN_STOPWORDS.has(t) && !ENGLISH_STOPWORDS.has(t)) {
            contentTokens.push(t);
          }
        }

        const headerTokens = tokenize(currentHeader);
        const headerStems = new Set(headerTokens.map(stemItalian));

        // Add header stems to stemMap with weight boost
        for (const hs of headerStems) {
          stemMap.set(hs, (stemMap.get(hs) || 0) + 2);
        }

        const vector = computeDenseVector(contentTokens);

        noteChunks.push({
          id: `${note.path}#${chunkCounter++}`,
          notePath: note.path,
          noteTitle: note.title,
          folder: note.folder,
          sectionHeader: currentHeader,
          content: text,
          vector,
          stemTokens: stemMap,
          titleStems,
          headerStems,
          flashcards: [...currentFlashcards],
          length: rawTokensList.length,
        });
      }
      currentLines = [];
      currentFlashcards = [];
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Check for inline flashcard syntax (Front::Back)
      if (trimmed.includes('::') && !trimmed.startsWith('//') && !trimmed.startsWith('<!--')) {
        const parts = trimmed.split('::');
        if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
          currentFlashcards.push({
            front: parts[0].trim(),
            back: parts.slice(1).join('::').trim(),
          });
        }
      }

      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headerMatch) {
        flushChunk();
        currentHeader = headerMatch[2].trim();
      } else {
        currentLines.push(line);
        // Granular paragraph break if chunk gets long
        if (currentLines.length >= 18 && !trimmed) {
          flushChunk();
        }
      }
    }

    flushChunk();
    return noteChunks;
  }

  /**
   * Index or re-index notes if content changed
   */
  public indexVault(notes: NoteItem[]): void {
    const fingerprint = notes.map((n) => `${n.path}:${n.updated_at || n.content.length}`).join('|');
    if (fingerprint === this.indexedHash && this.chunks.length > 0) {
      return;
    }

    const allChunks: VaultChunk[] = [];
    const dfMap = new Map<string, number>();
    let totalLength = 0;

    for (const note of notes) {
      const noteChunks = this.chunkNote(note);
      for (const chunk of noteChunks) {
        allChunks.push(chunk);
        totalLength += chunk.length;

        for (const stem of chunk.stemTokens.keys()) {
          dfMap.set(stem, (dfMap.get(stem) || 0) + 1);
        }
      }
    }

    this.chunks = allChunks;
    this.docFrequencies = dfMap;
    this.avgChunkLength = allChunks.length > 0 ? totalLength / allChunks.length : 1;
    this.indexedHash = fingerprint;
  }

  /**
   * Calculate BM25 Okapi lexical score over stemmed tokens
   */
  private calculateBM25(queryStems: string[], chunk: VaultChunk): number {
    const k1 = 1.2;
    const b = 0.75;
    const N = this.chunks.length || 1;
    let score = 0;

    for (const stem of queryStems) {
      const tf = chunk.stemTokens.get(stem) || 0;
      if (tf === 0) continue;

      const df = this.docFrequencies.get(stem) || 1;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const denom = tf + k1 * (1 - b + (b * chunk.length) / this.avgChunkLength);
      score += idf * ((tf * (k1 + 1)) / (denom || 1));
    }

    return score;
  }

  /**
   * Check for term proximity: gives bonus if query terms appear close to each other in content
   */
  private computeProximityBonus(contentKeywords: string[], text: string): number {
    if (contentKeywords.length < 2) return 0;
    const lower = text.toLowerCase();
    const positions: number[] = [];

    for (const kw of contentKeywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        positions.push(idx);
      }
    }

    if (positions.length < 2) return 0;
    positions.sort((a, b) => a - b);
    const span = positions[positions.length - 1] - positions[0];

    // If keywords occur within ~150 characters of each other, significant boost
    if (span <= 80) return 0.4;
    if (span <= 160) return 0.25;
    return 0.1;
  }

  /**
   * Highly Accurate Hybrid Search:
   * 1. Hard Relevance Gate (Must match non-stopword query keywords)
   * 2. BM25 over Italian stems + Dense Semantic Vector + Proximity + Title/Header weighting
   */
  public search(query: string, topK = 6): SemanticSearchResult[] {
    if (!query.trim() || this.chunks.length === 0) return [];

    const analysis = analyzeQuery(query);
    const queryVector = computeDenseVector(analysis.contentKeywords);

    const scoredChunks: SemanticSearchResult[] = [];

    for (const chunk of this.chunks) {
      // 1. Identify which query stems match this chunk
      const matchedStems: string[] = [];
      const matchedKeywords: string[] = [];

      for (let i = 0; i < analysis.stems.length; i++) {
        const s = analysis.stems[i];
        const kw = analysis.contentKeywords[i] || s;

        const hasInContent = chunk.stemTokens.has(s);
        const hasInHeader = chunk.headerStems.has(s);
        const hasInTitle = chunk.titleStems.has(s);

        // Also check synonym stems if primary stem not found
        let hasSyn = false;
        const syns = SYNONYM_STEMS[s];
        if (!hasInContent && !hasInHeader && !hasInTitle && syns) {
          for (const syn of syns) {
            if (chunk.stemTokens.has(syn) || chunk.headerStems.has(syn) || chunk.titleStems.has(syn)) {
              hasSyn = true;
              break;
            }
          }
        }

        if (hasInContent || hasInHeader || hasInTitle || hasSyn) {
          matchedStems.push(s);
          matchedKeywords.push(kw);
        }
      }

      // 2. HARD FILTER: If chunk does NOT match ANY content keyword, DISQUALIFY!
      // This eliminates unrelated matches (like "Equazioni goniometriche" for binary addition).
      if (matchedStems.length === 0) {
        continue;
      }

      // 3. Keyword Coverage Calculation (e.g. 2 out of 2 keywords matched = 1.0)
      const coverage = matchedStems.length / Math.max(1, analysis.stems.length);

      // 4. BM25 Score
      const bm25 = this.calculateBM25(matchedStems, chunk);

      // 5. Semantic Vector Similarity
      const semanticSim = cosineSimilarity(queryVector, chunk.vector);

      // 6. Title and Section Header Boosts
      let titleBonus = 0;
      for (const s of matchedStems) {
        if (chunk.titleStems.has(s)) titleBonus += 0.45;
        if (chunk.headerStems.has(s)) titleBonus += 0.25;
      }

      // 7. Proximity Bonus
      const proximity = this.computeProximityBonus(analysis.contentKeywords, chunk.content);

      // 8. Coverage Multiplier: matching ALL query words gets a heavy multiplier
      // 100% match -> 1.8x, 50% match -> 1.0x
      const coverageMultiplier = 0.6 + coverage * 1.2;

      // Flashcard exact match bonus
      let flashcardBonus = 0;
      if (chunk.flashcards.length > 0) {
        for (const fc of chunk.flashcards) {
          const fcFrontTokens = tokenize(fc.front);
          const fcStems = new Set(fcFrontTokens.map(stemItalian));
          let fcMatches = 0;
          for (const s of matchedStems) {
            if (fcStems.has(s)) fcMatches++;
          }
          if (fcMatches >= matchedStems.length) {
            flashcardBonus = 0.4;
            break;
          }
        }
      }

      // Base combination: 60% BM25, 40% Semantic Vector + bonuses
      const rawScore = (bm25 * 0.15 + semanticSim * 0.4 + titleBonus + proximity + flashcardBonus) * coverageMultiplier;

      scoredChunks.push({
        chunk,
        score: rawScore,
        semanticScore: semanticSim,
        lexicalScore: bm25,
        matchedKeywords,
        matchedStems,
        coverage,
      });
    }

    if (scoredChunks.length === 0) return [];

    // Normalize final score to [0, 1]
    let maxScore = 0;
    for (const sc of scoredChunks) {
      if (sc.score > maxScore) maxScore = sc.score;
    }

    const results = scoredChunks.map((sc) => {
      const normScore = maxScore > 0 ? Math.min(1, sc.score / maxScore) : 0;
      return {
        ...sc,
        score: normScore,
      };
    });

    // Sort descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Smart Extractive Q&A: Synthesizes direct answer and citations from top chunks
   */
  public answerQuestion(question: string): SmartQAResponse {
    const analysis = analyzeQuery(question);
    const searchResults = this.search(question, 5);

    if (searchResults.length === 0) {
      const searchedKeywordsText = analysis.contentKeywords.join(', ');
      return {
        question,
        directAnswer: `Non ho trovato note nel tuo Vault che parlino dei concetti cercati (${searchedKeywordsText || 'nessun termine specifico'}). Prova a riformulare la domanda o a verificare i titoli delle note.`,
        summary: 'Nessun riscontro nel Vault',
        confidence: 0,
        sources: [],
        relatedConcepts: [],
        matchedTerms: [],
      };
    }

    const topResult = searchResults[0];

    // Check if the top result chunk has an exact matching Flashcard!
    let directAnswer = '';
    let extractedFromFlashcard = false;

    for (const res of searchResults) {
      for (const fc of res.chunk.flashcards) {
        const fcTokens = tokenize(fc.front);
        const fcStems = new Set(fcTokens.map(stemItalian));
        let matchCount = 0;
        for (const s of analysis.stems) {
          if (fcStems.has(s)) matchCount++;
        }
        // If flashcard question matches query content keywords
        if (matchCount >= Math.min(2, analysis.stems.length)) {
          directAnswer = fc.back.replace(/\{c\d+::([^}]+)\}/g, '$1'); // unwrap cloze if present
          extractedFromFlashcard = true;
          break;
        }
      }
      if (extractedFromFlashcard) break;
    }

    // If no flashcard direct answer, extract the best explanatory sentence/paragraph
    if (!directAnswer) {
      const candidateSentences: { text: string; score: number; source: VaultChunk }[] = [];

      for (const res of searchResults.slice(0, 3)) {
        // Split chunk content into sentences and bullet points
        const segments = res.chunk.content
          .split(/(?<=[.?!])\s+(?=[A-Z0-9$*#`])|\n(?=[-*\d+]\s+)/g)
          .map((s) => s.trim())
          .filter((s) => s.length >= 15 && !s.startsWith('#') && !s.includes('::'));

        for (const seg of segments) {
          const segTokens = tokenize(seg);
          const segStems = new Set(segTokens.map(stemItalian));

          let matchCount = 0;
          for (const s of analysis.stems) {
            if (segStems.has(s)) matchCount++;
          }

          // Sentence MUST contain at least one content keyword to be considered
          if (matchCount === 0) continue;

          // Explanatory bonus (e.g. "è", "si calcola", "consiste", "regola", "somma")
          let explanationBonus = 0;
          if (/\b(è|rappresenta|consiste|si calcola|si esegue|si fa|funziona|regola|passaggi|somma|procedimento|serve a|utilizzato per|operazione|risultato)\b/i.test(seg)) {
            explanationBonus = 0.5;
          }

          const overlapRatio = matchCount / Math.max(1, analysis.stems.length);
          const score = res.score * 0.4 + overlapRatio * 0.5 + explanationBonus;

          candidateSentences.push({
            text: seg,
            score,
            source: res.chunk,
          });
        }
      }

      candidateSentences.sort((a, b) => b.score - a.score);

      if (candidateSentences.length > 0) {
        directAnswer = candidateSentences[0].text;
        // If second sentence is also highly relevant, concatenate for a complete answer
        if (candidateSentences.length > 1 && candidateSentences[1].score > 0.85) {
          directAnswer += ' ' + candidateSentences[1].text;
        }
      } else {
        // Fallback: first 250 characters of top chunk content
        directAnswer = topResult.chunk.content.slice(0, 250).trim() + '...';
      }
    }

    // Realistic confidence calculation:
    // If top result has high coverage (1.0) and title/header match -> 85-98%
    // If partial coverage (0.5) -> 45-65%
    let confidence: number;
    if (topResult.coverage >= 1.0) {
      confidence = Math.min(98, Math.round(75 + topResult.score * 23));
    } else if (topResult.coverage >= 0.5) {
      confidence = Math.min(70, Math.round(45 + topResult.score * 25));
    } else {
      confidence = Math.min(40, Math.round(20 + topResult.score * 20));
    }

    // Related concepts from WikiLinks [[...]] in matched sources
    const relatedSet = new Set<string>();
    for (const res of searchResults) {
      const wikiMatches = res.chunk.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
      for (const m of wikiMatches) {
        const target = m[1].trim();
        // Remove folder path prefix if present
        const cleanName = target.split('/').pop() || target;
        relatedSet.add(cleanName);
      }
    }

    // Sources mapping
    const sources = searchResults.map((res) => {
      const content = res.chunk.content;
      const snippet = content.length > 280 ? content.slice(0, 280) + '...' : content;

      return {
        notePath: res.chunk.notePath,
        noteTitle: res.chunk.noteTitle,
        folder: res.chunk.folder,
        sectionHeader: res.chunk.sectionHeader,
        snippet,
        score: Math.round(res.score * 100),
        matchedKeywords: res.matchedKeywords,
      };
    });

    return {
      question,
      directAnswer,
      summary: `Risposta estratta da [[${topResult.chunk.noteTitle}]] (${topResult.chunk.sectionHeader})`,
      confidence,
      sources,
      relatedConcepts: Array.from(relatedSet).slice(0, 6),
      matchedTerms: topResult.matchedKeywords,
    };
  }
}

export const semanticSearchEngine = new SemanticVaultIndexer();

/**
 * Check if local Ollama or compatible LLM server is running on localhost:11434
 */
export async function checkOllamaAvailability(endpoint = 'http://localhost:11434'): Promise<{
  isAvailable: boolean;
  models: string[];
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`${endpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const models = Array.isArray(data.models) ? data.models.map((m: { name: string }) => m.name) : [];
      return { isAvailable: true, models };
    }
  } catch {
    // Offline or connection refused
  }
  return { isAvailable: false, models: [] };
}

/**
 * Perform RAG generation with local Ollama using retrieved vault context
 */
export async function generateOllamaAnswer(
  question: string,
  contextSnippets: string[],
  model = 'llama3',
  endpoint = 'http://localhost:11434'
): Promise<string> {
  const prompt = `Sei l'assistente per lo studio universitario di NoteRip. Rispondi alla seguente domanda basandoti sul contesto fornito estratto dagli appunti Markdown dell'utente. Se l'informazione è parziale, rispondi con quanto presente ed esplicita chiaramente cosa manca. Rispondi in italiano in modo chiaro e strutturato.

CONTESTO APPUNTI:
${contextSnippets.join('\n\n---\n\n')}

DOMANDA DELL'UTENTE:
${question}

RISPOSTA:`;

  try {
    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return data.response || 'Nessuna risposta generata.';
    }
    throw new Error(`Ollama error: HTTP ${res.status}`);
  } catch (err) {
    throw new Error(`Impossibile comunicare con il server LLM locale: ${(err as Error).message}`);
  }
}

/**
 * Optional Cloud API Generative RAG (Gemini Free Tier / Groq / OpenAI)
 * Zero bundle weight, zero RAM/CPU impact on desktop app
 */
export async function generateCloudAnswer(
  question: string,
  contextSnippets: string[],
  provider: 'gemini' | 'groq' | 'openai',
  apiKey: string,
  modelName?: string
): Promise<string> {
  const systemPrompt = `Sei l'assistente per lo studio universitario di NoteRip. Rispondi alla domanda dello studente basandoti sulle seguenti note estratte dal suo Vault. Sii chiaro, preciso ed evidenzia formule matematiche in formato LaTeX ($...$ o $$...$$).`;
  const userContent = `CONTESTO APPUNTI:\n${contextSnippets.join('\n\n---\n\n')}\n\nDOMANDA: ${question}`;

  if (provider === 'gemini') {
    const model = modelName || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }
        ]
      })
    });
    if (!res.ok) throw new Error(`Gemini API error: HTTP ${res.status}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Nessuna risposta generata.';
  }

  if (provider === 'groq' || provider === 'openai') {
    const endpoint = provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
    const model = modelName || (provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) throw new Error(`${provider.toUpperCase()} API error: HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Nessuna risposta generata.';
  }

  throw new Error(`Provider non supportato: ${provider}`);
}
