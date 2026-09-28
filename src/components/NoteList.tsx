import React from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { Search, Plus, Trash2, ArrowUpRight, ArrowDownLeft, X, PanelLeftOpen } from 'lucide-react';


function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const oneDay = 24 * 60 * 60 * 1000;

  const date = new Date(timestamp);
  if (diff < oneDay && date.getDate() === new Date(now).getDate()) {
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  }

  if (diff < 2 * oneDay) {
    return 'Ieri';
  }

  if (diff < 7 * oneDay) {
    return date.toLocaleDateString('it-IT', { weekday: 'short' });
  }

  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export const NoteList: React.FC = () => {
  const {
    notes,
    activeNotePath,
    selectedFolder,
    searchQuery,
    isSidebarOpen,
    toggleSidebar,
    selectNote,
    createNewNote,
    deleteNote,
    setSearchQuery,
  } = useVaultStore();


  // Filter notes by selectedFolder and searchQuery
  const filteredNotes = React.useMemo(() => {
    return notes.filter((note) => {
      // Folder filter
      if (selectedFolder && note.folder !== selectedFolder) {
        return false;
      }

      // Search filter (in title, content, tags, or links)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inTitle = note.title.toLowerCase().includes(q);
        const inContent = note.content.toLowerCase().includes(q);
        const inTags = note.tags.some((t) => t.toLowerCase().includes(q));
        const inOutlinks = note.outlinks.some((l) => l.toLowerCase().includes(q));
        return inTitle || inContent || inTags || inOutlinks;
      }

      return true;
    });
  }, [notes, selectedFolder, searchQuery]);

  return (
    <div className="w-80 h-full flex flex-col apple-content-panel apple-vibrant-subtle border-r select-none">
      {/* Search & New Note Action Bar */}
      <div className="p-3 border-b border-black/5 dark:border-white/10 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={toggleSidebar}
                title="Mostra barra laterale"
                className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-300 transition-colors shrink-0"
              >
                <PanelLeftOpen size={15} />
              </button>
            )}
            <h2 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider truncate">
              {selectedFolder ? selectedFolder : 'Tutti gli Appunti'}
            </h2>
          </div>

          <button
            onClick={() => createNewNote(undefined, selectedFolder || undefined)}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] hover:opacity-90 text-white dark:text-neutral-900 shadow-apple-sm transition-all"
            title="Crea una nuova nota Markdown"
          >
            <Plus size={14} />
            <span>Nuova Nota</span>
          </button>
        </div>


        {/* Apple Style Search Field */}
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cerca negli appunti, #tag o [[link]]..."
            className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Note List Scroll View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredNotes.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-[var(--text-muted)] space-y-2">
            <p className="text-xs font-medium">Nessuna nota trovata</p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {searchQuery ? 'Prova a modificare i termini di ricerca' : 'Crea la tua prima nota con il tasto +'}
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isActive = note.path === activeNotePath;
            return (
              <div
                key={note.path}
                onClick={() => selectNote(note.path)}
                className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[var(--accent-subtle)] border border-[var(--accent)] shadow-apple-sm'
                    : 'apple-card-item'
                }`}
              >
                {/* Header: Title & Relative Time */}
                <div className="flex items-baseline justify-between mb-1">
                  <h3
                    className={`text-xs font-semibold truncate pr-2 ${
                      isActive ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {note.title}
                  </h3>
                  <span className="text-[10px] text-[var(--text-muted)] shrink-0 font-mono">
                    {formatRelativeDate(note.updated_at)}
                  </span>
                </div>

                {/* Subtitle: Apple Notes first-line preview */}
                <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                  {note.preview}
                </p>

                {/* Footer Metadata: Outlinks, Backlinks, Folder */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                  <div className="flex items-center space-x-2">
                    {note.outlinks.length > 0 && (
                      <span
                        className="flex items-center space-x-0.5 text-[var(--accent)] font-medium"
                        title={`${note.outlinks.length} outlinks`}
                      >
                        <ArrowUpRight size={11} />
                        <span>{note.outlinks.length}</span>
                      </span>
                    )}

                    {note.backlinks.length > 0 && (
                      <span
                        className="flex items-center space-x-0.5 text-[var(--accent-blue)] font-medium"
                        title={`${note.backlinks.length} backlinks`}
                      >
                        <ArrowDownLeft size={11} />
                        <span>{note.backlinks.length}</span>
                      </span>
                    )}

                    {note.folder && (
                      <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/5 truncate max-w-[90px]">
                        {note.folder}
                      </span>
                    )}
                  </div>

                  {/* Delete Button (visible on hover) */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Eliminare definitivamente "${note.title}" dal disco?`)) {
                        deleteNote(note.path);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/10 hover:text-rose-500 transition-opacity"
                    title="Elimina nota dal disco"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
