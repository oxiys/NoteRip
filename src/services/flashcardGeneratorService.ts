import { loadAISettings } from './aiSettingsService';

export interface GeneratedFlashcardDraft {
  id: string;
  front: string;
  back: string;
  deck: string;
  tags: string[];
  sourceType:
    | 'ai'
    | 'qa_inline'
    | 'cloze'
    | 'definition'
    | 'multiline'
    | 'callout'
    | 'highlight'
    | 'table'
    | 'formula'
    | 'question_heading'
    | 'enumeration';
  selected: boolean;
  notePath?: string;
  noteTitle?: string;
}

export type FlashcardGenerationStyle = 'exam' | 'concepts' | 'definitions' | 'formulas' | 'cloze';

function generateDraftId(prefix = 'draft'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Intelligent Rule-Based Extractor:
 * Extracts flashcards instantly and 100% offline from rich markdown patterns:
 * 1. Cloze Deletion: {c1::hidden} and {c1::hidden|hint}
 * 2. Highlights as Cloze: ==text to memorize==
 * 3. Double braces: {{hidden}} or {{c1::hidden}}
 * 4. Inline Q&A: Question :: Answer
 * 5. Natural Questions: Line with '?' followed by paragraph or bullet answer
 * 6. Question Headings: #, ##, ### questions followed by section content
 * 7. Definitions: **Term**: Explanation, **Term** — Explanation, - **Term**: Explanation
 * 8. Two-Column Markdown Tables: | Term/Key | Definition/Value |
 * 9. Formulas: Formula names with LaTeX expressions ($...$ or $$...$$)
 * 10. Callouts: > [!NOTE], > [!DEFINITION], > [!THEOREM], > [!FORMULA]
 * 11. Enumerations: "Key points:" followed by 2-7 numbered/bulleted items
 */
export function extractFlashcardsHeuristic(
  content: string,
  notePath?: string,
  noteTitle?: string,
  targetDeck = 'Generale'
): GeneratedFlashcardDraft[] {
  const drafts: GeneratedFlashcardDraft[] = [];
  const lines = content.split('\n');
  const seenFronts = new Set<string>();

  const addDraft = (draft: Omit<GeneratedFlashcardDraft, 'id' | 'selected'>) => {
    const cleanFront = draft.front.trim();
    const cleanBack = draft.back.trim();
    if (cleanFront.length < 3 || cleanBack.length < 2) return;
    const key = cleanFront.toLowerCase().replace(/\s+/g, ' ');
    if (seenFronts.has(key)) return;
    seenFronts.add(key);

    drafts.push({
      id: generateDraftId(draft.sourceType),
      front: cleanFront,
      back: cleanBack,
      deck: draft.deck || targetDeck || 'Generale',
      tags: draft.tags || [],
      sourceType: draft.sourceType,
      selected: true,
      notePath,
      noteTitle,
    });
  };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip empty lines or code fences
    if (!trimmed || trimmed.startsWith('```') || trimmed.startsWith('---')) {
      i++;
      continue;
    }

    // 1. Cloze Deletions: {c1::hidden} or {c1::hidden|hint} or {{c1::hidden}}
    const clozeMatches = Array.from(rawLine.matchAll(/\{{1,2}c?(\d*)::(.+?)\}{1,2}/g));
    if (clozeMatches.length > 0) {
      const clozeIndices = Array.from(
        new Set(clozeMatches.map((m, idx) => (m[1] ? parseInt(m[1], 10) : idx + 1)))
      );

      for (const cIndex of clozeIndices) {
        let frontText = rawLine;
        let answerText = '';

        let matchCounter = 0;
        frontText = frontText.replace(/\{{1,2}c?(\d*)::(.+?)\}{1,2}/g, (_match, num, hidden) => {
          matchCounter++;
          const idx = num ? parseInt(num, 10) : matchCounter;
          if (idx === cIndex) {
            if (hidden.includes('|')) {
              const [ans, hint] = hidden.split('|');
              answerText = ans.trim();
              return `[... (${hint.trim()})]`;
            }
            answerText = hidden.trim();
            return `[...]`;
          }
          return hidden.split('|')[0].trim();
        });

        const cleanFront = frontText.replace(/^\s*[-*]\s*/, '').trim();
        addDraft({
          front: cleanFront,
          back: answerText,
          deck: targetDeck,
          tags: ['cloze', `c${cIndex}`],
          sourceType: 'cloze',
        });
      }
      i++;
      continue;
    }

    // 2. Highlights as Cloze: ==text to memorize==
    const highlightMatches = Array.from(rawLine.matchAll(/==([^=]+?)==/g));
    if (highlightMatches.length > 0) {
      highlightMatches.forEach((m, hIdx) => {
        const highlightedTerm = m[1].trim();
        if (highlightedTerm.length >= 2 && highlightedTerm.length <= 80) {
          let currIdx = 0;
          const frontText = rawLine.replace(/==([^=]+?)==/g, (_sub, term) => {
            if (currIdx === hIdx) {
              currIdx++;
              return '[...]';
            }
            currIdx++;
            return term;
          });
          const cleanFront = frontText.replace(/^\s*[-*]\s*/, '').trim();
          addDraft({
            front: cleanFront,
            back: highlightedTerm,
            deck: targetDeck,
            tags: ['cloze', 'highlight'],
            sourceType: 'highlight',
          });
        }
      });
    }

    // 3. Inline Q&A: Domanda :: Risposta
    const inlineMatch = rawLine.match(/^(\s*[-*]\s*)?([^:\n]+?)\s*::\s*([^\n]+)$/);
    if (inlineMatch) {
      const q = inlineMatch[2].replace(/^\s*[-*]\s*/, '').trim();
      const a = inlineMatch[3].trim();
      if (q && a) {
        addDraft({
          front: q,
          back: a,
          deck: targetDeck,
          tags: ['q-and-a'],
          sourceType: 'qa_inline',
        });
      }
      i++;
      continue;
    }

    // 4. Multi-line Q / ? / A  (Anki style)
    if (i + 2 < lines.length && lines[i + 1].trim() === '?') {
      const question = trimmed.replace(/^\s*[-*]\s*/, '');
      let answer = lines[i + 2].trim();
      let j = i + 3;
      while (j < lines.length && lines[j].trim() && !lines[j].trim().startsWith('#') && lines[j].trim() !== '?') {
        answer += '\n' + lines[j].trim();
        j++;
      }
      addDraft({
        front: question,
        back: answer,
        deck: targetDeck,
        tags: ['multiline'],
        sourceType: 'multiline',
      });
      i = j;
      continue;
    }

    // 5. Natural Questions: Line ending in '?' or starting with Italian/English interrogative words
    const isInterrogative =
      trimmed.endsWith('?') ||
      /^(cos[''’]è|che cos[''’]è|cosa si intende per|qual[eè]|quali sono|come funziona|perch[eè]|quando|definire|spiegare|what is|how does|why|explain)\b/i.test(
        trimmed
      );

    if (isInterrogative && !trimmed.startsWith('#') && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      if (nextLine && !nextLine.startsWith('#') && !nextLine.endsWith('?') && nextLine !== '---' && !nextLine.startsWith('|')) {
        let answer = nextLine;
        let j = i + 2;
        while (j < lines.length) {
          const l = lines[j].trim();
          if (!l || l.startsWith('#') || l.endsWith('?') || l.startsWith('```') || l.startsWith('|') || l.startsWith('---')) break;
          answer += '\n' + l;
          j++;
        }
        addDraft({
          front: trimmed.replace(/^\s*[-*]\s*/, ''),
          back: answer,
          deck: targetDeck,
          tags: ['domanda'],
          sourceType: 'qa_inline',
        });
        i = j;
        continue;
      }
    }

    // 6. Question Headings: e.g. "## Cos'è il polimorfismo?" or "### Proprietà di ACID?"
    const headingMatch = rawLine.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const headingText = headingMatch[2].trim();
      const isQuestionHeading =
        headingText.endsWith('?') ||
        /^(cos[''’]è|che cos[''’]è|cosa si intende per|qual[eè]|quali sono|come funziona|perch[eè]|quando|what is|how does|why)\b/i.test(
          headingText
        );

      if (isQuestionHeading && i + 1 < lines.length) {
        let sectionBody = '';
        let j = i + 1;
        while (j < lines.length) {
          const l = lines[j].trim();
          if (!l || l.startsWith('#') || l.startsWith('|') || l.startsWith('---')) break;
          sectionBody += (sectionBody ? '\n' : '') + l;
          j++;
        }
        if (sectionBody.length > 5) {
          addDraft({
            front: headingText,
            back: sectionBody,
            deck: targetDeck,
            tags: ['heading-qa'],
            sourceType: 'question_heading',
          });
          i = j;
          continue;
        }
      }
    }

    // 7. Definitions: **Termine**: Spiegazione oppure - **Termine** - Spiegazione
    const defMatch = rawLine.match(/^\s*(?:[-*]\s*)?(?:\*\*([^*]+)\*\*|__([^_]+)__)\s*(?::|—|-|:\s*)\s*(.+)$/);
    if (defMatch) {
      const term = (defMatch[1] || defMatch[2]).trim();
      const explanation = defMatch[3].trim();
      if (term.length > 1 && explanation.length > 5 && !explanation.startsWith('http')) {
        addDraft({
          front: `Cos'è o come si definisce "${term}"?`,
          back: explanation,
          deck: targetDeck,
          tags: ['definizione', term.toLowerCase().replace(/[^a-z0-9]/gi, '-')],
          sourceType: 'definition',
        });
        i++;
        continue;
      }
    }

    // 8. Markdown 2-Column Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && i + 2 < lines.length) {
      const headerLine = trimmed;
      const separatorLine = lines[i + 1].trim();
      if (separatorLine.includes('---')) {
        const headers = headerLine
          .split('|')
          .slice(1, -1)
          .map((h) => h.trim());

        if (headers.length === 2) {
          const [col1Header, col2Header] = headers;
          let j = i + 2;
          while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) {
            const cells = lines[j]
              .trim()
              .split('|')
              .slice(1, -1)
              .map((c) => c.trim());

            if (cells.length === 2 && cells[0] && cells[1]) {
              const q = col1Header && !/colonna/i.test(col1Header)
                ? `[${col1Header}] ${cells[0]}`
                : cells[0];
              const a = col2Header && !/colonna/i.test(col2Header)
                ? `${cells[1]} (${col2Header})`
                : cells[1];

              addDraft({
                front: q,
                back: a,
                deck: targetDeck,
                tags: ['tabella', col1Header.toLowerCase()],
                sourceType: 'table',
              });
            }
            j++;
          }
          i = j;
          continue;
        }
      }
    }

    // 9. Callouts: > [!NOTE] Titolo oppure > [!DEFINITION] Titolo
    const calloutHeaderMatch = rawLine.match(/^>\s*\[!(NOTE|DEFINITION|IMPORTANT|TIP|CAUTION|THEOREM|FORMULA)\]\s*(.*)$/i);
    if (calloutHeaderMatch) {
      const calloutType = calloutHeaderMatch[1].toUpperCase();
      const defaultLabels: Record<string, string> = {
        DEFINITION: 'Definizione',
        THEOREM: 'Teorema',
        FORMULA: 'Formula',
        IMPORTANT: 'Concetto Fondamentale',
        NOTE: 'Concetto Chiave',
        TIP: 'Suggerimento Chiave',
        CAUTION: 'Attenzione / Trabocchetto',
      };
      const calloutTitle = calloutHeaderMatch[2].trim() || defaultLabels[calloutType] || 'Concetto Chiave';
      let calloutBody = '';
      let j = i + 1;
      while (j < lines.length && lines[j].trim().startsWith('>')) {
        const bodyLine = lines[j].replace(/^>\s?/, '').trim();
        if (bodyLine) {
          calloutBody += (calloutBody ? '\n' : '') + bodyLine;
        }
        j++;
      }
      if (calloutBody.length > 5) {
        addDraft({
          front: `Enuncia o spiega: ${calloutTitle}`,
          back: calloutBody,
          deck: targetDeck,
          tags: ['callout', calloutType.toLowerCase()],
          sourceType: 'callout',
        });
      }
      i = j;
      continue;
    }

    // 10. Enumerations with title: e.g. "I principi SOLID:" followed by list
    if (trimmed.endsWith(':') && trimmed.length > 5 && i + 1 < lines.length) {
      const listItems: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const itemLine = lines[j].trim();
        const listMatch = itemLine.match(/^(?:[-*]|\d+\.)\s+(.+)$/);
        if (!listMatch) break;
        listItems.push(itemLine);
        j++;
      }
      if (listItems.length >= 2 && listItems.length <= 8) {
        const titleClean = trimmed.slice(0, -1).replace(/^\s*[-*]\s*/, '').trim();
        addDraft({
          front: `Elenca o spiega: ${titleClean}`,
          back: listItems.join('\n'),
          deck: targetDeck,
          tags: ['elenco', 'enumerazione'],
          sourceType: 'enumeration',
        });
        i = j;
        continue;
      }
    }

    // 11. Formula with LaTeX name: e.g. **Legge di Coulomb**: $F = k \frac{q_1 q_2}{r^2}$
    const formulaMatch = rawLine.match(/(?:\*\*([^*]+)\*\*|([A-Za-z0-9\s]{3,40}))\s*:\s*(\${1,2}[^\$]+\${1,2})/);
    if (formulaMatch) {
      const formulaName = (formulaMatch[1] || formulaMatch[2]).trim();
      const formulaLatex = formulaMatch[3].trim();
      if (formulaName.length > 2 && formulaLatex.length > 3) {
        addDraft({
          front: `Formula di: ${formulaName}`,
          back: formulaLatex,
          deck: targetDeck,
          tags: ['formula', 'matematica'],
          sourceType: 'formula',
        });
        i++;
        continue;
      }
    }

    i++;
  }

  return drafts;
}

