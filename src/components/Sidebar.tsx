import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import type { AppTheme, FileSortOption } from '../store/useVaultStore';
import type { FileNode } from '../types';
import {
  FolderOpen,
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
  Palette,
  Coffee,
  Moon,
  Sun,
  Cloud,
  RefreshCw,
  ChevronsUpDown,
  FileText,
  Folder,
  Brain,
  Sparkles,
  Bot,
} from 'lucide-react';

interface ThemeOption {
  id: AppTheme;
  name: string;
  category: 'Eye Comfort' | 'Classic';
  icon: React.ReactNode;
  bgPreview: string;
  accentPreview: string;
  isDark: boolean;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    category: 'Eye Comfort',
    icon: <Coffee size={14} className="text-purple-400" />,
    bgPreview: '#1e1e2e',
    accentPreview: '#cba6f7',
    isDark: true,
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    category: 'Eye Comfort',
    icon: <Coffee size={14} className="text-amber-600" />,
    bgPreview: '#eff1f5',
    accentPreview: '#8839ef',
    isDark: false,
  },
  {
    id: 'apple-dark',
    name: 'Apple Dark',
    category: 'Classic',
    icon: <Moon size={14} className="text-amber-400" />,
    bgPreview: '#121214',
    accentPreview: '#f59e0b',
    isDark: true,
  },
  {
    id: 'apple-light',
    name: 'Apple Light',
    category: 'Classic',
    icon: <Sun size={14} className="text-amber-500" />,
    bgPreview: '#f5f5f7',
    accentPreview: '#eaa824',
    isDark: false,
  },
];

const SORT_OPTIONS: { id: FileSortOption; label: string; desc: string }[] = [
  { id: 'name-asc', label: 'Nome (A - Z)', desc: 'Ordine alfabetico naturale' },
  { id: 'name-desc', label: 'Nome (Z - A)', desc: 'Ordine alfabetico inverso' },
  { id: 'date-newest', label: 'Modifica recente', desc: 'Note modificate di recente prima' },
  { id: 'date-oldest', label: 'Meno recenti', desc: 'Note create per prime' },
];

