import React, { useEffect, Suspense, lazy } from 'react';
import { useVaultStore } from './store/useVaultStore';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EditorView } from './components/EditorView';
import { InspectorPanel } from './components/InspectorPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ConfirmModal } from './components/ConfirmModal';
import { ToastContainer } from './components/ToastContainer';
import { FolderOpen } from 'lucide-react';

// Lazy-loaded heavy views and modals to minimize initial V8 heap and RAM footprint
const GraphView = lazy(() => import('./components/GraphView').then((m) => ({ default: m.GraphView })));
const FlashcardsView = lazy(() => import('./components/FlashcardsView').then((m) => ({ default: m.FlashcardsView })));
const SyncModal = lazy(() => import('./components/SyncModal').then((m) => ({ default: m.SyncModal })));
const FlashcardModal = lazy(() => import('./components/FlashcardModal').then((m) => ({ default: m.FlashcardModal })));
const CommandPalette = lazy(() => import('./components/CommandPalette').then((m) => ({ default: m.CommandPalette })));
const SmartQAModal = lazy(() => import('./components/SmartQAModal').then((m) => ({ default: m.SmartQAModal })));
const FontModal = lazy(() => import('./components/FontModal').then((m) => ({ default: m.FontModal })));
const NewFlashcardModal = lazy(() => import('./components/NewFlashcardModal').then((m) => ({ default: m.NewFlashcardModal })));
const AutoFlashcardModal = lazy(() => import('./components/AutoFlashcardModal').then((m) => ({ default: m.AutoFlashcardModal })));

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
    isAutoFlashcardModalOpen,
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
    <div className="flex h-screen w-screen overflow-hidden bg-[#0E1116] text-[#F3F4F6] font-sans antialiased">
      {/* Column 1: Left Sidebar (Notebooks, Tags, Graph section) */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0E1116] min-w-0">
        {/* Top Search Bar & Quick Capture Bar */}
        <TopBar />

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden relative">
          {activeView === 'graph' ? (
            /* Fullscreen Interactive Physics Graph (Lazy loaded) */
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-[#9CA3AF]">Caricamento Grafo...</div>}>
              <GraphView />
            </Suspense>
          ) : activeView === 'flashcards' ? (
            /* Fullscreen Dedicated Flashcards Section (Lazy loaded) */
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-[#9CA3AF]">Caricamento Flashcards...</div>}>
              <FlashcardsView />
            </Suspense>
          ) : (
            /* Main Markdown Editor with Generous Spacing & Docked Right Properties Panel */
            <ErrorBoundary fallbackTitle="Errore nel caricamento della nota">
              <div className="flex-1 h-full flex overflow-hidden min-w-0">
                <EditorView />
                <InspectorPanel />
              </div>
            </ErrorBoundary>
          )}
        </div>
      </div>

      {/* Empty Vault Onboarding Overlay if no vault is selected */}
      {!vaultPath && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md p-6 rounded-xl bg-[#171B22] border border-[#272C36] text-center space-y-4 shadow-popover">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#131720] border border-[#272C36] text-[#E5484D] flex items-center justify-center font-bold text-lg">
              <FolderOpen size={22} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#F3F4F6]">
                Benvenuto su NoteRip
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                Personal knowledge management moderno, veloce e locale. Seleziona una cartella per iniziare con i tuoi appunti Markdown.
              </p>
            </div>

            <button
              onClick={openVaultDialog}
              className="w-full py-2.5 px-4 rounded-xl bg-[#E5484D] hover:bg-[#F05D62] text-white font-medium text-xs transition-all shadow-subtle active:scale-[0.98]"
            >
              Seleziona Cartella Vault
            </button>
          </div>
        </div>
      )}

      {/* Lazy-loaded conditional modals */}
      <Suspense fallback={null}>
        {isSyncModalOpen && <SyncModal />}
        {isFlashcardModalOpen && <FlashcardModal />}
        {isCommandPaletteOpen && <CommandPalette />}
        {isSmartQAModalOpen && <SmartQAModal />}
        {isFontModalOpen && <FontModal />}
        {isNewFlashcardModalOpen && <NewFlashcardModal />}
        {isAutoFlashcardModalOpen && <AutoFlashcardModal />}
      </Suspense>

      {/* In-App Confirmation Modal (Replaces browser confirm) */}
      <ConfirmModal />

      {/* Non-intrusive Toast Notifications (Replaces browser alert) */}
      <ToastContainer />
    </div>
  );
};

export default App;
