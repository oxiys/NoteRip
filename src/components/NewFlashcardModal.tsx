import React, { useState, useEffect, useMemo } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { Brain, X, Check, Folder, Tag, Sparkles } from 'lucide-react';

export const NewFlashcardModal: React.FC = () => {
  const {
    isNewFlashcardModalOpen,
    newFlashcardInitialFront,
    newFlashcardInitialBack,
    newFlashcardInitialDeck,
    closeNewFlashcardModal,
    addFlashcard,
    flashcards,
    activeNotePath,
    notes,
  } = useVaultStore();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [folder, setFolder] = useState('');
  const [deck, setDeck] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // Existing folders & decks list
  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    flashcards.forEach((c) => {
      const f = c.folder || (c.deck && c.deck.includes('/') ? c.deck.split('/')[0].trim() : 'Generale');
      if (f) set.add(f);
    });
    return Array.from(set).sort();
  }, [flashcards]);

  const existingDecks = useMemo(() => {
    const set = new Set<string>();
    flashcards.forEach((c) => {
      const d = c.deck?.includes('/') ? c.deck.split('/').slice(1).join('/') : c.deck || 'Principale';
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [flashcards]);

  const activeNote = useMemo(() => {
    return notes.find((n) => n.path === activeNotePath);
  }, [notes, activeNotePath]);

  useEffect(() => {
    if (isNewFlashcardModalOpen) {
      setFront(newFlashcardInitialFront || '');
      setBack(newFlashcardInitialBack || '');
      // Prefill folder with note folder, or 'Generale'
      const fallbackFolder = activeNote?.folder && activeNote.folder !== 'Root' ? activeNote.folder : 'Generale';
      setFolder(fallbackFolder);
      setDeck(newFlashcardInitialDeck || 'Principale');
      setTagsInput('');
      setIsSaved(false);
    }
  }, [isNewFlashcardModalOpen, newFlashcardInitialFront, newFlashcardInitialBack, newFlashcardInitialDeck, activeNote]);

  if (!isNewFlashcardModalOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter((t) => t.length > 0);

    await addFlashcard({
      folder: folder.trim() || 'Generale',
      deck: deck.trim() || 'Principale',
      front: front.trim(),
      back: back.trim(),
      tags,
      notePath: activeNote?.path,
      noteTitle: activeNote?.title,
    });

    setIsSaved(true);
    setTimeout(() => {
      closeNewFlashcardModal();
    }, 600);
  };

  return (
    <div
      onClick={closeNewFlashcardModal}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl apple-card-item shadow-2xl border border-black/15 dark:border-white/15 overflow-hidden flex flex-col bg-[var(--card-bg)] text-[var(--text-primary)] transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Brain size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Nuova Flashcard SM-2</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Separata dalla nota: viene salvata direttamente nel mazzo per la ripetizione spaziata
              </p>
            </div>
          </div>
          <button
            onClick={closeNewFlashcardModal}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Folder & Deck Dual Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Folder size={13} className="text-amber-500" />
                <span>Cartella:</span>
              </label>
              <input
                type="text"
                list="new-card-folder-suggestions"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                placeholder="es. Università, Medicina..."
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                required
              />
              <datalist id="new-card-folder-suggestions">
                {existingFolders.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Brain size={13} className="text-amber-500" />
                <span>Mazzo:</span>
              </label>
              <input
                type="text"
                list="new-card-deck-suggestions"
                value={deck}
                onChange={(e) => setDeck(e.target.value)}
                placeholder="es. Algoritmi, Anatomia..."
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                required
              />
              <datalist id="new-card-deck-suggestions">
                {existingDecks.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Front / Question */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between">
              <span>Fronte (Domanda / Concetto):</span>
              <span className="text-[10px] text-[var(--text-muted)] font-normal">Supporta LaTeX $...$</span>
            </label>
            <textarea
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Qual è la definizione di..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
              required
              autoFocus
            />
          </div>

          {/* Back / Answer */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between">
              <span>Retro (Risposta / Spiegazione):</span>
              <span className="text-[10px] text-[var(--text-muted)] font-normal">Supporta LaTeX $...$</span>
            </label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="La risposta dettagliata o la formula corretta..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
              required
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Tag size={13} className="text-[var(--text-muted)]" />
              <span>Tag facoltativi (separati da virgola):</span>
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="es. esame, definizione, formule"
              className="w-full px-3 py-1.5 rounded-lg text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-between border-t border-black/10 dark:border-white/10">
            <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
              <Sparkles size={11} className="text-amber-500" />
              <span>Algoritmo di ripetizione SuperMemo SM-2</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeNewFlashcardModal}
                className="px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs font-medium text-[var(--text-secondary)] transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={!front.trim() || !back.trim() || isSaved}
                className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 text-white text-xs font-semibold shadow-apple-sm transition-all flex items-center gap-1.5"
              >
                {isSaved ? (
                  <>
                    <Check size={14} />
                    <span>Salvata!</span>
                  </>
                ) : (
                  <span>Crea Flashcard</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
