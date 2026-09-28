import React, { useEffect } from 'react';
import { useVaultStore } from './store/useVaultStore';
import { Sidebar } from './components/Sidebar';
import { EditorView } from './components/EditorView';
import { InspectorPanel } from './components/InspectorPanel';
import { GraphView } from './components/GraphView';
import { SyncModal } from './components/SyncModal';
import { FlashcardModal } from './components/FlashcardModal';
import { CommandPalette } from './components/CommandPalette';
import { SmartQAModal } from './components/SmartQAModal';

export const App: React.FC = () => {
  const { initialize, activeView, vaultPath, openVaultDialog } = useVaultStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] font-sans antialiased transition-colors duration-200">
      {/* Column 1: Sidebar (Navigation / Vault & Unified Obsidian Tree) */}
      <Sidebar />

      {/* Main Content Area */}
      {activeView === 'graph' ? (
        /* Fullscreen Interactive Physics Graph */
        <GraphView />
      ) : (
        /* Obsidian-Style Layout: Main Markdown Editor & Live Preview with Floating Inspector Card */
        <div className="flex-1 h-full flex relative overflow-hidden min-w-0">
          <EditorView />
          <InspectorPanel />
        </div>
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

      {/* Sync Manager Modal */}
      <SyncModal />

      {/* Spaced Repetition (Anki SM-2) Flashcard Session Modal */}
      <FlashcardModal />

      {/* Global Command Palette & Quick Switcher (Ctrl+K / Cmd+K) */}
      <CommandPalette />

      {/* Semantic Search & Smart Q&A Modal */}
      <SmartQAModal />
    </div>
  );
};

export default App;
