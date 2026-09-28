import React from 'react';
import { useVaultStore } from '../store/useVaultStore';
import {
  Search,
  Plus,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  Network,
  RotateCw,
  Check,
  AlertCircle,
  FileText,
  Sparkles,
  Brain,
} from 'lucide-react';
import { WindowControls } from './WindowControls';

export const TopBar: React.FC = () => {
  const {
    activeNotePath,
    notes,
    isDirty,
    isSaving,
    saveError,
    saveActiveNote,
    isSidebarOpen,
    toggleSidebar,
    isInspectorOpen,
    toggleInspector,
    openCommandPalette,
    createNewNote,
    activeView,
    setActiveView,
    openSmartQAModal,
    dueFlashcardsCount,
  } = useVaultStore();

  const activeNote = React.useMemo(() => {
    if (!activeNotePath) return null;
    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    const normalizedActive = norm(activeNotePath);
    return notes.find((n) => norm(n.path) === normalizedActive) || null;
  }, [notes, activeNotePath]);

  const handleQuickCapture = async () => {
    // Generate a default quick capture note or timestamped note
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}.${String(now.getMinutes()).padStart(2, '0')}`;
    const defaultTitle = `Quick Note ${timestamp}`;
    await createNewNote(defaultTitle);
  };

  return (
    <header
      data-tauri-drag-region
      className="h-14 w-full bg-[#0E1116] border-b border-[#272C36] px-4 flex items-center justify-between gap-4 select-none shrink-0 z-30"
    >
      {/* Left: Sidebar Toggle & Active Note Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-xl border border-transparent hover:border-[#272C36] hover:bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
          title={isSidebarOpen ? 'Chiudi Sidebar (Cmd+\\)' : 'Apri Sidebar (Cmd+\\)'}
        >
          {isSidebarOpen ? <PanelLeftClose size={16} strokeWidth={1.5} /> : <PanelLeft size={16} strokeWidth={1.5} />}
        </button>

        {!isSidebarOpen && (
          <div className="flex items-center gap-2 pr-1">
            <img src="/logo.png" alt="NoteRip" className="w-5 h-5 object-contain shrink-0" />
            <span className="font-semibold text-xs tracking-tight text-[#F3F4F6] hidden md:inline">NoteRip</span>
          </div>
        )}

        {activeNote ? (
          <div className="flex items-center gap-2 text-xs truncate">
            <span className="text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors truncate max-w-[120px] hidden sm:inline">
              {activeNote.folder || 'Vault'}
            </span>
            <span className="text-[#6B7280] hidden sm:inline">/</span>
            <div className="flex items-center gap-1.5 font-medium text-[#F3F4F6] truncate max-w-[180px] sm:max-w-[240px]">
              <FileText size={13} strokeWidth={1.5} className="text-[#9CA3AF] shrink-0" />
              <span className="truncate">{activeNote.title}</span>
            </div>

            {/* Save Status Indicator */}
            <div className="ml-1 text-[11px] text-[#9CA3AF] flex items-center gap-1 shrink-0">
              {saveError ? (
                <button
                  onClick={() => saveActiveNote()}
                  className="flex items-center gap-1 text-[#E5484D] hover:underline"
                  title={`Errore nel salvataggio: ${saveError}`}
                >
                  <AlertCircle size={12} strokeWidth={1.5} />
                  <span className="hidden md:inline">Riprova</span>
                </button>
              ) : isSaving ? (
                <span className="flex items-center gap-1 text-[#9CA3AF]">
                  <RotateCw size={11} strokeWidth={1.5} className="animate-spin text-[#E5484D]" />
                  <span className="hidden md:inline">Salvataggio...</span>
                </span>
              ) : isDirty ? (
                <button
                  onClick={() => saveActiveNote()}
                  className="flex items-center gap-1 text-[#9CA3AF] hover:text-[#F3F4F6]"
                  title="Modifiche non salvate (Ctrl+S)"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5484D]" />
                  <span className="hidden md:inline text-[10px]">Non salvato</span>
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[#6B7280]">
                  <Check size={12} strokeWidth={1.5} className="text-[#4ADE80]" />
                  <span className="hidden md:inline text-[10px]">Salvato</span>
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs text-[#9CA3AF] font-medium flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#272C36]" />
            <span>Nessuna nota aperta</span>
          </div>
        )}
      </div>

      {/* Center: Top Search Bar (Linear / Raycast Style) */}
      <div className="flex-1 max-w-md mx-auto hidden sm:block">
        <button
          type="button"
          onClick={() => openCommandPalette()}
          className="w-full h-9 px-3 rounded-xl bg-[#171B22] border border-[#272C36] hover:border-[#3A4150] hover:bg-[#1C212B] transition-colors flex items-center justify-between text-left group"
          title="Cerca nel Vault o esegui comandi (Ctrl+K o Cmd+K)"
        >
          <div className="flex items-center gap-2.5 text-xs text-[#9CA3AF] group-hover:text-[#F3F4F6] truncate">
            <Search size={14} strokeWidth={1.5} className="text-[#9CA3AF] shrink-0" />
            <span className="truncate">Cerca note, tag o comandi...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-[#131720] border border-[#272C36] rounded text-[#9CA3AF] group-hover:text-[#F3F4F6] shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Capture, Views and Right Properties Panel Toggle */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Mobile Search Icon trigger */}
        <button
          onClick={() => openCommandPalette()}
          className="sm:hidden p-2 rounded-xl border border-[#272C36] bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6]"
          title="Cerca (⌘K)"
        >
          <Search size={15} strokeWidth={1.5} />
        </button>

        {/* Quick Capture Button */}
        <button
          onClick={handleQuickCapture}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E5484D] hover:bg-[#F05D62] text-white text-xs font-medium transition-all shadow-subtle active:scale-[0.98]"
          title="Nuova Nota Rapida (Quick Capture)"
        >
          <Plus size={14} strokeWidth={2} />
          <span className="hidden xs:inline">Quick Capture</span>
        </button>

        {/* Graph View Toggle */}
        <button
          onClick={() => setActiveView(activeView === 'graph' ? 'notes' : 'graph')}
          className={`p-2 rounded-xl border transition-colors ${
            activeView === 'graph'
              ? 'border-[#E5484D] bg-[#171B22] text-[#E5484D]'
              : 'border-[#272C36] bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#3A4150]'
          }`}
          title={activeView === 'graph' ? 'Torna alle note' : 'Visualizza Grafo Connessioni'}
        >
          <Network size={15} strokeWidth={1.5} />
        </button>

        {/* Flashcards View Toggle */}
        <button
          onClick={() => setActiveView(activeView === 'flashcards' ? 'notes' : 'flashcards')}
          className={`relative p-2 rounded-xl border transition-colors ${
            activeView === 'flashcards'
              ? 'border-[#E5484D] bg-[#171B22] text-[#E5484D]'
              : 'border-[#272C36] bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#3A4150]'
          }`}
          title="Flashcards Spaced Repetition"
        >
          <Brain size={15} strokeWidth={1.5} />
          {dueFlashcardsCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold bg-[#E5484D] text-white flex items-center justify-center">
              {dueFlashcardsCount}
            </span>
          )}
        </button>

        {/* Smart Q&A Toggle */}
        <button
          onClick={() => openSmartQAModal()}
          className="p-2 rounded-xl border border-[#272C36] bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#3A4150] transition-colors"
          title="Chiedi al Vault (AI & Ricerca Semantica)"
        >
          <Sparkles size={15} strokeWidth={1.5} />
        </button>

        {/* Right Properties Panel Toggle */}
        <button
          onClick={toggleInspector}
          className={`p-2 rounded-xl border transition-colors ${
            isInspectorOpen
              ? 'border-[#E5484D] bg-[#171B22] text-[#E5484D]'
              : 'border-[#272C36] bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#3A4150]'
          }`}
          title={isInspectorOpen ? 'Nascondi Pannello Proprietà' : 'Mostra Pannello Proprietà (Backlinks, Tag, Info)'}
        >
          <PanelRight size={15} strokeWidth={1.5} />
        </button>

        {/* Subtle Divider */}
        <div className="w-[1px] h-4 bg-[#272C36] mx-0.5 shrink-0" />

        {/* macOS Traffic Lights Window Controls (Top Right) */}
        <WindowControls />
      </div>
    </header>
  );
};
