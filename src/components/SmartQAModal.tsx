import React, { useState, useEffect, useRef } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import {
  semanticSearchEngine,
  checkOllamaAvailability,
  generateOllamaAnswer,
} from '../services/semanticSearchService';
import type { SmartQAResponse } from '../services/semanticSearchService';
import { renderLatexSafe } from '../services/latexSanitizer';
import {
  Bot,
  Search,
  Sparkles,
  X,
  FileText,
  CornerDownLeft,
  Copy,
  Check,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  Cpu,
  Brain,
  Layers,
} from 'lucide-react';

/**
 * Render text with inline KaTeX formulas
 */
function renderAnswerText(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2);
      const res = renderLatexSafe(math, true);
      return (
        <div
          key={idx}
          className="my-2 py-1.5 px-3 rounded-xl bg-black/5 dark:bg-white/5 overflow-x-auto text-center font-mono text-xs"
          dangerouslySetInnerHTML={{ __html: res.html }}
        />
      );
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1);
      const res = renderLatexSafe(math, false);
      return (
        <span
          key={idx}
          className="mx-0.5 inline-block align-baseline font-mono text-xs"
          dangerouslySetInnerHTML={{ __html: res.html }}
        />
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

const SAMPLE_QUESTIONS = [
  "Cos'è un semaforo di Dijkstra?",
  'Quali sono le 4 condizioni necessarie per un deadlock?',
  'Come si calcola il complemento a due?',
  'Differenza fondamentale tra malloc() e calloc()?',
  'Cos\'è una porta logica NAND e perché è universale?',
];

export const SmartQAModal: React.FC = () => {
  const {
    isSmartQAModalOpen,
    smartQAInitialQuestion,
    closeSmartQAModal,
    selectNote,
    updateActiveContent,
    activeNoteContent,
    activeNotePath,
    notes,
    addFlashcard,
  } = useVaultStore();

  const [question, setQuestion] = useState('');
  const [qaResult, setQaResult] = useState<SmartQAResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);

  // Local Ollama state
  const [ollamaActive, setOllamaActive] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [useOllama, setUseOllama] = useState(false);
  const [ollamaLoading, setOllamaLoading] = useState(false);
  const [generativeAnswer, setGenerativeAnswer] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Check Ollama on open
  useEffect(() => {
    if (isSmartQAModalOpen) {
      checkOllamaAvailability().then(({ isAvailable, models }) => {
        setOllamaActive(isAvailable);
        setOllamaModels(models);
        if (isAvailable && models.length > 0) {
          setUseOllama(true);
        }
      });

      if (smartQAInitialQuestion) {
        setQuestion(smartQAInitialQuestion);
        handleAskQuestion(smartQAInitialQuestion);
      } else {
        setQuestion('');
        setQaResult(null);
        setGenerativeAnswer(null);
      }

      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isSmartQAModalOpen, smartQAInitialQuestion]);

  // Global ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSmartQAModalOpen) {
        e.preventDefault();
        closeSmartQAModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSmartQAModalOpen, closeSmartQAModal]);

  // Execute Question
  const handleAskQuestion = async (queryText: string) => {
    const clean = queryText.trim();
    if (!clean) return;

    setIsSearching(true);
    setGenerativeAnswer(null);

    try {
      // 1. Semantic Extractive Q&A
      const result = semanticSearchEngine.answerQuestion(clean);
      setQaResult(result);

      // 2. If user enabled Ollama and it's active, generate synthesis
      if (useOllama && ollamaActive && result.sources.length > 0) {
        setOllamaLoading(true);
        try {
          const modelToUse = ollamaModels.length > 0 ? ollamaModels[0] : 'llama3';
          const snippets = result.sources.map(
            (s) => `[Da nota "${s.noteTitle}" - ${s.sectionHeader}]:\n${s.snippet}`
          );
          const gen = await generateOllamaAnswer(clean, snippets, modelToUse);
          setGenerativeAnswer(gen);
        } catch (genErr) {
          console.warn('Ollama generation failed, falling back to extractive answer:', genErr);
        } finally {
          setOllamaLoading(false);
        }
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyAnswer = () => {
    const textToCopy = generativeAnswer || qaResult?.directAnswer || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertIntoNote = () => {
    if (!activeNotePath) {
      alert('Apri prima una nota nell\'editor per inserire la risposta.');
      return;
    }
    const answer = generativeAnswer || qaResult?.directAnswer || '';
    const citation = qaResult?.sources?.[0]?.noteTitle
      ? `\n> *Fonte: [[${qaResult.sources[0].noteTitle}]]*`
      : '';
    const blockToInsert = `\n### 💡 Domanda: ${question}\n${answer}\n${citation}\n`;

    const newContent = activeNoteContent ? `${activeNoteContent}\n${blockToInsert}` : blockToInsert;
    updateActiveContent(newContent);
    setInserted(true);
    setTimeout(() => setInserted(false), 2000);
  };

  const handleConvertToFlashcard = async () => {
    const answer = (qaResult?.directAnswer || generativeAnswer || '').trim();
    if (!question.trim() || !answer) {
      alert('Non c\'è una domanda o risposta valida da convertire in flashcard.');
      return;
    }

    const currentNote = notes.find((n) => n.path === activeNotePath);
    const targetDeck = currentNote?.folder || 'Smart Q&A';

    await addFlashcard({
      deck: targetDeck,
      front: question.trim(),
      back: answer,
      notePath: activeNotePath || undefined,
      noteTitle: currentNote?.title,
    });

    alert(`Flashcard creata con successo nel mazzo "${targetDeck}"! Puoi ripassarla nella sezione Flashcards.`);
  };

  if (!isSmartQAModalOpen) return null;

  return (
    <div
      onClick={closeSmartQAModal}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] rounded-2xl apple-card-item shadow-2xl border border-black/15 dark:border-white/15 overflow-hidden flex flex-col bg-[var(--card-bg)] text-[var(--text-primary)] transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-black/10 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-xs">
              <Bot size={17} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">Chiedi al Vault: Ricerca Semantica & Smart Q&A</h2>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                  Vector + BM25 ~60MB
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                Interroga i tuoi appunti in linguaggio naturale con comprensione semantica offline
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Ollama Toggle if available */}
            {ollamaActive && (
              <button
                onClick={() => setUseOllama(!useOllama)}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors border ${
                  useOllama
                    ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-medium'
                    : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] border-transparent'
                }`}
                title="Generazione espansa con modello LLM locale Ollama"
              >
                <Cpu size={13} />
                <span className="text-[11px]">Ollama RAG ({ollamaModels[0] || 'attivo'})</span>
              </button>
            )}

            <button
              onClick={closeSmartQAModal}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(question);
            }}
            className="relative flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-3.5 text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Fai una domanda sui tuoi appunti (es. 'Come funziona il complemento a due?')..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-black/15 dark:border-white/15 bg-[var(--card-bg)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] shadow-xs transition-all"
              />
              {question && (
                <button
                  type="button"
                  onClick={() => setQuestion('')}
                  className="absolute right-3 top-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!question.trim() || isSearching}
              className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white hover:opacity-90 font-medium text-xs shadow-apple-sm transition-all disabled:opacity-50 shrink-0"
            >
              {isSearching ? (
                <>
                  <Sparkles size={14} className="animate-spin" />
                  <span>Ricerca...</span>
                </>
              ) : (
                <>
                  <span>Chiedi</span>
                  <CornerDownLeft size={13} />
                </>
              )}
            </button>
          </form>

          {/* Quick Suggestions */}
          {!qaResult && (
            <div className="pt-3">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles size={10} className="text-amber-500" />
                <span>Domande consigliate sui tuoi appunti</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_QUESTIONS.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuestion(sq);
                      handleAskQuestion(sq);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400 text-[var(--text-secondary)] border border-black/5 dark:border-white/5 transition-colors text-left"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content & Results Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {qaResult ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Direct Answer Card */}
              <div className="p-4 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--accent)]/30 shadow-apple-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {generativeAnswer ? 'Sintesi Generativa LLM (RAG)' : 'Risposta Diretta Estratta dal Vault'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] font-bold">
                      {qaResult.confidence}% Rilevanza
                    </span>
                  </div>
                </div>

                {/* Answer Text */}
                <div className="text-xs text-[var(--text-primary)] leading-relaxed select-text font-sans">
                  {ollamaLoading ? (
                    <div className="flex items-center space-x-2 text-[var(--text-muted)] py-2">
                      <Sparkles size={14} className="animate-spin text-purple-500" />
                      <span>Generazione sintesi con modello locale in corso...</span>
                    </div>
                  ) : (
                    renderAnswerText(generativeAnswer || qaResult.directAnswer)
                  )}
                </div>

                {/* Action Buttons Toolbar */}
                <div className="pt-2 border-t border-[var(--accent)]/20 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="text-[11px] text-[var(--text-muted)] truncate max-w-sm">
                    {qaResult.summary}
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={handleCopyAnswer}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors text-[11px]"
                      title="Copia negli appunti"
                    >
                      {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      <span>{copied ? 'Copiato!' : 'Copia'}</span>
                    </button>

                    <button
                      onClick={handleInsertIntoNote}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-secondary)] transition-colors text-[11px]"
                      title="Inserisci risposta nella nota aperta"
                    >
                      {inserted ? <Check size={12} className="text-emerald-500" /> : <PlusCircle size={12} />}
                      <span>{inserted ? 'Inserito!' : 'Inserisci nella Nota'}</span>
                    </button>

                    <button
                      onClick={handleConvertToFlashcard}
                      className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 transition-colors text-[11px] font-medium"
                      title="Crea una flashcard SM-2 con questa domanda e risposta"
                    >
                      <Brain size={12} />
                      <span>Crea Flashcard</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Related Concepts / WikiLinks */}
              {qaResult.relatedConcepts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Concetti & WikiLinks Correlati
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {qaResult.relatedConcepts.map((concept, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const matchingNote = useVaultStore
                            .getState()
                            .notes.find((n) => n.title.toLowerCase() === concept.toLowerCase());
                          if (matchingNote) {
                            selectNote(matchingNote.path);
                            closeSmartQAModal();
                          }
                        }}
                        className="flex items-center space-x-1 text-xs px-2.5 py-1 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-[var(--accent-subtle)] text-[var(--accent)] transition-colors"
                      >
                        <span>[[{concept}]]</span>
                        <ChevronRight size={11} className="opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sources Section */}
              <div className="space-y-2">
                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
                  <span>Fonti & Citazioni dal Vault ({qaResult.sources.length})</span>
                  <span className="text-[9px] font-normal lowercase">Clicca su una nota per aprirla</span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {qaResult.sources.map((src, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        selectNote(src.notePath);
                        closeSmartQAModal();
                      }}
                      className="p-3 rounded-xl border border-black/10 dark:border-white/10 hover:border-[var(--accent)] bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/5 dark:hover:bg-white/5 transition-all cursor-pointer group space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText size={13} className="text-[var(--accent)] shrink-0" />
                          <span className="font-semibold text-xs text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                            {src.noteTitle}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">/ {src.sectionHeader}</span>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {src.score}% match
                          </span>
                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent)]" />
                        </div>
                      </div>

                      <div className="text-[11px] text-[var(--text-secondary)] line-clamp-3 leading-relaxed font-mono bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                        {renderAnswerText(src.snippet)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Empty State Guide */
            <div className="py-10 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Ricerca Intelligente & Assistente allo Studio
                </h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  NoteRip indicizza semanticamente i tuoi appunti tramite <strong>vettori densi</strong> e <strong>BM25</strong>.
                  Trova risposte anche quando la domanda usa sinonimi o parole diverse rispetto alle tue note.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-left text-xs space-y-1.5">
                <div className="font-semibold text-[11px] text-[var(--text-primary)] flex items-center gap-1.5">
                  <Layers size={13} className="text-amber-500" />
                  <span>Vantaggi della soluzione &lt; 80 MB:</span>
                </div>
                <ul className="text-[10px] text-[var(--text-muted)] space-y-1 list-disc pl-4">
                  <li>Nessun download pesante di 4-8 GB da Internet</li>
                  <li>Funziona al 100% offline sul tuo laptop senza connessione</li>
                  <li>Risposte istantanee in meno di 20 millisecondi</li>
                  <li>Supporto trasparente per Ollama locale se vuoi risposte generative</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Indice Semantico Locale Sempre Attivo</span>
          </div>

          <div className="flex items-center space-x-2">
            <span>Premi <kbd className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 font-mono text-[10px]">ESC</kbd> per chiudere</span>
          </div>
        </div>
      </div>
    </div>
  );
};