/**
 * Intelligent JSON Sanitizer & Parser:
 * Fixes common LLM JSON syntax errors, especially unescaped backslashes in LaTeX (\frac, \sum),
 * codeblock wrappers, single quotes, and trailing commas.
 */
export function sanitizeAndParseFlashcardJson(rawText: string): Array<{ front: string; back: string; tags?: string[] }> {
  let text = rawText.trim();

  // Strip code fences
  if (text.includes('```')) {
    text = text.replace(/```(?:json)?([\s\S]*?)```/g, '$1').trim();
  }

  // Extract array portion if surrounded by chat fluff
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    text = text.substring(firstBracket, lastBracket + 1);
  }

  // First try direct parse
  try {
    const direct = JSON.parse(text);
    if (Array.isArray(direct)) return direct;
  } catch {
    // Continue to repair
  }

  // Repair unescaped backslashes in LaTeX formulas (e.g. \frac -> \\frac)
  // Look for backslashes that are NOT followed by valid escape chars: " \ / b f n r t u
  const repaired = text
    .replace(/\\[^"\\/bfnrtu]/g, (match) => '\\' + match)
    .replace(/,\s*([\]}])/g, '$1'); // remove trailing commas

  try {
    const fixed = JSON.parse(repaired);
    if (Array.isArray(fixed)) return fixed;
  } catch {
    // Fallback regex item extractor
    const items: Array<{ front: string; back: string; tags?: string[] }> = [];
    const itemRegex = /"front"\s*:\s*"([\s\S]*?)"\s*,\s*"back"\s*:\s*"([\s\S]*?)"/g;
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      items.push({
        front: match[1].replace(/\\"/g, '"').trim(),
        back: match[2].replace(/\\"/g, '"').trim(),
      });
    }
    if (items.length > 0) return items;
  }

  throw new Error('Impossibile interpretare il formato JSON restituito dall\'AI.');
}