export const Sidebar: React.FC = () => {
  const {
    vaultPath,
    fileTree,
    activeNotePath,
    theme,
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
    setTheme,
    toggleSyncModal,
    setActiveView,
    dueFlashcardsCount,
    flashcards,
    openCommandPalette,
    openSmartQAModal,
  } = useVaultStore();

  const [searchTreeQuery, setSearchTreeQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // In-line creation state
  const [creatingItem, setCreatingItem] = useState<{
    type: 'file' | 'folder';
    parentFolderRel?: string;
  } | null>(null);
  const [createInputName, setCreateInputName] = useState('');

  const sortMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setShowThemeMenu(false);
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

  const currentThemeObj = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

  // Sort and filter tree nodes
  const processedTree = useMemo(() => {
    function sortNodes(nodes: FileNode[]): FileNode[] {
      const copy = [...nodes];
      copy.sort((a, b) => {
        // Folders always first (Obsidian standard)
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

    function filterNodes(nodes: FileNode[], query: string): FileNode[] {
      const q = query.toLowerCase();
      const result: FileNode[] = [];

      for (const node of nodes) {
        if (node.is_dir) {
          const filteredChildren = node.children ? filterNodes(node.children, query) : [];
          const nameMatches = node.name.toLowerCase().includes(q);
          if (nameMatches || filteredChildren.length > 0) {
            result.push({
              ...node,
              children: filteredChildren,
            });
          }
        } else {
          if (node.name.toLowerCase().includes(q)) {
            result.push(node);
          }
        }
      }
      return result;
    }

    let tree = sortNodes(fileTree);
    if (searchTreeQuery.trim()) {
      tree = filterNodes(tree, searchTreeQuery.trim());
    }
    return tree;
  }, [fileTree, sortOption, searchTreeQuery]);

  const handleStartCreate = (type: 'file' | 'folder', parentFolderRel?: string) => {
    setCreatingItem({ type, parentFolderRel });
    setCreateInputName('');
    if (parentFolderRel && vaultPath) {
      // Auto expand target folder
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
      className={`h-full flex flex-col apple-sidebar-panel apple-vibrant select-none transition-all duration-300 ease-in-out shrink-0 overflow-hidden relative border-r border-black/10 dark:border-white/10 ${
        isSidebarOpen ? 'w-72' : 'w-0 border-r-0 opacity-0 pointer-events-none'
      }`}
    >
      {/* 1. Header Toolbar (Vault Name & Obsidian Action Buttons) */}
      <div className="p-2.5 border-b border-black/5 dark:border-white/10 space-y-2 bg-black/[0.01] dark:bg-white/[0.01]">
        {/* Row 1: Title & Main Window Actions */}
        <div className="flex items-center justify-between">
          <div
            onClick={openVaultDialog}
            title={`Cartella Vault: ${vaultPath || 'Nessuna'}\nClicca per cambiare`}
            className="flex items-center space-x-2 min-w-0 cursor-pointer p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <div className="w-5 h-5 rounded-md bg-[var(--accent-subtle)] flex items-center justify-center text-[var(--accent)] shrink-0 shadow-xs">
              <FolderOpen size={12} />
            </div>
            <span className="text-xs font-bold text-[var(--text-primary)] truncate tracking-tight">
              {vaultName}
            </span>
          </div>

          <div className="flex items-center space-x-0.5">
            {/* Smart Q&A & Ricerca Semantica */}
            <button
              onClick={() => openSmartQAModal()}
              className="p-1.5 rounded-md hover:bg-purple-500/10 dark:hover:bg-purple-500/20 text-[var(--text-secondary)] hover:text-purple-500 transition-colors"
              title="Chiedi al Vault: Ricerca Semantica & Smart Q&A"
            >
              <Bot size={14} />
            </button>

            {/* Flashcard SM-2 Spaced Repetition Section */}
            <button
              onClick={() => setActiveView(activeView === 'flashcards' ? 'notes' : 'flashcards')}
              className={`relative p-1.5 rounded-md transition-colors ${
                activeView === 'flashcards'
                  ? 'bg-amber-500/15 text-amber-500 font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-amber-500 hover:bg-amber-500/10'
              }`}
              title={
                activeView === 'flashcards'
                  ? 'Torna alle note'
                  : `Sezione Flashcards SM-2 (${dueFlashcardsCount} in scadenza su ${flashcards.length} totali)`
              }
            >
              <Brain size={14} />
              {dueFlashcardsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold bg-amber-500 text-white flex items-center justify-center shadow-xs animate-pulse">
                  {dueFlashcardsCount}
                </span>
              )}
            </button>

            {/* 2D Graph View Toggle */}
            <button
              onClick={() => setActiveView(activeView === 'graph' ? 'notes' : 'graph')}
              className={`p-1.5 rounded-md transition-colors ${
                activeView === 'graph'
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title={activeView === 'graph' ? 'Torna alle note' : 'Visualizza Grafo 2D delle Connessioni'}
            >
              <Network size={14} />
            </button>

            {/* Collapse Sidebar Button */}
            <button
              onClick={toggleSidebar}
              title="Nascondi barra laterale (guadagna spazio editor)"
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
        </div>

        {/* Row 2: Obsidian-Style Tree Controls */}
        <div className="flex items-center justify-between pt-0.5 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center space-x-0.5">
            {/* New Note */}
            <button
              onClick={() => handleStartCreate('file')}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors"
              title="Nuova Nota (File Markdown) nella cartella radice"
            >
              <FilePlus size={14} />
            </button>

            {/* New Folder */}
            <button
              onClick={() => handleStartCreate('folder')}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors"
              title="Nuova Cartella"
            >
              <FolderPlus size={14} />
            </button>

            {/* Sort Popover Menu */}
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className={`p-1.5 rounded-md transition-colors ${
                  showSortMenu
                    ? 'bg-black/10 dark:bg-white/10 text-[var(--text-primary)]'
                    : 'hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-primary)]'
                }`}
                title="Ordina file e cartelle"
              >
                <ArrowUpDown size={14} />
              </button>

              {showSortMenu && (
                <div className="absolute top-8 left-0 w-52 rounded-xl apple-card-item shadow-apple-popover p-1.5 border border-black/10 dark:border-white/15 z-50 space-y-0.5 text-xs">
                  <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    Ordinamento File
                  </div>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortOption(opt.id);
                        setShowSortMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition-colors ${
                        sortOption === opt.id
                          ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div>
                        <div className="text-xs">{opt.label}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">{opt.desc}</div>
                      </div>
                      {sortOption === opt.id && <Check size={13} className="text-[var(--accent)]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Expand / Collapse All */}
            <button
              onClick={() => {
                const areAnyOpen = Object.values(expandedFolders).some(Boolean);
                if (areAnyOpen) {
                  collapseAllFolders();
                } else {
                  expandAllFolders();
                }
              }}
              className="p-1.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-primary)] transition-colors"
              title="Espandi o Comprimi tutte le cartelle"
            >
              <ChevronsUpDown size={14} />
            </button>
          </div>

          {/* Search Toggle */}
          <button
            onClick={() => {
              setShowSearchInput(!showSearchInput);
              if (showSearchInput) setSearchTreeQuery('');
            }}
            className={`p-1.5 rounded-md transition-colors ${
              showSearchInput || searchTreeQuery
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                : 'hover:bg-black/5 dark:hover:bg-white/10 hover:text-[var(--text-primary)]'
            }`}
            title="Cerca tra file e cartelle"
          >
            <Search size={14} />
          </button>
        </div>

        {/* Row 3: Command Palette Quick Trigger (Ctrl+K) */}
        <button
          onClick={() => openCommandPalette()}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/5 dark:hover:bg-white/10 text-xs text-[var(--text-secondary)] border border-black/5 dark:border-white/10 transition-colors shadow-2xs group"
          title="Apri Command Palette & Quick Switcher (Ctrl+K / Cmd+K)"
        >
          <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
            <Sparkles size={12} className="text-amber-500 group-hover:rotate-12 transition-transform" />
            <span>Command Palette</span>
          </span>
          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[var(--text-muted)] border border-black/5 dark:border-white/5">
            Ctrl+K
          </span>
        </button>

        {/* Inline Search Bar */}
        {(showSearchInput || searchTreeQuery) && (
          <div className="relative animate-in fade-in slide-in-from-top-1 duration-150 pt-1">
            <Search size={13} className="absolute left-2.5 top-3 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchTreeQuery}
              onChange={(e) => setSearchTreeQuery(e.target.value)}
              placeholder="Filtra file..."
              className="w-full pl-7 pr-7 py-1 text-xs rounded-lg border border-black/10 dark:border-white/15 bg-black/[0.03] dark:bg-white/[0.03] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text-muted)]"
              autoFocus
            />
            {searchTreeQuery && (
              <button
                onClick={() => setSearchTreeQuery('')}
                className="absolute right-2 top-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. File Tree Scrollable View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-xs select-none">
        {/* Inline Create Row at Root */}
        {creatingItem && !creatingItem.parentFolderRel && (
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/40 mb-1.5 animate-in fade-in duration-150">
            {creatingItem.type === 'file' ? (
              <FilePlus size={13} className="text-[var(--accent)] shrink-0 ml-1" />
            ) : (
              <FolderPlus size={13} className="text-[var(--accent)] shrink-0 ml-1" />
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
              className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              onClick={handleSubmitCreate}
              className="p-1 text-emerald-500 hover:bg-emerald-500/20 rounded transition-colors"
              title="Conferma (Invio)"
            >
              <Check size={13} />
            </button>
            <button
              onClick={handleCancelCreate}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 rounded transition-colors"
              title="Annulla (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Tree Nodes */}
        {processedTree.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)] space-y-2">
            <p>Nessun file o cartella trovato.</p>
            <button
              onClick={() => handleStartCreate('file')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] font-medium text-[11px] hover:opacity-80 transition-opacity"
            >
              <FilePlus size={12} />
              <span>Crea la prima nota</span>
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
              toggleFolder={toggleFolder}
              selectNote={selectNote}
              deleteNote={deleteNote}
              deleteFolder={deleteFolder}
              onStartCreate={handleStartCreate}
              setCreateInputName={setCreateInputName}
              onSubmitCreate={handleSubmitCreate}
              onCancelCreate={handleCancelCreate}
            />
          ))
        )}
      </div>

      {/* 3. Bottom Utility Bar: Git Sync, Themes & Local-First */}
      <div className="p-2.5 border-t border-black/5 dark:border-white/10 space-y-2 bg-black/[0.01] dark:bg-white/[0.01] relative">
        <div className="flex items-center justify-between text-xs">
          {/* Sync Button & Modal Trigger */}
          <button
            onClick={toggleSyncModal}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors"
            title="Gestisci Sincronizzazione Vault (Cartella Cloud, Git, P2P)"
          >
            <Cloud size={13} className="text-[var(--accent)]" />
            <span>Sync</span>
            {autoSyncInterval !== 'off' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs" title={`Auto-sync attivo: ${autoSyncInterval}`} />
            )}
            {gitStatus.isSyncing && <RefreshCw size={11} className="animate-spin ml-0.5 text-[var(--accent)]" />}
          </button>

          {/* Theme Selector Popover */}
          <div className="relative" ref={themeMenuRef}>
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center space-x-1.5 px-2 py-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-[11px]"
              title="Cambia tema (Catppuccin Mocha, Latte, Dark, Light)"
            >
              <Palette size={14} className="text-[var(--accent)]" />
              <span className="font-medium text-[10px] hidden sm:inline truncate max-w-[85px]">
                {currentThemeObj.name.replace('Catppuccin ', '')}
              </span>
            </button>

            {showThemeMenu && (
              <div className="absolute bottom-9 right-0 w-56 rounded-2xl apple-card-item shadow-apple-popover p-2 border border-black/10 dark:border-white/15 z-50 space-y-1">
                <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Temi & Riposo Visivo
                </div>
                {THEME_OPTIONS.map((opt) => {
                  const isSelected = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setTheme(opt.id);
                        setShowThemeMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)] font-semibold border border-[var(--border-strong)]'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-3.5 h-3.5 rounded-full border border-black/20 dark:border-white/20 shrink-0 shadow-xs"
                          style={{ backgroundColor: opt.bgPreview, borderColor: opt.accentPreview }}
                        />
                        <div className="text-left">
                          <span className="block text-xs leading-tight">{opt.name}</span>
                          <span className="text-[9px] text-[var(--text-muted)] block">
                            {opt.category === 'Eye Comfort' ? '★ Anti-affaticamento' : 'Stile OS'}
                          </span>
                        </div>
                      </div>
                      {isSelected && <Check size={14} className="text-[var(--accent)]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Local-First Indicator */}
        <div className="flex items-center justify-between pt-1 border-t border-black/5 dark:border-white/5 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Local-First Vault (.md)</span>
          </span>
          <span className="text-[9px]">Zero Lock-in</span>
        </div>
      </div>
    </aside>
  );
};

// ==========================================
// Recursive Tree Node Component (Obsidian Style)
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
  toggleFolder: (path: string) => void;
  selectNote: (path: string) => void;
  deleteNote: (path: string) => void;
  deleteFolder: (path: string) => void;
  onStartCreate: (type: 'file' | 'folder', parentFolderRel?: string) => void;
  setCreateInputName: (val: string) => void;
  onSubmitCreate: () => void;
  onCancelCreate: () => void;
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
  toggleFolder,
  selectNote,
  deleteNote,
  deleteFolder,
  onStartCreate,
  setCreateInputName,
  onSubmitCreate,
  onCancelCreate,
}) => {
  const isExpanded = expandedFolders[node.path] ?? false;
  const currentRel = parentRel ? `${parentRel}/${node.name}` : node.name;
  const isCreatingInside = creatingItem && creatingItem.parentFolderRel === currentRel;

  if (node.is_dir) {
    return (
      <div className="space-y-0.5">
        {/* Folder Row Header */}
        <div
          onClick={() => toggleFolder(node.path)}
          className={`group flex items-center justify-between ${
            depth === 0 ? 'px-2' : 'px-1.5'
          } py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5`}
        >
          <div className="flex items-center space-x-1.5 min-w-0">
            {/* Animated Rotating Chevron */}
            <span className="text-[var(--text-muted)] shrink-0 transition-transform duration-150 ease-out">
              <ChevronRight
                size={13}
                className={`transform transition-transform duration-150 ${
                  isExpanded ? 'rotate-90 text-[var(--text-primary)]' : ''
                }`}
              />
            </span>
            <Folder size={13} className="text-amber-500/80 dark:text-amber-400/80 shrink-0" />
            <span className="truncate text-xs font-medium tracking-tight">{node.name}</span>
          </div>

          {/* Folder Action Buttons (Show on hover) */}
          <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                useVaultStore.getState().openFlashcardSession(node.name);
              }}
              className="p-1 hover:bg-amber-500/15 hover:text-amber-500 rounded text-[var(--text-secondary)]"
              title={`Ripassa Flashcards di "${node.name}"`}
            >
              <Brain size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartCreate('file', currentRel);
              }}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title={`Nuova nota dentro "${node.name}"`}
            >
              <FilePlus size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartCreate('folder', currentRel);
              }}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              title={`Nuova sottocartella dentro "${node.name}"`}
            >
              <FolderPlus size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Eliminare la cartella "${node.name}" e tutto il suo contenuto?`)) {
                  deleteFolder(node.path);
                }
              }}
              className="p-1 hover:bg-rose-500/20 hover:text-rose-500 rounded text-[var(--text-muted)]"
              title="Elimina cartella"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Folder Children (Nested with vertical guide line like Obsidian) */}
        {isExpanded && (
          <div className="ml-2.5 pl-2 border-l border-black/10 dark:border-white/10 space-y-0.5 animate-in fade-in slide-in-from-top-0.5 duration-150">
            {/* Inline creation input inside this folder */}
            {isCreatingInside && (
              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[var(--accent-subtle)] border border-[var(--accent)]/40 my-1 animate-in fade-in duration-150">
                {creatingItem.type === 'file' ? (
                  <FilePlus size={12} className="text-[var(--accent)] shrink-0 ml-1" />
                ) : (
                  <FolderPlus size={12} className="text-[var(--accent)] shrink-0 ml-1" />
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
                  className="flex-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
                />
                <button
                  onClick={onSubmitCreate}
                  className="p-1 text-emerald-500 hover:bg-emerald-500/20 rounded transition-colors"
                  title="Conferma"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={onCancelCreate}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/5 rounded transition-colors"
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
                  toggleFolder={toggleFolder}
                  selectNote={selectNote}
                  deleteNote={deleteNote}
                  deleteFolder={deleteFolder}
                  onStartCreate={onStartCreate}
                  setCreateInputName={setCreateInputName}
                  onSubmitCreate={onSubmitCreate}
                  onCancelCreate={onCancelCreate}
                />
              ))
            ) : (
              !isCreatingInside && (
                <div className="py-1 px-2 text-[10px] text-[var(--text-muted)] italic">
                  Cartella vuota
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  // File / Note Item
  const isActive = activeNotePath === node.path;
  const cleanTitle = node.name.replace(/\.(md|markdown|txt)$/i, '');

  return (
    <div
      onClick={() => selectNote(node.path)}
      className={`group flex items-center justify-between ${
        depth === 0 ? 'px-2' : 'px-1.5'
      } py-1 rounded-lg text-xs cursor-pointer transition-all duration-150 ${
        isActive
          ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold shadow-xs'
          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <div className="flex items-center space-x-1.5 min-w-0">
        <FileText
          size={13}
          className={`shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
        />
        <span className="truncate text-xs tracking-tight">{cleanTitle}</span>
      </div>

      <div className="flex items-center space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            useVaultStore.getState().openFlashcardSession(null, node.path);
          }}
          className="p-1 hover:bg-amber-500/15 hover:text-amber-500 rounded text-[var(--text-muted)] transition-colors"
          title={`Ripassa Flashcards di "${cleanTitle}"`}
        >
          <Brain size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Eliminare la nota "${cleanTitle}"?`)) {
              deleteNote(node.path);
            }
          }}
          className="p-1 hover:bg-rose-500/20 hover:text-rose-500 rounded text-[var(--text-muted)] transition-colors"
          title="Elimina nota"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};
