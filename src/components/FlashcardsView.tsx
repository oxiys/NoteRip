import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import type { FlashcardItem, FlashcardRating, FlashcardProgress } from '../types';
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
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Upload,
  Download,
  Pencil,
  Check,
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
    addFlashcardsBatch,
    updateFlashcard,
    deleteFlashcard,
    renameFlashcardFolder,
    deleteFlashcardFolder,
    renameFlashcardDeck,
    deleteFlashcardDeck,
    resetFlashcardProgress,
    requestConfirm,
    openAutoFlashcardModal,
    recordCardReview,
    notes,
    selectNote,
    setActiveView,
    showToast,
  } = useVaultStore();

  // Navigation & folder selection state
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [selectedDeck, setSelectedDeck] = useState<string>('all');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [filterMode, setFilterMode] = useState<'all' | 'due' | 'new' | 'learning' | 'mastered'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Folder & Deck creation / renaming state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingDeck, setIsCreatingDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [targetFolderForNewDeck, setTargetFolderForNewDeck] = useState<string>('Generale');

  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [renamingDeck, setRenamingDeck] = useState<{ folder: string; deck: string } | null>(null);
  const [renameDeckValue, setRenameDeckValue] = useState('');

  // Card editor modal state
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardFolder, setCardFolder] = useState('');
  const [cardDeck, setCardDeck] = useState('');
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');
  const [cardNotePath, setCardNotePath] = useState('');

  // JSON Import ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Study session state
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [studyQueue, setStudyQueue] = useState<FlashcardItem[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Helper to extract folder and deck cleanly from any card
  const getCardInfo = useCallback((card: FlashcardItem) => {
    let folder = card.folder?.trim() || '';
    let deck = card.deck?.trim() || '';

    if (!folder && deck.includes('/')) {
      const parts = deck.split('/');
      folder = parts[0].trim();
      deck = parts.slice(1).join('/').trim();
    }

    if (!folder) folder = 'Generale';
    if (!deck) deck = 'Principale';

    return { folder, deck };
  }, []);

  // Compute folder hierarchy: folder -> Set of decks
  const folderHierarchy = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    flashcards.forEach((c) => {
      const { folder, deck } = getCardInfo(c);
      if (!map[folder]) map[folder] = new Set();
      map[folder].add(deck);
    });
    return map;
  }, [flashcards, getCardInfo]);

  const availableFolders = useMemo(() => {
    return Object.keys(folderHierarchy).sort();
  }, [folderHierarchy]);

  // Expand folders by default on initial load
  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = { ...prev };
      availableFolders.forEach((f) => {
        if (next[f] === undefined) next[f] = true;
      });
      return next;
    });
  }, [availableFolders]);

  // Statistics calculated globally, per folder and per deck
  const stats = useMemo(() => {
    const now = Date.now();
    const result = {
      all: { total: 0, due: 0, new: 0, learning: 0, mastered: 0 },
      folders: {} as Record<string, { total: number; due: number; new: number; learning: number; mastered: number }>,
      decks: {} as Record<string, { total: number; due: number; new: number; learning: number; mastered: number }>,
    };

    flashcards.forEach((c) => {
      const { folder, deck } = getCardInfo(c);
      const isDue = c.progress.state === 'new' || c.progress.dueDate <= now;
      const isNew = c.progress.state === 'new';
      const isMastered = !isNew && c.progress.interval >= 21;
      const isLearning = !isNew && !isMastered;

      // Global
      result.all.total++;
      if (isDue) result.all.due++;
      if (isNew) result.all.new++;
      if (isLearning) result.all.learning++;
      if (isMastered) result.all.mastered++;

      // Folder
      if (!result.folders[folder]) {
        result.folders[folder] = { total: 0, due: 0, new: 0, learning: 0, mastered: 0 };
      }
      result.folders[folder].total++;
      if (isDue) result.folders[folder].due++;
      if (isNew) result.folders[folder].new++;
      if (isLearning) result.folders[folder].learning++;
      if (isMastered) result.folders[folder].mastered++;

      // Deck key: `${folder}:::${deck}`
      const deckKey = `${folder}:::${deck}`;
      if (!result.decks[deckKey]) {
        result.decks[deckKey] = { total: 0, due: 0, new: 0, learning: 0, mastered: 0 };
      }
      result.decks[deckKey].total++;
      if (isDue) result.decks[deckKey].due++;
      if (isNew) result.decks[deckKey].new++;
      if (isLearning) result.decks[deckKey].learning++;
      if (isMastered) result.decks[deckKey].mastered++;
    });

    return result;
  }, [flashcards, getCardInfo]);

  // Active statistics for currently selected folder & deck
  const activeStats = useMemo(() => {
    if (selectedFolder === 'all') {
      return stats.all;
    }
    if (selectedDeck === 'all') {
      return stats.folders[selectedFolder] || { total: 0, due: 0, new: 0, learning: 0, mastered: 0 };
    }
    const deckKey = `${selectedFolder}:::${selectedDeck}`;
    return stats.decks[deckKey] || { total: 0, due: 0, new: 0, learning: 0, mastered: 0 };
  }, [selectedFolder, selectedDeck, stats]);

  // Filtered cards for management view
  const filteredCards = useMemo(() => {
    const now = Date.now();
    const q = searchQuery.trim().toLowerCase();

    return flashcards.filter((c) => {
      const { folder, deck } = getCardInfo(c);

      // Folder filter
      if (selectedFolder !== 'all' && folder !== selectedFolder) {
        return false;
      }

      // Deck filter
      if (selectedDeck !== 'all' && deck !== selectedDeck) {
        return false;
      }

      // Status filter
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

      // Search query filter
      if (q) {
        const matchFront = c.front.toLowerCase().includes(q);
        const matchBack = c.back.toLowerCase().includes(q);
        const matchFolder = folder.toLowerCase().includes(q);
        const matchDeck = deck.toLowerCase().includes(q);
        if (!matchFront && !matchBack && !matchFolder && !matchDeck) return false;
      }

      return true;
    });
  }, [flashcards, selectedFolder, selectedDeck, filterMode, searchQuery, getCardInfo]);

  // Start study session
  const startStudySession = (targetFolder: string, targetDeck: string, onlyDue = true) => {
    const now = Date.now();
    const candidates = flashcards.filter((c) => {
      const { folder, deck } = getCardInfo(c);

      if (targetFolder !== 'all' && folder !== targetFolder) return false;
      if (targetDeck !== 'all' && deck !== targetDeck) return false;

      if (onlyDue) {
        return c.progress.state === 'new' || c.progress.dueDate <= now;
      }
      return true;
    });

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);

    setStudyQueue(shuffled);
    setStudyIndex(0);
    setIsAnswerRevealed(false);
    setSessionReviewedCount(0);
    setSessionCompleted(false);
    setIsStudyMode(true);
  };

  const currentStudyCard = studyQueue[studyIndex];

  // Rate card in SM-2
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

  // Keyboard shortcuts in study mode
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
  const handleOpenCreateModal = (defaultFolder?: string, defaultDeck?: string) => {
    setEditingCardId(null);
    const chosenFolder =
      defaultFolder || (selectedFolder !== 'all' ? selectedFolder : availableFolders[0] || 'Generale');
    const existingDecksInFolder = Array.from(folderHierarchy[chosenFolder] || []);
    const chosenDeck =
      defaultDeck ||
      (selectedDeck !== 'all' ? selectedDeck : existingDecksInFolder[0] || 'Principale');

    setCardFolder(chosenFolder);
    setCardDeck(chosenDeck);
    setCardFront('');
    setCardBack('');
    setCardNotePath('');
    setIsEditorModalOpen(true);
  };

  // Open modal to edit card
  const handleOpenEditModal = (card: FlashcardItem) => {
    const { folder, deck } = getCardInfo(card);
    setEditingCardId(card.id);
    setCardFolder(folder);
    setCardDeck(deck);
    setCardFront(card.front);
    setCardBack(card.back);
    setCardNotePath(card.notePath || '');
    setIsEditorModalOpen(true);
  };

  // Save new or edited card
  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardFront.trim() || !cardBack.trim()) return;

    const folder = cardFolder.trim() || 'Generale';
    const deck = cardDeck.trim() || 'Principale';
    const note = notes.find((n) => n.path === cardNotePath);

    if (editingCardId) {
      await updateFlashcard(editingCardId, {
        folder,
        deck,
        front: cardFront.trim(),
        back: cardBack.trim(),
        notePath: cardNotePath || undefined,
        noteTitle: note?.title,
      });
      showToast('Flashcard modificata con successo.', 'success');
    } else {
      await addFlashcard({
        folder,
        deck,
        front: cardFront.trim(),
        back: cardBack.trim(),
        notePath: cardNotePath || undefined,
        noteTitle: note?.title,
      });
      showToast('Flashcard aggiunta con successo.', 'success');
    }

    setIsEditorModalOpen(false);
  };

  // Create new folder
  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    setExpandedFolders((prev) => ({ ...prev, [trimmed]: true }));
    setSelectedFolder(trimmed);
    setSelectedDeck('all');
    setNewFolderName('');
    setIsCreatingFolder(false);
    showToast(`Cartella "${trimmed}" creata.`, 'success');
  };

  // Create new deck inside a folder
  const handleCreateDeckSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDeck = newDeckName.trim();
    const targetFolder = targetFolderForNewDeck.trim() || 'Generale';
    if (!trimmedDeck) return;

    setSelectedFolder(targetFolder);
    setSelectedDeck(trimmedDeck);
    setExpandedFolders((prev) => ({ ...prev, [targetFolder]: true }));
    setNewDeckName('');
    setIsCreatingDeck(false);

    // Open card creation modal for this deck immediately
    handleOpenCreateModal(targetFolder, trimmedDeck);
  };

  // Toggle folder expansion
  const toggleFolderExpand = (folder: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
  };

  // JSON Import handler
  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let rawCards: any[] = [];
      let defaultFolder = selectedFolder !== 'all' ? selectedFolder : 'Importate';
      let defaultDeck = selectedDeck !== 'all' ? selectedDeck : 'Principale';

      // 1. Array of cards
      if (Array.isArray(data)) {
        rawCards = data;
      } else if (data && typeof data === 'object') {
        // 2. Object with deck and cards: { folder, deck, cards: [...] }
        if (data.folder) defaultFolder = String(data.folder);
        if (data.deck) defaultDeck = String(data.deck);
        if (Array.isArray(data.cards)) {
          rawCards = data.cards;
        } else if (Array.isArray(data.flashcards)) {
          rawCards = data.flashcards;
        } else if (Array.isArray(data.data)) {
          rawCards = data.data;
        } else {
          // 3. Key-Value dictionary { "Q": "A" }
          rawCards = Object.entries(data).map(([key, val]) => ({
            front: key,
            back: typeof val === 'string' ? val : JSON.stringify(val),
          }));
        }
      }

      if (rawCards.length === 0) {
        showToast('Nessuna flashcard valida trovata nel file JSON.', 'error');
        return;
      }

      const importedFolders = new Set<string>();
      const batchToCreate: Array<{
        front: string;
        back: string;
        folder: string;
        deck: string;
        tags?: string[];
        notePath?: string;
        noteTitle?: string;
        progress?: FlashcardProgress;
      }> = [];

      for (const item of rawCards) {
        if (!item || typeof item !== 'object') continue;

        const front = String(
          item.front || item.question || item.q || item.prompt || item.term || ''
        ).trim();
        const back = String(
          item.back || item.answer || item.a || item.completion || item.definition || ''
        ).trim();

        if (!front || !back) continue;

        let folder = String(item.folder || defaultFolder).trim();
        let deck = String(item.deck || defaultDeck).trim();

        // If deck contains folder slash e.g. "Medicina/Anatomia"
        if (!item.folder && deck.includes('/')) {
          const parts = deck.split('/');
          folder = parts[0].trim();
          deck = parts.slice(1).join('/').trim();
        }

        if (!folder) folder = 'Generale';
        if (!deck) deck = 'Principale';

        const tags = Array.isArray(item.tags)
          ? item.tags.map((t: any) => String(t).trim()).filter(Boolean)
          : undefined;

        importedFolders.add(folder);

        batchToCreate.push({
          front,
          back,
          folder,
          deck,
          tags,
          notePath: item.notePath ? String(item.notePath) : undefined,
          noteTitle: item.noteTitle ? String(item.noteTitle) : undefined,
          progress: item.progress && typeof item.progress === 'object' ? item.progress : undefined,
        });
      }

      if (batchToCreate.length === 0) {
        showToast('Il file JSON non contiene flashcard con domande e risposte leggibili.', 'error');
        return;
      }

      await addFlashcardsBatch(batchToCreate);

      // Select first imported folder so user sees cards right away
      const firstFolder = Array.from(importedFolders)[0];
      setSelectedFolder(firstFolder);
      setSelectedDeck('all');
      setExpandedFolders((prev) => ({ ...prev, [firstFolder]: true }));

      showToast(
        `Importate ${batchToCreate.length} flashcard in ${importedFolders.size} ${
          importedFolders.size === 1 ? 'cartella' : 'cartelle'
        } con successo!`,
        'success'
      );
    } catch (err: any) {
      console.error('Error importing JSON flashcards:', err);
      showToast('Errore durante la lettura del file JSON: ' + (err?.message || 'Formato non valido'), 'error');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // JSON Export handler
  const handleExportJson = () => {
    const cardsToExport = filteredCards.length > 0 ? filteredCards : flashcards;
    if (cardsToExport.length === 0) {
      showToast('Nessuna flashcard presente da esportare.', 'info');
      return;
    }

    const exportData = cardsToExport.map((c) => {
      const { folder, deck } = getCardInfo(c);
      return {
        front: c.front,
        back: c.back,
        folder,
        deck,
        tags: c.tags,
        noteTitle: c.noteTitle,
        progress: c.progress,
      };
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filenamePrefix =
      selectedFolder !== 'all'
        ? selectedDeck !== 'all'
          ? `${selectedFolder}_${selectedDeck}`
          : selectedFolder
        : 'tutte_le_flashcard';
    a.download = `noterip_flashcards_${filenamePrefix.toLowerCase().replace(/[^a-z0-9]+/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Esportate ${cardsToExport.length} flashcard in formato JSON!`, 'success');
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden select-none">
      {/* Hidden JSON file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportJsonFile}
      />

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
            onClick={() => startStudySession(selectedFolder, selectedDeck, true)}
            disabled={activeStats.due === 0}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-apple-sm ${
              activeStats.due > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer'
                : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] cursor-not-allowed opacity-60'
            }`}
            title={
              activeStats.due > 0
                ? selectedDeck !== 'all'
                  ? `Ripassa mazzo "${selectedDeck}"`
                  : selectedFolder !== 'all'
                  ? `Ripassa intera cartella "${selectedFolder}"`
                  : 'Ripassa tutte le flashcard in scadenza oggi'
                : 'Nessuna carta in scadenza'
            }
          >
            <Play size={13} fill="currentColor" />
            <span>
              {selectedDeck !== 'all'
                ? `Ripassa Mazzo (${activeStats.due})`
                : selectedFolder !== 'all'
                ? `Ripassa Cartella (${activeStats.due})`
                : `Ripassa Scadenze (${activeStats.due})`}
            </span>
          </button>

          {/* Import JSON Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-apple-sm text-[var(--text-primary)]"
            title="Importa flashcards da un file .json"
          >
            <Upload size={13} className="text-amber-500" />
            <span>Importa JSON</span>
          </button>

          {/* Export JSON Button */}
          <button
            onClick={handleExportJson}
            disabled={flashcards.length === 0}
            className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-apple-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
            title="Esporta flashcard visualizzate in formato JSON"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Esporta</span>
          </button>

          {/* Auto Generate Flashcards Button */}
          <button
            onClick={() =>
              openAutoFlashcardModal(
                '',
                '',
                selectedFolder !== 'all'
                  ? selectedDeck !== 'all'
                    ? `${selectedFolder}/${selectedDeck}`
                    : selectedFolder
                  : ''
              )
            }
            className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-apple-sm"
            title="Genera flashcard automaticamente con AI o estrazione euristica"
          >
            <Sparkles size={14} className="text-amber-500" />
            <span className="hidden md:inline">Genera con AI</span>
          </button>

          {/* New Flashcard Button */}
          <button
            onClick={() => handleOpenCreateModal()}
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
                  onClick={() => startStudySession(selectedFolder, selectedDeck, false)}
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
                Tutte le carte di questo gruppo sono aggiornate! Se desideri fare pratica, puoi avviare un ripasso libero su tutte le carte.
              </p>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => startStudySession(selectedFolder, selectedDeck, false)}
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
                  <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Folder size={13} className="text-amber-500" />
                    <span>{getCardInfo(currentStudyCard).folder}</span>
                    <span>/</span>
                    <span>{getCardInfo(currentStudyCard).deck}</span>
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
        /* Standalone Folders, Decks & Cards Management View */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Folders & Decks Tree Sidebar */}
          <aside className="w-72 border-r border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01] p-3 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div className="space-y-3">
              {/* Sidebar Header with Actions */}
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Cartelle & Mazzi
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setIsCreatingFolder((prev) => !prev);
                      setIsCreatingDeck(false);
                    }}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title="Nuova Cartella di Flashcard"
                  >
                    <FolderPlus size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingDeck((prev) => !prev);
                      setIsCreatingFolder(false);
                      setTargetFolderForNewDeck(selectedFolder !== 'all' ? selectedFolder : 'Generale');
                    }}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    title="Nuovo Mazzo dentro una cartella"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-amber-500 transition-colors"
                    title="Importa da file .json"
                  >
                    <Upload size={14} />
                  </button>
                </div>
              </div>

              {/* Inline Create Folder Form */}
              {isCreatingFolder && (
                <form
                  onSubmit={handleCreateFolderSubmit}
                  className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 space-y-2 border border-black/10 dark:border-white/10 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                    <FolderPlus size={12} className="text-amber-500" />
                    <span>Crea Nuova Cartella</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Nome cartella (es. Università, Medicina)..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    autoFocus
                    className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCreatingFolder(false)}
                      className="px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Annulla
                    </button>
                    <button
                      type="submit"
                      disabled={!newFolderName.trim()}
                      className="px-2.5 py-1 rounded-md bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 disabled:opacity-50"
                    >
                      Crea Cartella
                    </button>
                  </div>
                </form>
              )}

              {/* Inline Create Deck Form */}
              {isCreatingDeck && (
                <form
                  onSubmit={handleCreateDeckSubmit}
                  className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 space-y-2 border border-black/10 dark:border-white/10 animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                    <BookOpen size={12} className="text-amber-500" />
                    <span>Nuovo Mazzo</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-muted)] block mb-0.5">Cartella di appartenenza:</label>
                    <input
                      type="text"
                      list="folder-list-for-deck"
                      value={targetFolderForNewDeck}
                      onChange={(e) => setTargetFolderForNewDeck(e.target.value)}
                      placeholder="Cartella..."
                      className="w-full px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-neutral-800 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <datalist id="folder-list-for-deck">
                      {availableFolders.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>
                  <input
                    type="text"
                    placeholder="Nome del mazzo (es. Algoritmi)..."
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
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
                      disabled={!newDeckName.trim()}
                      className="px-2.5 py-1 rounded-md bg-amber-500 text-white text-[11px] font-semibold hover:bg-amber-600 disabled:opacity-50"
                    >
                      Crea Mazzo
                    </button>
                  </div>
                </form>
              )}

              {/* Tree Navigation: Folders & Decks */}
              <div className="space-y-1">
                {/* 1. All Flashcards Button */}
                <button
                  onClick={() => {
                    setSelectedFolder('all');
                    setSelectedDeck('all');
                  }}
                  className={`w-full px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                    selectedFolder === 'all' && selectedDeck === 'all'
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                      : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers size={14} className="shrink-0" />
                    <span className="truncate">Tutte le Flashcards</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {stats.all?.due > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                        {stats.all.due}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {stats.all?.total || 0}
                    </span>
                  </div>
                </button>

                {/* 2. Folders and nested Decks */}
                {availableFolders.map((folderName) => {
                  const fStats = stats.folders[folderName] || { total: 0, due: 0 };
                  const isFolderSelected = selectedFolder === folderName && selectedDeck === 'all';
                  const isExpanded = expandedFolders[folderName] ?? true;
                  const decks = Array.from(folderHierarchy[folderName] || []).sort();

                  return (
                    <div key={folderName} className="space-y-0.5">
                      {/* Folder Row */}
                      {renamingFolder === folderName ? (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-black/5 dark:bg-white/5">
                          <input
                            type="text"
                            value={renameFolderValue}
                            onChange={(e) => setRenameFolderValue(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                if (renameFolderValue.trim()) {
                                  await renameFlashcardFolder(folderName, renameFolderValue.trim());
                                  if (selectedFolder === folderName) setSelectedFolder(renameFolderValue.trim());
                                }
                                setRenamingFolder(null);
                              } else if (e.key === 'Escape') {
                                setRenamingFolder(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 px-2 py-1 text-xs rounded bg-white dark:bg-neutral-800 border border-amber-500 text-[var(--text-primary)] focus:outline-none"
                          />
                          <button
                            onClick={async () => {
                              if (renameFolderValue.trim()) {
                                await renameFlashcardFolder(folderName, renameFolderValue.trim());
                                if (selectedFolder === folderName) setSelectedFolder(renameFolderValue.trim());
                              }
                              setRenamingFolder(null);
                            }}
                            className="p-1 text-emerald-500 hover:bg-black/5 rounded"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() => setRenamingFolder(null)}
                            className="p-1 text-[var(--text-muted)] hover:bg-black/5 rounded"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setSelectedFolder(folderName);
                            setSelectedDeck('all');
                          }}
                          className={`group w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isFolderSelected
                              ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                              : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderExpand(folderName);
                              }}
                              className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-transform shrink-0"
                            >
                              {isExpanded ? (
                                <ChevronDown size={13} />
                              ) : (
                                <ChevronRight size={13} />
                              )}
                            </span>
                            <Folder size={13} className="text-amber-500 shrink-0" />
                            <span className="truncate">{folderName}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Actions on hover */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetFolderForNewDeck(folderName);
                                  setIsCreatingDeck(true);
                                }}
                                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                title={`Crea mazzo dentro "${folderName}"`}
                              >
                                <Plus size={11} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenamingFolder(folderName);
                                  setRenameFolderValue(folderName);
                                }}
                                className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                title="Rinomina cartella"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const confirmed = await requestConfirm({
                                    title: 'Elimina Cartella Flashcard',
                                    message: `Eliminare la cartella "${folderName}" e tutte le ${fStats.total} flashcard al suo interno?`,
                                    confirmLabel: 'Elimina Cartella',
                                    isDanger: true,
                                  });
                                  if (confirmed) {
                                    await deleteFlashcardFolder(folderName);
                                    if (selectedFolder === folderName) {
                                      setSelectedFolder('all');
                                      setSelectedDeck('all');
                                    }
                                  }
                                }}
                                className="p-1 hover:bg-rose-500/20 rounded text-[var(--text-muted)] hover:text-rose-500"
                                title="Elimina cartella"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {/* Badge */}
                            {fStats.due > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                                {fStats.due}
                              </span>
                            )}
                            <span className="text-[11px] text-[var(--text-muted)] font-mono">
                              {fStats.total}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Decks inside this folder */}
                      {isExpanded && (
                        <div className="ml-5 pl-2 border-l border-black/5 dark:border-white/10 space-y-0.5">
                          {decks.length === 0 ? (
                            <div className="py-1 px-2 text-[11px] text-[var(--text-muted)] italic">
                              Nessun mazzo in questa cartella
                            </div>
                          ) : (
                            decks.map((deckName) => {
                              const dKey = `${folderName}:::${deckName}`;
                              const dStats = stats.decks[dKey] || { total: 0, due: 0 };
                              const isDeckSelected =
                                selectedFolder === folderName && selectedDeck === deckName;

                              return (
                                <div key={deckName}>
                                  {renamingDeck &&
                                  renamingDeck.folder === folderName &&
                                  renamingDeck.deck === deckName ? (
                                    <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/5 dark:bg-white/5">
                                      <input
                                        type="text"
                                        value={renameDeckValue}
                                        onChange={(e) => setRenameDeckValue(e.target.value)}
                                        onKeyDown={async (e) => {
                                          if (e.key === 'Enter') {
                                            if (renameDeckValue.trim()) {
                                              await renameFlashcardDeck(
                                                deckName,
                                                renameDeckValue.trim(),
                                                folderName
                                              );
                                              if (
                                                selectedFolder === folderName &&
                                                selectedDeck === deckName
                                              ) {
                                                setSelectedDeck(renameDeckValue.trim());
                                              }
                                            }
                                            setRenamingDeck(null);
                                          } else if (e.key === 'Escape') {
                                            setRenamingDeck(null);
                                          }
                                        }}
                                        autoFocus
                                        className="flex-1 px-2 py-0.5 text-xs rounded bg-white dark:bg-neutral-800 border border-amber-500 text-[var(--text-primary)] focus:outline-none"
                                      />
                                      <button
                                        onClick={async () => {
                                          if (renameDeckValue.trim()) {
                                            await renameFlashcardDeck(
                                              deckName,
                                              renameDeckValue.trim(),
                                              folderName
                                            );
                                            if (
                                              selectedFolder === folderName &&
                                              selectedDeck === deckName
                                            ) {
                                              setSelectedDeck(renameDeckValue.trim());
                                            }
                                          }
                                          setRenamingDeck(null);
                                        }}
                                        className="p-1 text-emerald-500 hover:bg-black/5 rounded"
                                      >
                                        <Check size={11} />
                                      </button>
                                      <button
                                        onClick={() => setRenamingDeck(null)}
                                        className="p-1 text-[var(--text-muted)] hover:bg-black/5 rounded"
                                      >
                                        <X size={11} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => {
                                        setSelectedFolder(folderName);
                                        setSelectedDeck(deckName);
                                      }}
                                      className={`group/deck w-full px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                                        isDeckSelected
                                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold'
                                          : 'text-[var(--text-secondary)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--text-primary)]'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <BookOpen size={12} className="shrink-0 opacity-70" />
                                        <span className="truncate">{deckName}</span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {/* Deck actions on hover */}
                                        <div className="opacity-0 group-hover/deck:opacity-100 flex items-center gap-0.5 transition-opacity">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setRenamingDeck({ folder: folderName, deck: deckName });
                                              setRenameDeckValue(deckName);
                                            }}
                                            className="p-0.5 hover:bg-black/10 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                                            title="Rinomina mazzo"
                                          >
                                            <Pencil size={10} />
                                          </button>
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const confirmed = await requestConfirm({
                                                title: 'Elimina Mazzo Flashcard',
                                                message: `Eliminare il mazzo "${deckName}" e tutte le ${dStats.total} flashcard al suo interno?`,
                                                confirmLabel: 'Elimina Mazzo',
                                                isDanger: true,
                                              });
                                              if (confirmed) {
                                                await deleteFlashcardDeck(deckName, folderName);
                                                if (
                                                  selectedFolder === folderName &&
                                                  selectedDeck === deckName
                                                ) {
                                                  setSelectedDeck('all');
                                                }
                                              }
                                            }}
                                            className="p-0.5 hover:bg-rose-500/20 rounded text-[var(--text-muted)] hover:text-rose-500"
                                            title="Elimina mazzo"
                                          >
                                            <Trash2 size={10} />
                                          </button>
                                        </div>

                                        {dStats.due > 0 && (
                                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                                            {dStats.due}
                                          </span>
                                        )}
                                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                                          {dStats.total}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions Footer */}
            <div className="pt-4 border-t border-black/5 dark:border-white/5 space-y-2">
              <button
                onClick={() => startStudySession(selectedFolder, selectedDeck, false)}
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
            {/* Header with Title and Current Path */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2.5">
                  {selectedFolder === 'all' ? (
                    <span>Tutte le Flashcards</span>
                  ) : selectedDeck === 'all' ? (
                    <span className="flex items-center gap-1.5">
                      <Folder size={20} className="text-amber-500" />
                      <span>{selectedFolder}</span>
                      <span className="text-xs text-[var(--text-muted)] font-normal ml-1">
                        (Tutti i mazzi)
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Folder size={18} className="text-amber-500" />
                      <span>{selectedFolder}</span>
                      <span className="text-[var(--text-muted)]">/</span>
                      <BookOpen size={18} className="text-amber-500" />
                      <span>{selectedDeck}</span>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Organizzate in cartelle e mazzi con ripetizione spaziata SM-2.
                </p>
              </div>

              {/* Stats Badges */}
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
              <div className="relative min-w-[240px]">
                <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Cerca domanda, risposta o cartella..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* Cards Grid */}
            <div className="flex-1 overflow-y-auto">
              {filteredCards.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center text-center space-y-4 p-8 rounded-2xl border border-dashed border-black/10 dark:border-white/10">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <BookOpen size={28} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">
                      Nessuna Flashcard Trovata
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] max-w-sm mt-1 leading-relaxed">
                      {searchQuery
                        ? 'Nessun elemento corrisponde ai filtri di ricerca applicati.'
                        : 'Questo gruppo non contiene ancora flashcard. Crea una carta o importale da un file JSON.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleOpenCreateModal()}
                      className="px-4 py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-semibold flex items-center gap-1.5 shadow-apple-sm transition-all"
                    >
                      <Plus size={14} />
                      <span>Nuova flashcard</span>
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-semibold flex items-center gap-1.5 text-[var(--text-primary)] transition-all"
                    >
                      <Upload size={14} className="text-amber-500" />
                      <span>Importa da JSON</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredCards.map((card) => {
                    const isDue = card.progress.state === 'new' || card.progress.dueDate <= Date.now();
                    const { folder, deck } = getCardInfo(card);

                    return (
                      <div
                        key={card.id}
                        className="p-4 rounded-2xl apple-card-item border border-black/5 dark:border-white/10 shadow-apple-sm flex flex-col justify-between hover:shadow-apple-md transition-all space-y-3 group"
                      >
                        {/* Card Header: Folder & Deck Badges */}
                        <div className="flex items-center justify-between text-[11px] gap-2">
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold truncate flex items-center gap-1">
                              <Folder size={10} className="shrink-0" />
                              <span className="truncate">{folder}</span>
                            </span>
                            <span className="text-[var(--text-muted)] text-[10px]">/</span>
                            <span className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-[var(--text-secondary)] font-medium truncate">
                              {deck}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
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
                              onClick={() => {
                                resetFlashcardProgress(card.id);
                                showToast('Progresso reimpostato a Nuova.', 'info');
                              }}
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
                              onClick={async () => {
                                const confirmed = await requestConfirm({
                                  title: 'Elimina Flashcard',
                                  message: 'Vuoi davvero eliminare questa flashcard dal mazzo?',
                                  confirmLabel: 'Elimina',
                                  isDanger: true,
                                });
                                if (confirmed) {
                                  deleteFlashcard(card.id);
                                  showToast('Flashcard eliminata.', 'info');
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
                <span>{editingCardId ? 'Modifica Flashcard' : 'Nuova Flashcard SM-2'}</span>
              </h3>
              <button
                onClick={() => setIsEditorModalOpen(false)}
                className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-4">
              {/* Folder & Deck Dual Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cartella (Folder) */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1 flex items-center gap-1">
                    <Folder size={12} className="text-amber-500" />
                    <span>Cartella</span>
                  </label>
                  <input
                    type="text"
                    list="folder-suggestions"
                    value={cardFolder}
                    onChange={(e) => setCardFolder(e.target.value)}
                    placeholder="Es. Informatica, Medicina..."
                    required
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <datalist id="folder-suggestions">
                    {availableFolders.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>

                {/* Mazzo (Deck) */}
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1 flex items-center gap-1">
                    <BookOpen size={12} className="text-amber-500" />
                    <span>Mazzo</span>
                  </label>
                  <input
                    type="text"
                    list="deck-suggestions"
                    value={cardDeck}
                    onChange={(e) => setCardDeck(e.target.value)}
                    placeholder="Es. Algoritmi, Anatomia..."
                    required
                    className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <datalist id="deck-suggestions">
                    {Array.from(folderHierarchy[cardFolder] || []).map((d) => (
                      <option key={d} value={d} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Front / Question */}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1 flex items-center justify-between">
                  <span>Fronte (Domanda / Concetto)</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-normal">Supporta LaTeX $...$</span>
                </label>
                <textarea
                  rows={3}
                  value={cardFront}
                  onChange={(e) => setCardFront(e.target.value)}
                  placeholder="Inserisci la domanda... (Supporta formule matematiche $formula$)"
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
                  La flashcard rimarrà indipendente e NON modificherà il testo degli appunti.
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