/**
 * AI-Powered Automatic Flashcard Generator:
 * Uses local Ollama or Cloud API (Gemini, Groq, OpenAI) to generate
 * university-level Active Recall flashcards with mathematical LaTeX support.
 */
export async function generateFlashcardsWithAI(
  content: string,
  options: {
    deck?: string;
    notePath?: string;
    noteTitle?: string;
    targetCount?: number;
    style?: FlashcardGenerationStyle;
    customPrompt?: string;
  } = {}
): Promise<GeneratedFlashcardDraft[]> {
  const targetDeck = options.deck || 'Generale';
  const targetCount = options.targetCount || 8;
  const style = options.style || 'exam';
  const aiSettings = loadAISettings();

  if (aiSettings.provider === 'none') {
    throw new Error('Nessun provider AI selezionato. Configura Ollama (locale gratuito) o inserisci una chiave API (Gemini / Groq / OpenAI).');
  }

  const styleInstructions: Record<FlashcardGenerationStyle, string> = {
    exam: 'Focalizzati su domande aperte da esame universitario, trappole concettuali, ragionamento causa-effetto, confronti tra modelli e applicazione pratica.',
    concepts: 'Focalizzati su concetti chiave, principi fondamentali e spiegazioni intuitive dei meccanismi sottostanti.',
    definitions: 'Focalizzati su terminologia esatta, acronimi, definizioni formali e proprietà essenziali.',
    formulas: 'Focalizzati su formule matematiche in KaTeX ($...$ o $$...$$), significato delle variabili, teoremi, passaggi algebrici e ipotesi di validità.',
    cloze: 'Focalizzati su flashcard a completamento (Cloze deletion) inserendo parentesi quadre [...] o definizioni puntuali per memorizzazione rapida.',
  };

  const customInstructionText = options.customPrompt?.trim()
    ? `\nISTRUZIONI SPECIALI AGGIUNTIVE DALL'UTENTE:\n${options.customPrompt.trim()}\n`
    : '';

  const prompt = `Sei un professore universitario e tutor accademico esperto in didattica attiva e ripetizione spaziata (Anki SM-2).
Il tuo obiettivo è creare esattamente ${targetCount} flashcard di altissima qualità a partire dagli appunti forniti.

STILE DI STUDIO RICHIESTO:
${styleInstructions[style]}
${customInstructionText}
REGOLE FONDAMENTALI:
1. "front" (Domanda): chiara, stimolante, in italiano (salvo termini tecnici standard), senza ambiguità.
2. "back" (Risposta): accurata, concisa ed esaustiva (2-4 frasi ben formattate o elenchi puntati).
3. FORMULE: Mantieni rigorosamente la matematica in formato KaTeX: inline con $...$ e in blocco con $$...$$. Quando scrivi LaTeX, fai l'escape corretto dei backslash nel JSON (es. "\\\\frac{a}{b}").
4. FORMATO: Restituisci ESCLUSIVAMENTE un JSON array valido nel formato seguente, senza testo prima o dopo:
[
  {
    "front": "Cosa afferma il Teorema di Nyquist-Shannon?",
    "back": "Afferma che per campionare senza perdita di informazione un segnale a banda limitata, la frequenza di campionamento $f_s$ deve soddisfare: $$f_s \\\\ge 2 f_{\\\\max}$$",
    "tags": ["esame", "teoria-segnali"]
  }
]

APPUNTI DELLO STUDENTE (Titolo: "${options.noteTitle || 'Nota'}"):
${content.slice(0, 14000)}

JSON RISULTANTE:`;

  let rawJsonText = '';

  if (aiSettings.provider === 'ollama') {
    const endpoint = 'http://localhost:11434';
    const model = aiSettings.ollamaModel || 'llama3';
    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json',
      }),
    });
    if (!res.ok) {
      throw new Error(`Errore Ollama (${res.status}): assicurati che Ollama sia in esecuzione (ollama serve).`);
    }
    const data = await res.json();
    rawJsonText = data.response;
  } else if (aiSettings.provider === 'gemini') {
    if (!aiSettings.geminiKey) throw new Error('Chiave API Gemini mancante.');
    // Try gemini-2.0-flash or fallback to gemini-1.5-flash
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${aiSettings.geminiKey.trim()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Errore Gemini API (${res.status}): ${errText || 'Verifica la tua chiave API.'}`);
    }
    const data = await res.json();
    rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else if (aiSettings.provider === 'groq' || aiSettings.provider === 'openai') {
    const apiKey = aiSettings.provider === 'groq' ? aiSettings.groqKey : aiSettings.openaiKey;
    if (!apiKey) throw new Error(`Chiave API ${aiSettings.provider.toUpperCase()} mancante.`);
    const endpoint =
      aiSettings.provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions';
    const model = aiSettings.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Errore ${aiSettings.provider.toUpperCase()} (${res.status}): ${errText || 'Verifica la tua chiave API.'}`);
    }
    const data = await res.json();
    rawJsonText = data.choices?.[0]?.message?.content || '';
  }

  const parsed = sanitizeAndParseFlashcardJson(rawJsonText);

  if (!parsed || parsed.length === 0) {
    throw new Error('Nessuna flashcard generata dall\'AI.');
  }

  return parsed
    .map((item) => ({
      id: generateDraftId('ai'),
      front: (item.front || '').trim(),
      back: (item.back || '').trim(),
      deck: targetDeck,
      tags: Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : ['ai-generated', style],
      sourceType: 'ai' as const,
      selected: true,
      notePath: options.notePath,
      noteTitle: options.noteTitle,
    }))
    .filter((c) => c.front.length > 2 && c.back.length > 0);
}

