import React, { useEffect, Suspense, lazy } from 'react';
import { useVaultStore } from './store/useVaultStore';
import { Sidebar } from './components/Sidebar';
import { EditorView } from './components/EditorView';
import { InspectorPanel } from './components/InspectorPanel';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy-loaded heavy views and modals to minimize initial V8 heap and RAM footprint
const GraphView = lazy(() => import('./components/GraphView').then((m) => ({ default: m.GraphView })));
const FlashcardsView = lazy(() => import('./components/FlashcardsView').then((m) => ({ default: m.FlashcardsView })));
const SyncModal = lazy(() => import('./components/SyncModal').then((m) => ({ default: m.SyncModal })));
const FlashcardModal = lazy(() => import('./components/FlashcardModal').then((m) => ({ default: m.FlashcardModal })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const SmartQAModal = lazy(() => import('./components/SmartQAModal').then((m) => ({ default: m.SmartQAModal })));
const FontModal = lazy(() => import('./components/FontModal').then((m) => ({ default: m.FontModal })));
const NewFlashcardModal = lazy(() => import('./components/NewFlashcardModal').then((m) => ({ default: m.NewFlashcardModal })));

export const App: React.FC = () => {
  const {
    initialize,
    activeView,
    vaultPath,
    openVaultDialog,
    isSyncModalOpen,
    isFlashcardModalOpen,
    isCommandPaletteOpen,
    isSmartQAModalOpen,
    isFontModalOpen,
    isNewFlashcardModalOpen,
    toggleCommandPalette,
    toggleSmartQAModal,
  } = useVaultStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Global lightweight shortcut listener (so modals don't have to be mounted to listen)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      if (isCmdOrCtrl && (e.key.toLowerCase() === 'k' || e.key.toLowerCase() === 'p')) {
        e.preventDefault();
        toggleCommandPalette();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'q') {
        e.preventDefault();
        toggleSmartQAModal();
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [toggleCommandPalette, toggleSmartQAModal]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] font-sans antialiased transition-colors duration-200">
      {/* Column 1: Sidebar (Navigation / Vault & Unified Obsidian Tree) */}
      <Sidebar />

      {/* Main Content Area */}
      {activeView === 'graph' ? (
        /* Fullscreen Interactive Physics Graph (Lazy loaded) */
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">Caricamento Grafo...</div>}>
          <GraphView />
        </Suspense>
      ) : activeView === 'flashcards' ? (
        /* Fullscreen Dedicated Flashcards Section (Lazy loaded) */
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">Caricamento Flashcards...</div>}>
          <FlashcardsView />
        </Suspense>
      ) : (
        /* Obsidian-Style Layout: Main Markdown Editor & Live Preview with Floating Inspector Card */
        <ErrorBoundary fallbackTitle="Errore nel caricamento della nota">
          <div className="flex-1 h-full flex relative overflow-hidden min-w-0">
            <EditorView />
            <InspectorPanel />
          </div>
        </ErrorBoundary>
      )}

      {/* Empty Vault Onboarding Overlay if no vault is selected */}
      {!vaultPath && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 apple-vibrant p-4">
          <div className="w-full max-w-md p-6 rounded-2xl apple-card-item shadow-apple-lg border border-black/10 dark:border-white/10 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xl">
              
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Benvenuto su NoteRip
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                Seleziona una cartella sul tuo computer da usare come Vault locale per i tuoi appunti Markdown.
              </p>
            </div>

            <button
              onClick={openVaultDialog}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs shadow-apple-sm transition-all"
            >
              Seleziona Cartella Vault
            </button>
          </div>
        </div>
      )}

      {/* Lazy-loaded conditional modals (Zero memory overhead when closed) */}
      <Suspense fallback={null}>
        {isSyncModalOpen && <SyncModal />}
        {isFlashcardModalOpen && <FlashcardModal />}
        {isCommandPaletteOpen && <CommandPalette />}
        {isSmartQAModalOpen && <SmartQAModal />}
        {isFontModalOpen && <FontModal />}
        {isNewFlashcardModalOpen && <NewFlashcardModal />}
      </Suspense>
    </div>
  );
};

export default App;
