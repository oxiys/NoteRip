import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { Search, Plus, Trash2, ArrowUpRight, ArrowDownLeft, X, PanelLeftOpen, Filter, Pencil } from 'lucide-react';

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

const ESTIMATED_ITEM_HEIGHT = 96;
const OVERSCAN = 3;

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
    renameNote,
    setSearchQuery,
    searchLimitDepth1,
    setSearchLimitDepth1,
  } = useVaultStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const rafIdRef = useRef<number | null>(null);

  // Context menu and inline rename state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; notePath: string; noteTitle: string } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  // Autofocus rename input
  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingPath]);

  const handleSubmitRename = async () => {
    if (renamingPath && renamingName.trim()) {
      await renameNote(renamingPath, renamingName);
    }
    setRenamingPath(null);
    setRenamingName('');
  };

  // Measure container height for virtualization
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Filter notes by selectedFolder, searchQuery, and folder depth limit (Item 4)
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Depth filter: if searchLimitDepth1 is true, only include root notes and direct child folder notes (depth <= 1)
      if (searchLimitDepth1 && note.folderDepth !== undefined && note.folderDepth > 1) {
        return false;
      }

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
  }, [notes, selectedFolder, searchQuery, searchLimitDepth1]);

  // Virtualization calculations (Item 13.2)
  const totalCount = filteredNotes.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ESTIMATED_ITEM_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + containerHeight) / ESTIMATED_ITEM_HEIGHT) + OVERSCAN);

  const visibleNotes = useMemo(() => {
    return filteredNotes.slice(startIndex, endIndex);
  }, [filteredNotes, startIndex, endIndex]);

  const topSpacerHeight = startIndex * ESTIMATED_ITEM_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ESTIMATED_ITEM_HEIGHT);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const targetScrollTop = e.currentTarget.scrollTop;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() => {
      setScrollTop(targetScrollTop);
    });
  };

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

        {/* Search Depth Filter Toggle Bar (Item 4) */}
        <div className="flex items-center justify-between pt-0.5 text-[10px]">
          <span className="text-[var(--text-muted)]">
            {totalCount} {totalCount === 1 ? 'nota' : 'note'}
          </span>
          <button
            onClick={() => setSearchLimitDepth1(!searchLimitDepth1)}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded border transition-colors ${
              searchLimitDepth1
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 font-semibold'
                : 'bg-black/5 dark:bg-white/5 text-[var(--text-muted)] border-black/5 dark:border-white/10 hover:text-[var(--text-primary)]'
            }`}
            title={
              searchLimitDepth1
                ? 'Filtro attivo: mostra solo cartelle dirette (profondità 1). Clicca per cercare in tutto il Vault.'
                : 'Filtro disattivo: mostra tutte le cartelle e sottocartelle. Clicca per limitare alle cartelle dirette.'
            }
          >
            <Filter size={10} />
            <span>{searchLimitDepth1 ? 'Solo cartelle dirette (prof. 1)' : 'Tutto il Vault'}</span>
          </button>
        </div>
      </div>

      {/* Virtualized Note List Scroll View (Item 13.2) */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-2"
      >
        {filteredNotes.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-[var(--text-muted)] space-y-2">
            <p className="text-xs font-medium">Nessuna nota trovata</p>
            <p className="text-[11px] text-[var(--text-secondary)]">
              {searchQuery ? 'Prova a modificare i termini di ricerca' : 'Crea la tua prima nota con il tasto +'}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Top Spacer for virtualized scroll offset */}
            <div style={{ height: topSpacerHeight }} aria-hidden="true" />

            {/* Rendered Slice of visible notes */}
            <div className="space-y-1.5">
              {visibleNotes.map((note) => {
                const isActive = note.path === activeNotePath;
                const isNoteRenaming = renamingPath === note.path;
                return (
                  <div
                    key={note.path}
                    onClick={() => !isNoteRenaming && selectNote(note.path)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, notePath: note.path, noteTitle: note.title });
                    }}
                    className={`group relative p-3 rounded-xl cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-[var(--accent-subtle)] border border-[var(--accent)] shadow-apple-sm'
                        : 'apple-card-item'
                    }`}
                  >
                    {/* Header: Title & Relative Time */}
                    <div className="flex items-baseline justify-between mb-1">
                      {isNoteRenaming ? (
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renamingName}
                          onChange={(e) => setRenamingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitRename();
                            if (e.key === 'Escape') { setRenamingPath(null); setRenamingName(''); }
                          }}
                          onBlur={handleSubmitRename}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-xs font-semibold pr-2 bg-transparent focus:outline-none border-b flex-1 ${
                            isActive
                              ? 'text-[var(--accent)] border-[var(--accent)]/50'
                              : 'text-[var(--text-primary)] border-[var(--accent)]/50'
                          }`}
                          placeholder="Nuovo nome..."
                        />
                      ) : (
                        <h3
                          className={`text-xs font-semibold truncate pr-2 ${
                            isActive ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {note.title}
                        </h3>
                      )}
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
              })}
            </div>

            {/* Bottom Spacer for virtualized scroll height */}
            <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
          </div>
        )}

        {/* Right-click Context Menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed z-[999] min-w-[160px] rounded-xl shadow-apple-popover border border-black/10 dark:border-white/15 p-1 text-xs apple-card-item"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                setRenamingPath(contextMenu.notePath);
                setRenamingName(contextMenu.noteTitle);
                setContextMenu(null);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[var(--text-primary)] hover:bg-[var(--accent-subtle)] hover:text-[var(--accent)] transition-colors"
            >
              <Pencil size={13} />
              <span>Rinomina</span>
            </button>
            <button
              onClick={() => {
                const { notePath, noteTitle } = contextMenu;
                setContextMenu(null);
                if (confirm(`Eliminare definitivamente "${noteTitle}" dal disco?`)) {
                  deleteNote(notePath);
                }
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-rose-500 hover:bg-rose-500/10 transition-colors"
            >
              <Trash2 size={13} />
              <span>Elimina</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
