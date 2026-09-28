import React, { useState, useEffect, useMemo } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import type { FlashcardItem, FlashcardRating } from '../types';
import { renderLatexSafe } from '../services/latexSanitizer';
import {
  Brain,
  X,
  CheckCircle2,
  Sparkles,
  FileText,
  Clock,
  BookOpen,
  Filter,
} from 'lucide-react';

/**
 * Helper to render math and inline formatting inside flashcards
 */
function renderCardContent(text: string): React.ReactNode {
  if (!text) return null;

  // Split by inline math $...$
  const mathRegex = /\$([^\s$](?:[^$\n]*?[^\s\\$])?)\$/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = mathRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index));
    }
    const mathContent = match[1];
    const res = renderLatexSafe(mathContent, false);
    parts.push(
      <span
        key={`math-${match.index}`}
        className="inline-math mx-1 text-amber-500 dark:text-amber-400 font-medium"
        dangerouslySetInnerHTML={{ __html: res.html }}
      />
    );
    lastIdx = mathRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return <>{parts}</>;
}

export const FlashcardModal: React.FC = () => {
  const {
    isFlashcardModalOpen,
    flashcardTargetFolder,
    flashcardTargetNotePath,
    flashcards,
    closeFlashcardSession,
    recordCardReview,
    setActiveView,
  } = useVaultStore();

  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'due' | 'all'>('due');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [reviewedSessionCount, setReviewedSessionCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Sync initial target folder when modal opens
  useEffect(() => {
    if (isFlashcardModalOpen) {
      if (flashcardTargetFolder) {
        setSelectedFolder(flashcardTargetFolder);
      } else {
        setSelectedFolder('all');
      }
      setFilterMode('due');
      setCurrentIndex(0);
      setIsRevealed(false);
      setReviewedSessionCount(0);
      setSessionCompleted(false);
    }
  }, [isFlashcardModalOpen, flashcardTargetFolder]);

  // Extract unique decks that have cards
  const availableFolders = useMemo(() => {
    const set = new Set<string>();
    flashcards.forEach((c) => {
      const d = c.deck || c.folder || 'Generale';
      set.add(d);
    });
    return Array.from(set).sort();
  }, [flashcards]);

  // Filter deck cards based on selected folder, note, and due mode
  const activeDeck = useMemo(() => {
    const now = Date.now();
    return flashcards.filter((card) => {
      const d = card.deck || card.folder || 'Generale';
      // Filter by specific note if launched from note
      if (flashcardTargetNotePath && card.notePath !== flashcardTargetNotePath) {
        return false;
      }

      // Filter by deck
      if (selectedFolder !== 'all' && d !== selectedFolder) {
        return false;
      }

      // Filter by due mode
      if (filterMode === 'due') {
        return card.progress.state === 'new' || card.progress.dueDate <= now;
      }

      return true;
    });
  }, [flashcards, selectedFolder, filterMode, flashcardTargetNotePath]);

  const currentCard: FlashcardItem | undefined = activeDeck[currentIndex];

  // Keyboard navigation: Space/Enter = Reveal, 1-4 = Rate, Esc = Close
  useEffect(() => {
    if (!isFlashcardModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFlashcardSession();
        return;
      }

      if (!sessionCompleted && currentCard) {
        if (!isRevealed) {
          if (e.code === 'Space' || e.key === 'Enter') {
            e.preventDefault();
            setIsRevealed(true);
          }
        } else {
          if (e.key === '1') handleRate('again');
          if (e.key === '2') handleRate('hard');
          if (e.key === '3') handleRate('good');
          if (e.key === '4') handleRate('easy');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlashcardModalOpen, isRevealed, sessionCompleted, currentCard]);

  if (!isFlashcardModalOpen) {
    return null;
  }

  const handleRate = (rating: FlashcardRating) => {
    if (!currentCard) return;

    recordCardReview(currentCard.id, rating);
    setReviewedSessionCount((prev) => prev + 1);

    if (currentIndex + 1 < activeDeck.length) {
      setCurrentIndex((prev) => prev + 1);
      setIsRevealed(false);
    } else {
      setSessionCompleted(true);
    }
  };

  const handleOpenFlashcardsSection = () => {
    closeFlashcardSession();
    setActiveView('flashcards');
  };

  // Stats for badge
  const totalDueInDeck = flashcards.filter(
    (c) => c.progress.state === 'new' || c.progress.dueDate <= Date.now()
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl apple-card-item backdrop-blur-2xl bg-[var(--panel-bg)]/95 dark:bg-[var(--panel-bg)]/95 border border-black/10 dark:border-white/15 shadow-2xl overflow-hidden select-none">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <span>Sessione Flashcard</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  SM-2 Anki
                </span>
              </h2>
              <p className="text-[10px] text-[var(--text-muted)]">
                Ripetizione spaziata intelligente integrata nelle tue note
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Folder / Subject Filter */}
            <div className="flex items-center space-x-1.5 bg-black/5 dark:bg-white/5 rounded-xl px-2 py-1 text-xs">
              <Filter size={12} className="text-[var(--text-muted)]" />
              <select
                value={selectedFolder}
                onChange={(e) => {
                  setSelectedFolder(e.target.value);
                  setCurrentIndex(0);
                  setIsRevealed(false);
                  setSessionCompleted(false);
                }}
                className="bg-transparent text-[11px] text-[var(--text-secondary)] focus:outline-none cursor-pointer"
              >
                <option value="all">Tutto il Vault ({flashcards.length})</option>
                {availableFolders.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Mode Switcher: Due vs All */}
            <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-xl text-[11px]">
              <button
                onClick={() => {
                  setFilterMode('due');
                  setCurrentIndex(0);
                  setIsRevealed(false);
                  setSessionCompleted(false);
                }}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  filterMode === 'due'
                    ? 'bg-[var(--card-bg)] text-[var(--accent)] font-semibold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Ripassa solo le carte in scadenza oggi"
              >
                In scadenza ({totalDueInDeck})
              </button>
              <button
                onClick={() => {
                  setFilterMode('all');
                  setCurrentIndex(0);
                  setIsRevealed(false);
                  setSessionCompleted(false);
                }}
                className={`px-2 py-1 rounded-lg transition-colors ${
                  filterMode === 'all'
                    ? 'bg-[var(--card-bg)] text-[var(--accent)] font-semibold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
                title="Tutte le carte (Pratica libera senza scadenze)"
              >
                Tutte
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={closeFlashcardSession}
              className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Chiudi sessione (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto flex flex-col justify-center">
          {sessionCompleted ? (
            /* Session Completed Screen */
            <div className="text-center py-8 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 flex items-center justify-center shadow-apple-md">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Sessione Completata! 🎉
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
                  Hai ripassato con successo <strong>{reviewedSessionCount}</strong> flashcard.
                  L'algoritmo SM-2 ha ricalcolato la curva dell'oblio per le tue prossime ripetizioni.
                </p>
              </div>

              <div className="flex justify-center space-x-3 pt-2">
                <button
                  onClick={() => {
                    setFilterMode('all');
                    setCurrentIndex(0);
                    setIsRevealed(false);
                    setSessionCompleted(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-semibold text-[var(--text-secondary)] transition-colors"
                >
                  Pratica Libera su Tutte
                </button>
                <button
                  onClick={closeFlashcardSession}
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold shadow-apple-sm transition-all"
                >
                  Torna agli Appunti
                </button>
              </div>
            </div>
          ) : activeDeck.length === 0 ? (
            /* Empty State */
            <div className="text-center py-8 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <BookOpen size={28} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)]">
                  Nessuna Flashcard {filterMode === 'due' ? 'in Scadenza Oggi' : 'Trovata'}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto leading-relaxed">
                  {filterMode === 'due'
                    ? 'Ottimo lavoro! Tutte le carte di questa materia sono già state ripassate. Passa alla modalità "Tutte" se vuoi fare un ripasso libero.'
                    : 'Puoi creare flashcard direttamente nei tuoi appunti usando una di queste due sintassi:'}
                </p>
              </div>

              {/* Syntax Guide Box */}
              <div className="max-w-md mx-auto p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-left text-xs space-y-2 font-mono">
                <div>
                  <span className="text-[var(--accent)] font-semibold">1. Domanda / Risposta:</span>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    Cos'è un semaforo?::Una variabile per mutua esclusione.
                  </div>
                </div>
                <div>
                  <span className="text-[var(--accent)] font-semibold">2. Testo Nascosto (Cloze):</span>
                  <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    L'architettura x86 è {'{c1::CISC}'}, ARM è {'{c2::RISC}'}.
                  </div>
                </div>
              </div>

              <button
                onClick={handleOpenFlashcardsSection}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-apple-sm transition-all inline-flex items-center gap-1.5"
              >
                <Sparkles size={13} />
                <span>Apri Sezione Flashcards Standalone</span>
              </button>
            </div>
          ) : currentCard ? (
            /* Active Flashcard Review View */
            <div className="space-y-5">
              {/* Progress & Breadcrumb */}
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <div className="flex items-center space-x-1.5 truncate max-w-sm">
                  <FileText size={12} className="text-[var(--accent)] shrink-0" />
                  <span className="truncate font-medium">{currentCard.noteTitle}</span>
                  <span>/</span>
                  <span className="truncate text-[10px]">{currentCard.folder}</span>
                </div>
                <div className="font-mono text-xs">
                  {currentIndex + 1} / {activeDeck.length}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${((currentIndex + 1) / activeDeck.length) * 100}%` }}
                />
              </div>

              {/* Card Container */}
              <div className="min-h-[220px] p-6 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/10 dark:border-white/10 flex flex-col justify-between shadow-apple-sm">
                {/* Front (Question / Masked) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      {currentCard.type === 'cloze' ? 'Completa la frase (Cloze)' : 'Domanda'}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                      <Clock size={10} />
                      <span>
                        {currentCard.progress.state === 'new'
                          ? 'Nuova'
                          : `Intervallo: ${currentCard.progress.interval}g`}
                      </span>
                    </span>
                  </div>

                  <div className="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-relaxed pt-1">
                    {renderCardContent(currentCard.front)}
                  </div>
                </div>

                {/* Back (Revealed Answer) */}
                {isRevealed ? (
                  <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      Risposta Esatta
                    </div>
                    <div className="text-base font-medium text-emerald-700 dark:text-emerald-300 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      {renderCardContent(currentCard.back)}
                    </div>
                  </div>
                ) : (
                  <div className="pt-6 flex justify-center">
                    <button
                      onClick={() => setIsRevealed(true)}
                      className="px-6 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold shadow-apple-md transition-all flex items-center space-x-2 group hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <span>Mostra Risposta</span>
                      <span className="text-[10px] opacity-75 font-mono">(Spazio)</span>
                    </button>
                  </div>
                )}
              </div>

              {/* SM-2 Rating Buttons (Shown after answer is revealed) */}
              {isRevealed && (
                <div className="grid grid-cols-4 gap-2 pt-2 animate-in fade-in duration-150">
                  <button
                    onClick={() => handleRate('again')}
                    className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all text-center group"
                  >
                    <div className="font-bold text-xs">[1] Ripeti</div>
                    <div className="text-[10px] opacity-75">&lt; 1 giorno</div>
                  </button>

                  <button
                    onClick={() => handleRate('hard')}
                    className="p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-all text-center group"
                  >
                    <div className="font-bold text-xs">[2] Difficile</div>
                    <div className="text-[10px] opacity-75">
                      {Math.max(1, Math.round(currentCard.progress.interval * 1.2))}g
                    </div>
                  </button>

                  <button
                    onClick={() => handleRate('good')}
                    className="p-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all text-center group"
                  >
                    <div className="font-bold text-xs">[3] Buono</div>
                    <div className="text-[10px] opacity-75">
                      {currentCard.progress.repetition === 0
                        ? '1g'
                        : currentCard.progress.repetition === 1
                        ? '6g'
                        : `${Math.round(currentCard.progress.interval * currentCard.progress.easeFactor)}g`}
                    </div>
                  </button>

                  <button
                    onClick={() => handleRate('easy')}
                    className="p-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 transition-all text-center group"
                  >
                    <div className="font-bold text-xs">[4] Facile</div>
                    <div className="text-[10px] opacity-75">
                      {currentCard.progress.repetition === 0
                        ? '4g'
                        : `${Math.round(currentCard.progress.interval * currentCard.progress.easeFactor * 1.3)}g`}
                    </div>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Hint */}
        <div className="px-5 py-2.5 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[11px] text-[var(--text-muted)] bg-black/[0.01] dark:bg-white/[0.01]">
          <span>💡 Scorciatoie: Spazio per mostrare • 1, 2, 3, 4 per valutare • Esc per uscire</span>
          <span>Algoritmo SuperMemo SM-2</span>
        </div>
      </div>
    </div>
  );
};