/**
 * Smart Orchestrator:
 * Generates flashcards with AI when available, always augmenting with
 * any explicit clozes and Q::A defined by the author in the notes.
 */
export async function generateFlashcardsSmart(
  content: string,
  options: {
    deck?: string;
    notePath?: string;
    noteTitle?: string;
    targetCount?: number;
    style?: FlashcardGenerationStyle;
    customPrompt?: string;
    forceHeuristic?: boolean;
  } = {}
): Promise<{ cards: GeneratedFlashcardDraft[]; methodUsed: 'ai' | 'heuristic' | 'hybrid'; error?: string }> {
  const targetDeck = options.deck || 'Generale';
  const heuristicCards = extractFlashcardsHeuristic(content, options.notePath, options.noteTitle, targetDeck);

  if (options.forceHeuristic) {
    return { cards: heuristicCards, methodUsed: 'heuristic' };
  }

  const aiSettings = loadAISettings();
  if (aiSettings.provider === 'none') {
    return { cards: heuristicCards, methodUsed: 'heuristic' };
  }

  try {
    const aiCards = await generateFlashcardsWithAI(content, options);

    // Merge AI cards with high-priority user explicit cards (cloze, inline Q&A, highlighted, formulas)
    const explicitCards = heuristicCards.filter(
      (c) => c.sourceType === 'cloze' || c.sourceType === 'qa_inline' || c.sourceType === 'highlight' || c.sourceType === 'formula'
    );
    const existingFronts = new Set(aiCards.map((c) => c.front.toLowerCase()));

    const uniqueExplicit = explicitCards.filter((c) => !existingFronts.has(c.front.toLowerCase()));
    const merged = [...uniqueExplicit, ...aiCards];

    return {
      cards: merged.length > 0 ? merged : heuristicCards,
      methodUsed: uniqueExplicit.length > 0 ? 'hybrid' : 'ai',
    };
  } catch (err) {
    console.warn('AI generation failed, falling back to heuristic extraction:', err);
    return {
      cards: heuristicCards,
      methodUsed: 'heuristic',
      error: (err as Error).message,
    };
  }
}
