import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import type { FileSortOption } from '../store/useVaultStore';
import type { FileNode } from '../types';
import {
  FilePlus,
  FolderPlus,
  ArrowUpDown,
  Search,
  Network,
  PanelLeftClose,
  ChevronRight,
  Trash2,
  Check,
  X,
  Cloud,
  RefreshCw,
  FileText,
  Folder,
  Brain,
  Pencil,
  Hash,
  Sparkles,
  BookOpen,
} from 'lucide-react';

const SORT_OPTIONS: { id: FileSortOption; label: string; desc: string }[] = [
  { id: 'name-asc', label: 'Nome (A - Z)', desc: 'Ordine alfabetico naturale' },
  { id: 'name-desc', label: 'Nome (Z - A)', desc: 'Ordine alfabetico inverso' },
  { id: 'date-newest', label: 'Modifica recente', desc: 'Note modificate di recente' },
  { id: 'date-oldest', label: 'Meno recenti', desc: 'Note create per prime' },
];

export const Sidebar: React.FC = () => {
  const {
    vaultPath,
    fileTree,
    notes,
    activeNotePath,
    gitStatus,
    autoSyncInterval,
    sortOption,
    expandedFolders,
    isSidebarOpen,
    activeView,
    toggleSidebar,
    openVaultDialog,
    selectNote,
    createNewNote,
    createFolder,
    deleteNote,
    deleteFolder,
    setSortOption,
    toggleFolder,
    expandAllFolders,
    collapseAllFolders,
    toggleSyncModal,
    setActiveView,
    dueFlashcardsCount,
    flashcards,
    openSmartQAModal,
    renameNote,
    selectedTag,
    setSelectedTag,
  } = useVaultStore();

  const [searchTreeQuery, setSearchTreeQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // In-line creation state
  const [creatingItem, setCreatingItem] = useState<{
    type: 'file' | 'folder';
    parentFolderRel?: string;
  } | null>(null);
  const [createInputName, setCreateInputName] = useState('');

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Inline rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofocus creation input
  useEffect(() => {
    if (creatingItem && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [creatingItem]);

  const vaultName = useMemo(() => {
    if (!vaultPath) return 'Vault NoteRip';
    const clean = vaultPath.replace(/\\/g, '/').replace(/\/$/, '');
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'Vault';
  }, [vaultPath]);

  // Aggregate all tags across all notes with counts
  const allTagsWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) {
      if (n.tags && Array.isArray(n.tags)) {
        for (const t of n.tags) {
          map.set(t, (map.get(t) || 0) + 1);
        }
      }
    }
    return Array.from(map.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [notes]);

  // Sort and filter tree nodes
  const processedTree = useMemo(() => {
    function sortNodes(nodes: FileNode[]): FileNode[] {
      const copy = [...nodes];
      copy.sort((a, b) => {
        // Folders always first
        if (a.is_dir && !b.is_dir) return -1;
        if (!a.is_dir && b.is_dir) return 1;

        if (sortOption === 'name-asc') {
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        if (sortOption === 'name-desc') {
          return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        if (sortOption === 'date-newest') {
          return (b.updated_at || 0) - (a.updated_at || 0);
        }
        if (sortOption === 'date-oldest') {
          return (a.updated_at || 0) - (b.updated_at || 0);
        }
        return 0;
      });

      return copy.map((node) => {
        if (node.is_dir && node.children) {
          return {
            ...node,
            children: sortNodes(node.children),
          };
        }
        return node;
      });
    }

    function filterNodes(nodes: FileNode[], query: string, tagFilter: string | null): FileNode[] {
      const q = query.toLowerCase();
      const result: FileNode[] = [];

      for (const node of nodes) {
        if (node.is_dir) {
          const filteredChildren = node.children ? filterNodes(node.children, query, tagFilter) : [];
          const nameMatches = !tagFilter && node.name.toLowerCase().includes(q);
          if (nameMatches || filteredChildren.length > 0) {
            result.push({
              ...node,
              children: filteredChildren,
            });
          }
        } else {
          // If filtering by tag, check if note has the tag
          if (tagFilter) {
            const normPath = node.path.replace(/\\/g, '/').toLowerCase();
            const noteObj = notes.find((n) => n.path.replace(/\\/g, '/').toLowerCase() === normPath);
            const matchesTag = noteObj?.tags?.includes(tagFilter);
            const matchesQuery = !query.trim() || node.name.toLowerCase().includes(q);
            if (matchesTag && matchesQuery) {
              result.push(node);
            }
          } else {
            if (node.name.toLowerCase().includes(q)) {
              result.push(node);
            }
          }
        }
      }
      return result;
    }

    let tree = sortNodes(fileTree);
    if (searchTreeQuery.trim() || selectedTag) {
      tree = filterNodes(tree, searchTreeQuery.trim(), selectedTag);
    }
    return tree;
  }, [fileTree, sortOption, searchTreeQuery, selectedTag, notes]);

  const handleStartCreate = (type: 'file' | 'folder', parentFolderRel?: string) => {
    setCreatingItem({ type, parentFolderRel });
    setCreateInputName('');
    if (parentFolderRel && vaultPath) {
      useVaultStore.getState().setFolderExpanded(`${vaultPath}/${parentFolderRel}`, true);
    }
  };

  const handleSubmitCreate = async () => {
    if (!createInputName.trim()) {
      setCreatingItem(null);
      return;
    }

    const name = createInputName.trim();
    if (creatingItem?.type === 'file') {
      await createNewNote(name, creatingItem.parentFolderRel);
    } else if (creatingItem?.type === 'folder') {
      await createFolder(name, creatingItem.parentFolderRel);
    }

    setCreatingItem(null);
    setCreateInputName('');
  };

  const handleCancelCreate = () => {
    setCreatingItem(null);
    setCreateInputName('');
  };

  return (
    <aside
      className={`h-full flex flex-col bg-[#131720] border-r border-[#272C36] select-none transition-all duration-200 ease-in-out shrink-0 overflow-hidden relative ${
        isSidebarOpen ? 'w-64 md:w-72' : 'w-0 border-r-0 opacity-0 pointer-events-none'
      }`}
    >
      {/* 1. Header Toolbar: App Name & Vault Switcher */}
      <div data-tauri-drag-region className="p-3 border-b border-[#272C36] space-y-2.5">
        <div className="flex items-center justify-between">
          <div
            onClick={openVaultDialog}
            title={`Vault: ${vaultPath || 'Nessuno'}\nClicca per cambiare cartella`}
            className="flex items-center gap-2.5 min-w-0 cursor-pointer p-1 rounded-xl hover:bg-[#171B22] border border-transparent hover:border-[#272C36] transition-colors"
          >
            <div className="w-7 h-7 rounded-xl bg-[#171B22] border border-[#272C36] flex items-center justify-center p-1 shrink-0 overflow-hidden shadow-2xs">
              <img src="/logo.png" alt="NoteRip Logo" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-semibold text-[#F3F4F6] truncate tracking-tight">
                {vaultName}
              </span>
              <span className="block text-[10px] text-[#9CA3AF] truncate">
                {notes.length} {notes.length === 1 ? 'nota' : 'note'}
              </span>
            </div>
          </div>

          <button
            onClick={toggleSidebar}
            title="Chiudi Sidebar"
            className="p-1.5 rounded-xl border border-transparent hover:border-[#272C36] hover:bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
          >
            <PanelLeftClose size={15} strokeWidth={1.5} />
          </button>
        </div>

        {/* Primary Views Section: Notebooks / Graph / Flashcards / Ask */}
        <div className="space-y-0.5 pt-1">
          <button
            onClick={() => setActiveView('notes')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              activeView === 'notes'
                ? 'bg-[#171B22] text-[#F3F4F6] border border-[#272C36]'
                : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <BookOpen
                size={14}
                strokeWidth={1.5}
                className={activeView === 'notes' ? 'text-[#E5484D]' : 'text-[#9CA3AF]'}
              />
              <span>Note & Taccuini</span>
            </div>
            <span className="text-[10px] font-mono text-[#6B7280]">{notes.length}</span>
          </button>

          <button
            onClick={() => setActiveView('graph')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              activeView === 'graph'
                ? 'bg-[#171B22] text-[#F3F4F6] border border-[#272C36]'
                : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Network
                size={14}
                strokeWidth={1.5}
                className={activeView === 'graph' ? 'text-[#E5484D]' : 'text-[#9CA3AF]'}
              />
              <span>Grafo Connessioni</span>
            </div>
            <span className="text-[10px] text-[#6B7280]">2D</span>
          </button>

          <button
            onClick={() => setActiveView('flashcards')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              activeView === 'flashcards'
                ? 'bg-[#171B22] text-[#F3F4F6] border border-[#272C36]'
                : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Brain
                size={14}
                strokeWidth={1.5}
                className={activeView === 'flashcards' ? 'text-[#E5484D]' : 'text-[#9CA3AF]'}
              />
              <span>Flashcards (SM-2)</span>
            </div>
            {dueFlashcardsCount > 0 ? (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#E5484D] text-white">
                {dueFlashcardsCount}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-[#6B7280]">{flashcards.length}</span>
            )}
          </button>

          <button
            onClick={() => openSmartQAModal()}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.5} className="text-[#9CA3AF]" />
              <span>Chiedi al Vault</span>
            </div>
            <span className="text-[9px] px-1 py-0.5 rounded bg-[#171B22] border border-[#272C36] text-[#9CA3AF]">
              ⌘Q
            </span>
          </button>
        </div>
      </div>

      {/* 2. Main Middle Area: Notebooks File Tree + Tags */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {/* Notebooks / Files Section Header */}
        <div>
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
            <span>Taccuini & File</span>
            <div className="flex items-center gap-1 text-[#9CA3AF]">
              <button
                onClick={() => handleStartCreate('file')}
                className="p-1 rounded hover:bg-[#171B22] hover:text-[#F3F4F6] transition-colors"
                title="Nuova Nota"
              >
                <FilePlus size={13} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => handleStartCreate('folder')}
                className="p-1 rounded hover:bg-[#171B22] hover:text-[#F3F4F6] transition-colors"
                title="Nuova Cartella"
              >
                <FolderPlus size={13} strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setShowSearchInput(!showSearchInput)}
                className={`p-1 rounded transition-colors ${
                  showSearchInput || searchTreeQuery
                    ? 'bg-[#171B22] text-[#E5484D]'
                    : 'hover:bg-[#171B22] hover:text-[#F3F4F6]'
                }`}
                title="Filtra file"
              >
                <Search size={13} strokeWidth={1.5} />
              </button>
              {/* Sort Menu */}
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="p-1 rounded hover:bg-[#171B22] hover:text-[#F3F4F6] transition-colors"
                  title="Ordina note"
                >
                  <ArrowUpDown size={13} strokeWidth={1.5} />
                </button>
                {showSortMenu && (
                  <div className="absolute top-6 right-0 w-48 rounded-xl bg-[#171B22] border border-[#272C36] shadow-popover p-1 z-50 space-y-0.5">
                    <div className="px-2 py-1 text-[10px] font-bold text-[#6B7280] uppercase">
                      Ordina per
                    </div>
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setSortOption(opt.id);
                          setShowSortMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                          sortOption === opt.id
                            ? 'bg-[#131720] text-[#E5484D] font-medium'
                            : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {sortOption === opt.id && <Check size={12} strokeWidth={2} />}
                      </button>
                    ))}
                    <div className="border-t border-[#272C36] my-1" />
                    <button
                      onClick={() => {
                        expandAllFolders();
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] rounded-lg"
                    >
                      Espandi tutto
                    </button>
                    <button
                      onClick={() => {
                        collapseAllFolders();
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-2 py-1 text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] rounded-lg"
                    >
                      Comprimi tutto
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inline Filter Input */}
          {(showSearchInput || searchTreeQuery) && (
            <div className="mb-2 px-1">
              <div className="flex items-center px-2 py-1 rounded-xl bg-[#171B22] border border-[#272C36] text-xs">
                <Search size={12} strokeWidth={1.5} className="text-[#6B7280] mr-1.5 shrink-0" />
                <input
                  type="text"
                  value={searchTreeQuery}
                  onChange={(e) => setSearchTreeQuery(e.target.value)}
                  placeholder="Filtra per nome..."
                  className="bg-transparent flex-1 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none"
                />
                {searchTreeQuery && (
                  <button onClick={() => setSearchTreeQuery('')} className="text-[#6B7280] hover:text-[#F3F4F6]">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Root inline creation */}
          {creatingItem && !creatingItem.parentFolderRel && (
            <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-[#171B22] border border-[#E5484D] my-1">
              {creatingItem.type === 'file' ? (
                <FilePlus size={13} strokeWidth={1.5} className="text-[#E5484D] shrink-0 ml-1" />
              ) : (
                <FolderPlus size={13} strokeWidth={1.5} className="text-[#E5484D] shrink-0 ml-1" />
              )}
              <input
                ref={createInputRef}
                type="text"
                value={createInputName}
                onChange={(e) => setCreateInputName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitCreate();
                  if (e.key === 'Escape') handleCancelCreate();
                }}
                placeholder={creatingItem.type === 'file' ? 'Nome nota...' : 'Nome cartella...'}
                className="flex-1 bg-transparent text-xs text-[#F3F4F6] focus:outline-none placeholder-[#6B7280]"
              />
              <button
                onClick={handleSubmitCreate}
                className="p-1 text-[#4ADE80] hover:bg-[#131720] rounded"
                title="Conferma"
              >
                <Check size={12} strokeWidth={2} />
              </button>
              <button
                onClick={handleCancelCreate}
                className="p-1 text-[#6B7280] hover:text-[#F3F4F6] hover:bg-[#131720] rounded"
                title="Annulla"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Tree Nodes List */}
          <div className="space-y-0.5">
            {processedTree.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#6B7280] space-y-2">
                <p>Nessun appunto trovato.</p>
                <button
                  onClick={() => handleStartCreate('file')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#171B22] border border-[#272C36] text-[#F3F4F6] text-xs hover:border-[#E5484D] transition-colors"
                >
                  <FilePlus size={12} strokeWidth={1.5} />
                  <span>Crea prima nota</span>
                </button>
              </div>
            ) : (
              processedTree.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  depth={0}
                  parentRel=""
                  vaultPath={vaultPath || ''}
                  activeNotePath={activeNotePath}
                  expandedFolders={expandedFolders}
                  creatingItem={creatingItem}
                  createInputName={createInputName}
                  createInputRef={createInputRef}
                  renamingPath={renamingPath}
                  renamingName={renamingName}
                  toggleFolder={toggleFolder}
                  selectNote={selectNote}
                  deleteNote={deleteNote}
                  deleteFolder={deleteFolder}
                  renameNote={renameNote}
                  onStartCreate={handleStartCreate}
                  setCreateInputName={setCreateInputName}
                  onSubmitCreate={handleSubmitCreate}
                  onCancelCreate={handleCancelCreate}
                  onStartRename={(path, currentName) => {
                    setRenamingPath(path);
                    setRenamingName(currentName);
                  }}
                  setRenamingName={setRenamingName}
                  onSubmitRename={async () => {
                    if (renamingPath && renamingName.trim()) {
                      await renameNote(renamingPath, renamingName);
                    }
                    setRenamingPath(null);
                    setRenamingName('');
                  }}
                  onCancelRename={() => {
                    setRenamingPath(null);
                    setRenamingName('');
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* 3. Dedicated Tags Section (Prompt requirement: Notebooks, Tags and Graph) */}
        <div className="pt-2 border-t border-[#272C36]">
          <div className="flex items-center justify-between px-2 pb-1.5 text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
            <div className="flex items-center gap-1.5">
              <Hash size={12} strokeWidth={1.5} />
              <span>Tag ({allTagsWithCounts.length})</span>
            </div>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="text-[10px] text-[#E5484D] hover:underline flex items-center gap-0.5"
                title="Cancella filtro tag"
              >
                <span>Cancella</span>
                <X size={10} />
              </button>
            )}
          </div>

          {allTagsWithCounts.length === 0 ? (
            <p className="px-2 text-xs text-[#6B7280] italic">
              Nessun tag. Aggiungi <span className="font-mono text-[#9CA3AF]">#tag</span> nelle note.
            </p>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto pr-1">
              {allTagsWithCounts.map(({ tag, count }) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(isSelected ? null : tag)}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors ${
                      isSelected
                        ? 'bg-[#171B22] text-[#F3F4F6] border border-[#E5484D] font-medium'
                        : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-[#E5484D] font-mono text-[11px]">#</span>
                      <span className="truncate">{tag}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[#6B7280] bg-[#131720] px-1.5 py-0.2 rounded border border-[#272C36]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Utility Bar: Git Sync & Local-First indicator */}
      <div className="p-3 border-t border-[#272C36] bg-[#0E1116] space-y-2">
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={toggleSyncModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[#171B22] border border-[#272C36] hover:border-[#3A4150] text-[#F3F4F6] transition-colors"
            title="Gestisci Sincronizzazione Vault (Git / Cloud)"
          >
            <Cloud size={13} strokeWidth={1.5} className="text-[#9CA3AF]" />
            <span>Sync</span>
            {autoSyncInterval !== 'off' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" title={`Auto-sync: ${autoSyncInterval}`} />
            )}
            {gitStatus.isSyncing && <RefreshCw size={11} strokeWidth={1.5} className="animate-spin text-[#E5484D]" />}
          </button>

          <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
            <span>Local-First</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

// ==========================================
// Recursive Tree Node Component
// ==========================================
interface TreeNodeProps {
  node: FileNode;
  depth: number;
  parentRel: string;
  vaultPath: string;
  activeNotePath: string | null;
  expandedFolders: Record<string, boolean>;
  creatingItem: { type: 'file' | 'folder'; parentFolderRel?: string } | null;
  createInputName: string;
  createInputRef: React.RefObject<HTMLInputElement | null>;
  renamingPath: string | null;
  renamingName: string;
  toggleFolder: (path: string) => void;
  selectNote: (path: string) => void;
  deleteNote: (path: string) => void;
  deleteFolder: (path: string) => void;
  renameNote: (oldPath: string, newName: string) => Promise<void>;
  onStartCreate: (type: 'file' | 'folder', parentFolderRel?: string) => void;
  setCreateInputName: (val: string) => void;
  onSubmitCreate: () => void;
  onCancelCreate: () => void;
  onStartRename: (path: string, currentName: string) => void;
  setRenamingName: (val: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  depth,
  parentRel,
  vaultPath,
  activeNotePath,
  expandedFolders,
  creatingItem,
  createInputName,
  createInputRef,
  renamingPath,
  renamingName,
  toggleFolder,
  selectNote,
  deleteNote,
  deleteFolder,
  renameNote,
  onStartCreate,
  setCreateInputName,
  onSubmitCreate,
  onCancelCreate,
  onStartRename,
  setRenamingName,
  onSubmitRename,
  onCancelRename,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedFolders[node.path] ?? false;
  const currentRel = parentRel ? `${parentRel}/${node.name}` : node.name;
  const isCreatingInside = creatingItem && creatingItem.parentFolderRel === currentRel;
  const isRenaming = renamingPath === node.path;

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

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  if (node.is_dir) {
    return (
      <div className="space-y-0.5">
        <div
          onClick={() => toggleFolder(node.path)}
          className={`group flex items-center justify-between ${
            depth === 0 ? 'px-2' : 'px-1.5'
          } py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[#6B7280] shrink-0 transition-transform duration-150 ease-out">
              <ChevronRight
                size={13}
                strokeWidth={1.5}
                className={`transform transition-transform ${isExpanded ? 'rotate-90 text-[#F3F4F6]' : ''}`}
              />
            </span>
            <Folder size={13} strokeWidth={1.5} className="text-[#9CA3AF] shrink-0" />
            <span className="truncate text-xs font-medium">{node.name}</span>
          </div>

          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartCreate('file', currentRel);
              }}
              className="p-1 hover:bg-[#1C212B] rounded text-[#9CA3AF] hover:text-[#F3F4F6]"
              title={`Nuova nota dentro "${node.name}"`}
            >
              <FilePlus size={12} strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartCreate('folder', currentRel);
              }}
              className="p-1 hover:bg-[#1C212B] rounded text-[#9CA3AF] hover:text-[#F3F4F6]"
              title={`Nuova sottocartella`}
            >
              <FolderPlus size={12} strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Eliminare la cartella "${node.name}" e il suo contenuto?`)) {
                  deleteFolder(node.path);
                }
              }}
              className="p-1 hover:bg-[#E5484D]/20 hover:text-[#E5484D] rounded text-[#6B7280]"
              title="Elimina cartella"
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="ml-2.5 pl-2 border-l border-[#272C36] space-y-0.5">
            {isCreatingInside && (
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#171B22] border border-[#E5484D] my-1">
                {creatingItem.type === 'file' ? (
                  <FilePlus size={12} strokeWidth={1.5} className="text-[#E5484D] shrink-0 ml-1" />
                ) : (
                  <FolderPlus size={12} strokeWidth={1.5} className="text-[#E5484D] shrink-0 ml-1" />
                )}
                <input
                  ref={createInputRef}
                  type="text"
                  value={createInputName}
                  onChange={(e) => setCreateInputName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSubmitCreate();
                    if (e.key === 'Escape') onCancelCreate();
                  }}
                  placeholder={creatingItem.type === 'file' ? 'Nome nota...' : 'Nome cartella...'}
                  className="flex-1 bg-transparent text-xs text-[#F3F4F6] focus:outline-none placeholder-[#6B7280]"
                />
                <button
                  onClick={onSubmitCreate}
                  className="p-1 text-[#4ADE80] hover:bg-[#131720] rounded"
                  title="Conferma"
                >
                  <Check size={12} strokeWidth={2} />
                </button>
                <button
                  onClick={onCancelCreate}
                  className="p-1 text-[#6B7280] hover:text-[#F3F4F6] hover:bg-[#131720] rounded"
                  title="Annulla"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {node.children && node.children.length > 0 ? (
              node.children.map((child) => (
                <TreeNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  parentRel={currentRel}
                  vaultPath={vaultPath}
                  activeNotePath={activeNotePath}
                  expandedFolders={expandedFolders}
                  creatingItem={creatingItem}
                  createInputName={createInputName}
                  createInputRef={createInputRef}
                  renamingPath={renamingPath}
                  renamingName={renamingName}
                  toggleFolder={toggleFolder}
                  selectNote={selectNote}
                  deleteNote={deleteNote}
                  deleteFolder={deleteFolder}
                  renameNote={renameNote}
                  onStartCreate={onStartCreate}
                  setCreateInputName={setCreateInputName}
                  onSubmitCreate={onSubmitCreate}
                  onCancelCreate={onCancelCreate}
                  onStartRename={onStartRename}
                  setRenamingName={setRenamingName}
                  onSubmitRename={onSubmitRename}
                  onCancelRename={onCancelRename}
                />
              ))
            ) : (
              !isCreatingInside && (
                <div className="py-1 px-2 text-[10px] text-[#6B7280] italic">
                  Cartella vuota
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  // File Item
  const isActive = activeNotePath === node.path;
  const cleanTitle = node.name.replace(/\.(md|markdown|txt)$/i, '');

  return (
    <div className="relative">
      <div
        onClick={() => !isRenaming && selectNote(node.path)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        className={`group flex items-center justify-between ${
          depth === 0 ? 'px-2.5' : 'px-2'
        } py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
          isActive
            ? 'bg-[#171B22] border-l-2 border-[#E5484D] text-[#F3F4F6] font-medium'
            : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText
            size={13}
            strokeWidth={1.5}
            className={`shrink-0 ${isActive ? 'text-[#E5484D]' : 'text-[#6B7280]'}`}
          />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              onBlur={onSubmitRename}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent text-xs font-medium focus:outline-none border-b border-[#E5484D] text-[#F3F4F6]"
              placeholder="Nuovo nome..."
            />
          ) : (
            <span className={`truncate text-xs ${isActive ? 'text-[#F3F4F6]' : ''}`}>
              {cleanTitle}
            </span>
          )}
        </div>

        {!isRenaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartRename(node.path, cleanTitle);
              }}
              className="p-1 rounded text-[#6B7280] hover:text-[#F3F4F6] hover:bg-[#1C212B]"
              title="Rinomina nota"
            >
              <Pencil size={12} strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Eliminare la nota "${cleanTitle}"?`)) {
                  deleteNote(node.path);
                }
              }}
              className="p-1 rounded text-[#6B7280] hover:text-[#E5484D] hover:bg-[#E5484D]/20"
              title="Elimina nota"
            >
              <Trash2 size={12} strokeWidth={1.5} />
            </button>
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-[999] min-w-[160px] rounded-xl shadow-popover border border-[#272C36] p-1 text-xs bg-[#171B22]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => {
              setContextMenu(null);
              onStartRename(node.path, cleanTitle);
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
          >
            <Pencil size={13} strokeWidth={1.5} />
            <span>Rinomina</span>
          </button>
          <button
            onClick={() => {
              setContextMenu(null);
              if (confirm(`Eliminare la nota "${cleanTitle}"?`)) {
                deleteNote(node.path);
              }
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#E5484D] hover:bg-[#E5484D]/15 transition-colors"
          >
            <Trash2 size={13} strokeWidth={1.5} />
            <span>Elimina</span>
          </button>
        </div>
      )}
    </div>
  );
};
