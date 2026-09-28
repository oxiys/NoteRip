import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import type { FlashcardItem, FlashcardRating } from '../types';
import { renderLatexSafe } from '../services/latexSanitizer';
import {
  Brain,
  Plus,
  Play,
  Search,
  Trash2,
  Edit3,
  RotateCcw,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Calendar,
  Layers,
  GraduationCap,
  ArrowLeft,
  X,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';

/**
 * Helper to render math and inline formatting inside flashcards
 */
function renderCardText(text: string): React.ReactNode {
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

export const FlashcardsView: React.FC = () => {
  const {
    flashcards,
    addFlashcard,
    updateFlashcard,
    deleteFlashcard,
    resetFlashcardProgress,
    recordCardReview,
    notes,
    selectNote,
    setActiveView,
  } = useVaultStore();

  // Navigation & filtering state
  const [selectedDeck, setSelectedDeck] = useState<string>('all');
  const [filterMode, setFilterMode] = useState<'all' | 'due' | 'new' | 'learning' | 'mastered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // New deck input state
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckInput, setNewDeckInput] = useState('');

  // Card editor modal state
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardDeck, setCardDeck] = useState('');
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardNotePath, setCardNotePath] = useState('');

  // Study session state
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [studyQueue, setStudyQueue] = useState<FlashcardItem[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Extract unique deck names
  const availableDecks = useMemo(() => {
    const deckSet = new Set<string>();
    flashcards.forEach((c) => {
      const d = c.deck || c.folder || 'Generale';
      deckSet.add(d);
    });
    return Array.from(deckSet).sort();
  }, [flashcards]);

  // Deck statistics
  const deckStats = useMemo(() => {
    const now = Date.now();
    const stats: Record<string, { total: number; due: number; new: number; learning: number; mastered: number }> = {
      all: { total: 0, due: 0, new: 0, learning: 0, mastered: 0 },
    };

    flashcards.forEach((c) => {
      const d = c.deck || c.folder || 'Generale';
      if (!stats[d]) {
        stats[d] = { total: 0, due: 0, new: 0, learning: 0, mastered: 0 };
      }

      stats[d].total += 1;
      stats.all.total += 1;

      const isDue = c.progress.state === 'new' || c.progress.dueDate <= now;
      if (isDue) {
        stats[d].due += 1;
        stats.all.due += 1;
      }

      if (c.progress.state === 'new') {
        stats[d].new += 1;
        stats.all.new += 1;
      } else if (c.progress.interval >= 21) {
        stats[d].mastered += 1;
        stats.all.mastered += 1;
      } else {
        stats[d].learning += 1;
        stats.all.learning += 1;
      }
    });

    return stats;
  }, [flashcards]);

  // Filtered cards for management view
  const filteredCards = useMemo(() => {
    const now = Date.now();
    const q = searchQuery.trim().toLowerCase();

    return flashcards.filter((c) => {
      const deckName = c.deck || c.folder || 'Generale';
      if (selectedDeck !== 'all' && deckName !== selectedDeck) {
        return false;
      }

      if (filterMode === 'due') {
        const isDue = c.progress.state === 'new' || c.progress.dueDate <= now;
        if (!isDue) return false;
      } else if (filterMode === 'new') {
        if (c.progress.state !== 'new') return false;
      } else if (filterMode === 'learning') {
        if (c.progress.state === 'new' || c.progress.interval >= 21) return false;
      } else if (filterMode === 'mastered') {
        if (c.progress.interval < 21) return false;
      }

      if (q) {
        const matchFront = c.front.toLowerCase().includes(q);
        const matchBack = c.back.toLowerCase().includes(q);
        const matchDeck = deckName.toLowerCase().includes(q);
        if (!matchFront && !matchBack && !matchDeck) return false;
      }

      return true;
    });
  }, [flashcards, selectedDeck, filterMode, searchQuery]);

  // Start study session for current deck or all
  const startStudySession = (deckName: string, onlyDue = true) => {
    const now = Date.now();
    const candidates = flashcards.filter((c) => {
      const d = c.deck || c.folder || 'Generale';
      if (deckName !== 'all' && d !== deckName) return false;
      if (onlyDue) {
        return c.progress.state === 'new' || c.progress.dueDate <= now;
      }
      return true;
    });

    // Shuffle candidates for better spaced recall
    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

    setStudyQueue(shuffled);
    setStudyIndex(0);
    setIsAnswerRevealed(false);
    setSessionReviewedCount(0);
    setSessionCompleted(false);
    setIsStudyMode(true);
  };

  const currentStudyCard = studyQueue[studyIndex];

  // Rate current card during study
  const handleRateCard = useCallback(
    async (rating: FlashcardRating) => {
      if (!currentStudyCard) return;

      await recordCardReview(currentStudyCard.id, rating);
      setSessionReviewedCount((prev) => prev + 1);

      if (studyIndex + 1 < studyQueue.length) {
        setStudyIndex((prev) => prev + 1);
        setIsAnswerRevealed(false);
      } else {
        setSessionCompleted(true);
      }
    },
    [currentStudyCard, studyIndex, studyQueue.length, recordCardReview]
  );

  // Keyboard controls for study mode
  useEffect(() => {
    if (!isStudyMode || sessionCompleted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsStudyMode(false);
        return;
      }

      if (!isAnswerRevealed) {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          setIsAnswerRevealed(true);
        }
      } else {
        if (e.key === '1') handleRateCard('again');
        if (e.key === '2') handleRateCard('hard');
        if (e.key === '3') handleRateCard('good');
        if (e.key === '4') handleRateCard('easy');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStudyMode, isAnswerRevealed, sessionCompleted, handleRateCard]);

  // Open modal to create card
  const handleOpenCreateModal = () => {
    setEditingCardId(null);
    setCardDeck(selectedDeck !== 'all' ? selectedDeck : (availableDecks[0] || 'Generale'));
    setCardFront('');
    setCardBack('');
    setCardNotePath('');
    setIsEditorModalOpen(true);
  };

  // Open modal to edit card
  const handleOpenEditModal = (card: FlashcardItem) => {
    setEditingCardId(card.id);
    setCardDeck(card.deck || card.folder || 'Generale');
    setCardFront(card.front);
    setCardBack(card.back);
    setCardNotePath(card.notePath || '');
    setIsEditorModalOpen(true);
  };

  // Save new or edited card
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardFront.trim() || !cardBack.trim()) return;

    const deckName = cardDeck.trim() || 'Generale';
    const note = notes.find((n) => n.path === cardNotePath);

    if (editingCardId) {
      await updateFlashcard(editingCardId, {
        deck: deckName,
        front: cardFront.trim(),
        back: cardBack.trim(),
        notePath: cardNotePath || undefined,
        noteTitle: note?.title,
      });
    } else {
      await addFlashcard({
        deck: deckName,
        front: cardFront.trim(),
        back: cardBack.trim(),
        notePath: cardNotePath || undefined,
        noteTitle: note?.title,
      });
    }

    setIsEditorModalOpen(false);
  };

  // Add new deck
  const handleCreateDeckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDeckInput.trim();
    if (!trimmed) return;
    setSelectedDeck(trimmed);
    setNewDeckInput('');
    setIsCreatingDeck(false);
    // Open new card modal immediately for the new deck
    setEditingCardId(null);
    setCardDeck(trimmed);
    setCardFront('');
    setCardBack('');
    setCardNotePath('');
    setIsEditorModalOpen(true);
  };

  const activeStats = deckStats[selectedDeck] || { total: 0, due: 0, new: 0, learning: 0, mastered: 0 };

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-12 border-b border-black/5 dark:border-white/10 px-5 flex items-center justify-between bg-black/[0.015] dark:bg-white/[0.015] shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveView('notes')}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Torna alle Note"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400">
              <Brain size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold flex items-center gap-2">
                <span>Flashcards & Spaced Repetition</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  SM-2
                </span>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick study button */}
          <button
            onClick={() => startStudySession(selectedDeck, true)}
            disabled={activeStats.due === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-apple-sm ${
              activeStats.due > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] cursor-not-allowed opacity-60'
            }`}
            title={activeStats.due > 0 ? 'Ripassa le carte in scadenza oggi' : 'Nessuna carta in scadenza'}
          >
            <Play size={13} fill="currentColor" />
            <span>Ripassa Mazzo ({activeStats.due})</span>
          </button>

          {/* New Flashcard Button */}
          <button
            onClick={handleOpenCreateModal}
            className="px-3 py-1.5 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-apple-sm"
          >
            <Plus size={14} />
            <span>Nuova Flashcard</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      {isStudyMode ? (
        /* Fullscreen Interactive SM-2 Study Session */
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-black/[0.02] dark:bg-black/20 overflow-y-auto">
          {sessionCompleted ? (
            /* Session Completed Screen */
            <div className="max-w-md w-full p-8 rounded-3xl apple-card-item border border-black/10 dark:border-white/10 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shadow-apple-md">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">
                  Ottimo Lavoro! Sessione Completata 🎉
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                  Hai ripassato con successo <strong>{sessionReviewedCount}</strong> flashcard.{' '}
                  L'algoritmo SM-2 ha aggiornato le scadenze e la facilità di memorizzazione per i prossimi giorni.
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => startStudySession(selectedDeck, false)}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-semibold text-[var(--text-secondary)] transition-colors"
                >
                  Ripassa Ancora Tutte
                </button>
                <button
                  onClick={() => setIsStudyMode(false)}
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold shadow-apple-sm transition-all"
                >
                  Torna all'Elenco Mazzi
                </button>
              </div>
            </div>
          ) : studyQueue.length === 0 ? (
            /* Empty Queue Screen */
            <div className="max-w-md w-full p-8 rounded-3xl apple-card-item border border-black/10 dark:border-white/10 shadow-xl text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <BookOpen size={28} />
              </div>
              <h2 className="text-base font-bold">Nessuna Carta in Scadenza Oggi</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Tutte le carte di questo mazzo sono aggiornate! Se desideri comunque fare pratica, puoi avviare un ripasso libero su tutte le carte.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => startStudySession(selectedDeck, false)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-apple-sm transition-all"
                >
                  Pratica Libera su Tutte
                </button>
                <button
                  onClick={() => setIsStudyMode(false)}
                  className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-semibold transition-colors"
                >
                  Esci
                </button>
              </div>
            </div>
          ) : (
            /* Active Card Study Screen */
            <div className="max-w-2xl w-full flex flex-col space-y-4">
              {/* Progress & Deck Header */}
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] px-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {currentStudyCard.deck || 'Generale'}
                  </span>
                  <span>•</span>
                  <span>
                    Carta {studyIndex + 1} di {studyQueue.length}
                  </span>
                </div>
                <button
                  onClick={() => setIsStudyMode(false)}
                  className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 text-[11px]"
                  title="Termina sessione (Esc)"
                >
                  <X size={14} />
                  <span>Esci</span>
                </button>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${((studyIndex + 1) / studyQueue.length) * 100}%` }}
                />
              </div>

              {/* Interactive Flashcard Card */}
              <div className="w-full min-h-[320px] rounded-3xl apple-card-item border border-black/10 dark:border-white/15 shadow-2xl p-8 flex flex-col justify-between transition-all">
                {/* Front (Question) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 dark:text-amber-400">
                      Domanda
                    </span>
                    {currentStudyCard.noteTitle && (
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                        <FileText size={11} />
                        {currentStudyCard.noteTitle}
                      </span>
                    )}
                  </div>
                  <div className="text-base sm:text-lg font-medium text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">
                    {renderCardText(currentStudyCard.front)}
                  </div>
                </div>

                {/* Back (Answer) */}
                {isAnswerRevealed ? (
                  <div className="mt-6 pt-6 border-t border-black/10 dark:border-white/10 space-y-4 animate-in fade-in duration-200">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-500 dark:text-emerald-400">
                      Risposta
                    </span>
                    <div className="text-base font-normal text-[var(--text-primary)]/90 leading-relaxed whitespace-pre-wrap">
                      {renderCardText(currentStudyCard.back)}
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => setIsAnswerRevealed(true)}
                      className="px-6 py-2.5 rounded-2xl bg-[var(--accent)] hover:opacity-90 text-white font-semibold text-xs shadow-apple-sm transition-all"
                    >
                      Mostra Risposta <kbd className="ml-1.5 opacity-60 text-[10px] font-mono">Spazio</kbd>
                    </button>
                  </div>
                )}

                {/* SM-2 Rating Controls when answer revealed */}
                {isAnswerRevealed && (
                  <div className="mt-8 pt-4 border-t border-black/5 dark:border-white/5 space-y-2 animate-in fade-in duration-150">
                    <div className="text-[11px] text-center text-[var(--text-muted)]">
                      Come ricordavi questa informazione?
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => handleRateCard('again')}
                        className="py-2.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-semibold flex flex-col items-center transition-all"
                      >
                        <span>Di Nuovo</span>
                        <span className="text-[9px] opacity-75 font-mono">1 giorno (1)</span>
                      </button>
                      <button
                        onClick={() => handleRateCard('hard')}
                        className="py-2.5 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold flex flex-col items-center transition-all"
                      >
                        <span>Difficile</span>
                        <span className="text-[9px] opacity-75 font-mono">1.2x (2)</span>
                      </button>
                      <button
                        onClick={() => handleRateCard('good')}
                        className="py-2.5 px-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-semibold flex flex-col items-center transition-all"
                      >
                        <span>Buono</span>
                        <span className="text-[9px] opacity-75 font-mono">Standard (3)</span>
                      </button>
                      <button
                        onClick={() => handleRateCard('easy')}
                        className="py-2.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex flex-col items-center transition-all"
                      >
                        <span>Facile</span>
                        <span className="text-[9px] opacity-75 font-mono">Bonus (4)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Standalone Decks & Cards Management View */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Decks List & Navigation */}
          <aside className="w-64 border-r border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01] p-3 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Mazzi ({availableDecks.length})
                </span>
                <button
                  onClick={() => setIsCreatingDeck((prev) => !prev)}
                  className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  title="Crea nuovo mazzo"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Inline create deck form */}
              {isCreatingDeck && (
                <form onSubmit={handleCreateDeckSubmit} className="p-2 rounded-xl bg-black/5 dark:bg-white/5 space-y-2">
                  <input
                    type="text"
                    placeholder="Nome del mazzo..."
                    value={newDeckInput}
                    onChange={(e) => setNewDeckInput(e.target.value)}
                    autoFocus
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingDeck(false)}
                      className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={!newDeckInput.trim()}
                      className="px-2.5 py-1 rounded-md bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 disabled:opacity-50"
                    >
                      Aggiungi
                    </button>
                  </div>
                </form>
              )}

              {/* Deck buttons list */}
              <div className="space-y-1">
                {/* All decks button */}
                <button
                  onClick={() => setSelectedDeck('all')}
                  className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    selectedDeck === 'all'
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers size={14} />
                    <span className="truncate">Tutti i Mazzi</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {deckStats.all?.due > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                        {deckStats.all.due}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {deckStats.all?.total || 0}
                    </span>
                  </div>
                </button>

                {/* Individual decks */}
                {availableDecks.map((deck) => {
                  const s = deckStats[deck] || { total: 0, due: 0 };
                  const isSelected = selectedDeck === deck;
                  return (
                    <button
                      key={deck}
                      onClick={() => setSelectedDeck(deck)}
                      className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <BookOpen size={13} className="shrink-0" />
                        <span className="truncate">{deck}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.due > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                            {s.due}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--text-muted)] font-mono">
                          {s.total}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-2">
              <button
                onClick={() => startStudySession(selectedDeck, false)}
                disabled={activeStats.total === 0}
                className="w-full py-2 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <Sparkles size={13} />
                <span>Pratica Libera su Tutto</span>
              </button>
            </div>
          </aside>

          {/* Right Column: Cards Management Area */}
          <main className="flex-1 flex flex-col overflow-hidden p-6 space-y-5">
            {/* Deck Overview & Stats Cards */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2.5">
                  <span>{selectedDeck === 'all' ? 'Tutte le Flashcards' : selectedDeck}</span>
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Gestisci le carte memorizzate separatamente dai tuoi appunti Markdown.
                </p>
              </div>

              {/* Stats badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-semibold">
                  <Calendar size={13} />
                  <span>{activeStats.due} in scadenza</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                  <BookOpen size={13} />
                  <span>{activeStats.learning} in apprendimento</span>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                  <GraduationCap size={13} />
                  <span>{activeStats.mastered} padroneggiate</span>
                </div>
              </div>
            </div>

            {/* Filter Pills and Search Bar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl text-xs">
                {(['all', 'due', 'new', 'learning', 'mastered'] as const).map((mode) => {
                  const labelMap = {
                    all: 'Tutte',
                    due: 'In Scadenza',
                    new: 'Nuove',
                    learning: 'Apprendimento',
                    mastered: 'Padroneggiate',
                  };
                  return (
                    <button
                      key={mode}
                      onClick={() => setFilterMode(mode)}
                      className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                        filterMode === mode
                          ? 'bg-[var(--card-bg)] text-[var(--accent)] font-semibold shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {labelMap[mode]}
                    </button>
                  );
                })}
              </div>

              {/* Search box */}
              <div className="relative min-w-[220px]">
                <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Cerca domanda o risposta..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto">
              {filteredCards.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center space-y-3 p-6 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <BookOpen size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      Nessuna Flashcard Trovata
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] max-w-sm mt-0.5">
                      {searchQuery
                        ? 'Nessun elemento corrisponde ai filtri di ricerca applicati.'
                        : 'Questo mazzo non contiene ancora flashcards.'}
                    </p>
                  </div>
                  <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold flex items-center gap-1.5 shadow-apple-sm transition-all"
                  >
                    <Plus size={14} />
                    <span>Crea la prima flashcard</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredCards.map((card) => {
                    const isDue = card.progress.state === 'new' || card.progress.dueDate <= Date.now();
                    return (
                      <div
                        key={card.id}
                        className="p-4 rounded-2xl apple-card-item border border-black/5 dark:border-white/10 shadow-apple-sm flex flex-col justify-between hover:shadow-apple-md transition-all space-y-3 group"
                      >
                        {/* Card Header */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold truncate max-w-[140px]">
                            {card.deck || 'Generale'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isDue ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                                In Scadenza
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] flex items-center gap-1">
                                <Clock size={10} />
                                {card.progress.interval}gg
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="space-y-2 flex-1">
                          <div className="text-xs font-semibold text-[var(--text-primary)] line-clamp-3">
                            {renderCardText(card.front)}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)] line-clamp-3 pt-1 border-t border-black/5 dark:border-white/5">
                            {renderCardText(card.back)}
                          </div>
                        </div>

                        {/* Linked Note Info if present */}
                        {card.noteTitle && (
                          <div
                            onClick={() => {
                              if (card.notePath) {
                                selectNote(card.notePath);
                                setActiveView('notes');
                              }
                            }}
                            className="text-[10px] text-[var(--text-muted)] hover:text-amber-500 cursor-pointer flex items-center gap-1 pt-1 truncate"
                            title="Apri nota di riferimento nell'editor"
                          >
                            <ExternalLink size={10} />
                            <span className="truncate">Rif: {card.noteTitle}</span>
                          </div>
                        )}

                        {/* Card Footer Actions */}
                        <div className="pt-2 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-[var(--text-muted)]">
                          <span className="text-[10px] font-mono">
                            Ripetizioni: {card.progress.reviewsCount}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => resetFlashcardProgress(card.id)}
                              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-amber-500 transition-colors"
                              title="Reimposta progresso a Nuova"
                            >
                              <RotateCcw size={13} />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(card)}
                              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                              title="Modifica Flashcard"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Vuoi davvero eliminare questa flashcard?')) {
                                  deleteFlashcard(card.id);
                                }
                              }}
                              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                              title="Elimina Flashcard"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Create / Edit Card Modal */}
      {isEditorModalOpen && (
        <div
          onClick={() => setIsEditorModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl apple-card-item border border-black/10 dark:border-white/15 shadow-2xl p-6 bg-[var(--card-bg)] text-[var(--text-primary)] space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/10">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Brain size={16} className="text-amber-500" />
                <span>{editingCardId ? 'Modifica Flashcard' : 'Nuova Flashcard Standalone'}</span>
              </h3>
              <button
                onClick={() => setIsEditorModalOpen(false)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              {/* Deck selector */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Mazzo (Deck)
                </label>
                <input
                  type="text"
                  list="deck-suggestions"
                  value={cardDeck}
                  onChange={(e) => setCardDeck(e.target.value)}
                  placeholder="Es. Sistemi Operativi, Algoritmi, Inglese..."
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <datalist id="deck-suggestions">
                  {availableDecks.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              {/* Front / Question */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Fronte (Domanda / Concetto)
                </label>
                <textarea
                  rows={3}
                  value={cardFront}
                  onChange={(e) => setCardFront(e.target.value)}
                  placeholder="Inserisci la domanda... (Supporta formule LaTeX con $formula$)"
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none font-sans"
                />
              </div>

              {/* Back / Answer */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Retro (Risposta / Spiegazione)
                </label>
                <textarea
                  rows={4}
                  value={cardBack}
                  onChange={(e) => setCardBack(e.target.value)}
                  placeholder="Inserisci la risposta esaustiva..."
                  required
                  className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none font-sans"
                />
              </div>

              {/* Optional linked note */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Nota di Riferimento (Opzionale)
                </label>
                <select
                  value={cardNotePath}
                  onChange={(e) => setCardNotePath(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  <option value="">Nessun collegamento</option>
                  {notes.map((n) => (
                    <option key={n.path} value={n.path}>
                      {n.title} ({n.folder || 'Radice'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  La flashcard rimarrà comunque indipendente e NON scriverà testo all'interno della nota.
                </p>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditorModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!cardFront.trim() || !cardBack.trim()}
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white text-xs font-semibold shadow-apple-sm transition-all disabled:opacity-50"
                >
                  {editingCardId ? 'Salva Modifiche' : 'Crea Flashcard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
