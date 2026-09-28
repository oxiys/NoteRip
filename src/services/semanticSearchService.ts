import type { NoteItem } from '../types';

export interface VaultChunk {
  id: string;
  notePath: string;
  noteTitle: string;
  folder: string;
  sectionHeader: string;
  content: string;
  vector: Float32Array;
  tokens: Map<string, number>; // token -> term frequency
  length: number;
}

export interface SemanticSearchResult {
  chunk: VaultChunk;
  score: number; // 0 to 1
  semanticScore: number;
  lexicalScore: number;
  matchedKeywords: string[];
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
  }[];
  relatedConcepts: string[];
}

const VECTOR_DIM = 128;

/**
 * Tokenize and normalize text into clean words/stems
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s$]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Deterministic hash-based dense embedding projection (Subword n-gram vectorizer)
 * Generates unit-normalized 128-dimensional dense semantic vectors
 */
function computeDenseVector(tokens: string[]): Float32Array {
  const vec = new Float32Array(VECTOR_DIM);
  if (tokens.length === 0) return vec;

  for (let i = 0; i < tokens.length; i++) {
    const word = tokens[i];
    const weight = 1.0 / (1.0 + Math.log(1 + i * 0.1)); // slight positional decay

    // Word hash
    let h = 2166136261;
    for (let j = 0; j < word.length; j++) {
      h ^= word.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % VECTOR_DIM;
    const sign = (h & 0x80000000) === 0 ? 1.0 : -1.0;
    vec[idx] += sign * weight;

    // Subword character trigrams for semantic root/stem matching
    if (word.length >= 3) {
      for (let k = 0; k <= word.length - 3; k++) {
        let sh = 2166136261;
        for (let m = 0; m < 3; m++) {
          sh ^= word.charCodeAt(k + m);
          sh = Math.imul(sh, 16777619);
        }
        const sidx = Math.abs(sh) % VECTOR_DIM;
        const ssign = (sh & 0x80000000) === 0 ? 0.4 : -0.4;
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
 * Cosine similarity between two unit vectors
 */
function cosineSimilarity(v1: Float32Array, v2: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < VECTOR_DIM; i++) {
    dot += v1[i] * v2[i];
  }
  // Clamp between 0 and 1 for positive similarities
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

/**
 * In-memory Semantic Vault Indexer
 */
class SemanticVaultIndexer {
  private chunks: VaultChunk[] = [];
  private docFrequencies: Map<string, number> = new Map();
  private avgChunkLength = 0;
  private indexedHash = '';

  /**
   * Split a note into logical chunks based on Markdown headings and paragraphs
   */
  private chunkNote(note: NoteItem): VaultChunk[] {
    const lines = note.content.split('\n');
    const noteChunks: VaultChunk[] = [];

    let currentHeader = 'Introduzione';
    let currentLines: string[] = [];
    let chunkCounter = 0;

    const flushChunk = () => {
      const text = currentLines.join('\n').trim();
      if (text.length >= 20) {
        const tokens = tokenize(text);
        const tokenMap = new Map<string, number>();
        for (const t of tokens) {
          tokenMap.set(t, (tokenMap.get(t) || 0) + 1);
        }

        const vector = computeDenseVector(tokens);

        noteChunks.push({
          id: `${note.path}#${chunkCounter++}`,
          notePath: note.path,
          noteTitle: note.title,
          folder: note.folder,
          sectionHeader: currentHeader,
          content: text,
          vector,
          tokens: tokenMap,
          length: tokens.length,
        });
      }
      currentLines = [];
    };

    for (const line of lines) {
      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
      if (headerMatch) {
        flushChunk();
        currentHeader = headerMatch[2].trim();
      } else {
        currentLines.push(line);
        // If chunk gets longer than ~15 lines, break at next paragraph for fine granularity
        if (currentLines.length >= 15 && !line.trim()) {
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
    // Quick fingerprint to avoid recomputing if unchanged
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

        for (const token of chunk.tokens.keys()) {
          dfMap.set(token, (dfMap.get(token) || 0) + 1);
        }
      }
    }

    this.chunks = allChunks;
    this.docFrequencies = dfMap;
    this.avgChunkLength = allChunks.length > 0 ? totalLength / allChunks.length : 1;
    this.indexedHash = fingerprint;
  }

  /**
   * BM25 Okapi lexical score calculation
   */
  private calculateBM25(queryTokens: string[], chunk: VaultChunk): number {
    const k1 = 1.2;
    const b = 0.75;
    const N = this.chunks.length;
    let score = 0;

    for (const q of queryTokens) {
      const tf = chunk.tokens.get(q) || 0;
      if (tf === 0) continue;

      const df = this.docFrequencies.get(q) || 1;
      const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
      const denom = tf + k1 * (1 - b + (b * chunk.length) / this.avgChunkLength);
      score += idf * ((tf * (k1 + 1)) / (denom || 1));
    }

    return score;
  }

  /**
   * Hybrid Search: Cosine Dense Embedding + BM25 Lexical Ranking
   */
  public search(query: string, topK = 6): SemanticSearchResult[] {
    if (!query.trim() || this.chunks.length === 0) return [];

    const queryTokens = tokenize(query);
    const queryVector = computeDenseVector(queryTokens);

    // Compute raw scores
    const scored = this.chunks.map((chunk) => {
      const semanticSim = cosineSimilarity(queryVector, chunk.vector);
      const bm25 = this.calculateBM25(queryTokens, chunk);

      // Find matched keywords
      const matched = queryTokens.filter((qt) => chunk.tokens.has(qt));

      return {
        chunk,
        semanticScore: semanticSim,
        rawBm25: bm25,
        matchedKeywords: matched,
      };
    });

    // Normalize BM25
    let maxBm25 = 0;
    for (const s of scored) {
      if (s.rawBm25 > maxBm25) maxBm25 = s.rawBm25;
    }

    const results: SemanticSearchResult[] = scored.map((s) => {
      const normBm25 = maxBm25 > 0 ? s.rawBm25 / maxBm25 : 0;
      // 55% dense semantic similarity + 45% lexical BM25 matching
      const finalScore = s.semanticScore * 0.55 + normBm25 * 0.45;

      return {
        chunk: s.chunk,
        score: finalScore,
        semanticScore: s.semanticScore,
        lexicalScore: normBm25,
        matchedKeywords: s.matchedKeywords,
      };
    });

    // Sort descending by final hybrid score
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Smart Extractive Q&A: Synthesizes direct answer and citations from top chunks
   */
  public answerQuestion(question: string): SmartQAResponse {
    const searchResults = this.search(question, 5);

    if (searchResults.length === 0) {
      return {
        question,
        directAnswer: 'Non ho trovato informazioni sufficienti nei tuoi appunti per rispondere a questa domanda.',
        summary: 'Nessun riscontro nel Vault',
        confidence: 0,
        sources: [],
        relatedConcepts: [],
      };
    }

    const topResult = searchResults[0];
    const queryTokens = new Set(tokenize(question));

    // Sentence extraction & scoring for direct answer
    const candidateSentences: { text: string; score: number; source: VaultChunk }[] = [];

    for (const res of searchResults.slice(0, 3)) {
      // Split chunk content into sentences
      const sentences = res.chunk.content
        .split(/(?<=[.?!])\s+(?=[A-Z0-9$*#`])/g)
        .map((s) => s.trim())
        .filter((s) => s.length > 15 && !s.startsWith('#'));

      for (const sent of sentences) {
        const sentTokens = tokenize(sent);
        let matchCount = 0;
        for (const st of sentTokens) {
          if (queryTokens.has(st)) matchCount++;
        }

        // Definition bonus (e.g. "è", "rappresenta", "definito", "consiste")
        let defBonus = 0;
        if (/\b(è|rappresenta|consiste|definito|indica|utilizzato per|serve a)\b/i.test(sent)) {
          defBonus = 0.5;
        }

        // Flashcard QA line bonus (e.g. Q::A)
        let qaBonus = 0;
        if (sent.includes('::')) {
          qaBonus = 0.8;
        }

        const overlapRatio = sentTokens.length > 0 ? matchCount / Math.min(queryTokens.size, sentTokens.length) : 0;
        const sentScore = res.score * 0.4 + overlapRatio * 0.4 + defBonus + qaBonus;

        candidateSentences.push({
          text: sent,
          score: sentScore,
          source: res.chunk,
        });
      }
    }

    candidateSentences.sort((a, b) => b.score - a.score);

    // Pick top 1 or 2 best answering sentences
    let directAnswer = '';
    if (candidateSentences.length > 0) {
      const best = candidateSentences[0].text;
      // If best has Q::A, extract answer part
      if (best.includes('::')) {
        const parts = best.split('::');
        directAnswer = parts[1].trim();
      } else {
        directAnswer = best;
        if (candidateSentences.length > 1 && candidateSentences[1].score > 0.8) {
          directAnswer += ' ' + candidateSentences[1].text;
        }
      }
    } else {
      directAnswer = topResult.chunk.content.slice(0, 200) + '...';
    }

    // Confidence: scale top score to percentage
    const rawConf = Math.min(100, Math.round(topResult.score * 115));
    const confidence = Math.max(15, rawConf);

    // Related concepts from WikiLinks [[...]] in sources
    const relatedSet = new Set<string>();
    for (const res of searchResults) {
      const wikiMatches = res.chunk.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
      for (const m of wikiMatches) {
        relatedSet.add(m[1].trim());
      }
    }

    // Sources mapping
    const sources = searchResults.map((res) => {
      // Find highlight snippet
      const content = res.chunk.content;
      const snippet = content.length > 280 ? content.slice(0, 280) + '...' : content;

      return {
        notePath: res.chunk.notePath,
        noteTitle: res.chunk.noteTitle,
        folder: res.chunk.folder,
        sectionHeader: res.chunk.sectionHeader,
        snippet,
        score: Math.round(res.score * 100),
      };
    });

    return {
      question,
      directAnswer,
      summary: `Risposta estratta da [[${topResult.chunk.noteTitle}]] (${topResult.chunk.sectionHeader})`,
      confidence,
      sources,
      relatedConcepts: Array.from(relatedSet).slice(0, 6),
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
  const prompt = `Sei l'assistente per lo studio universitario di NoteRip. Rispondi alla seguente domanda basandoti ESCLUSIVAMENTE sul contesto fornito estratto dagli appunti Markdown dell'utente. Se l'informazione non è presente, indicalo chiaramente. Rispondi in italiano in modo chiaro e strutturato.

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
