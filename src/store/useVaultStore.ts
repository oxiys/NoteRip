import { create } from 'zustand';
import type {
  FileNode,
  NoteItem,
  GitSyncResult,
  FlashcardItem,
  FlashcardProgress,
  FlashcardRating,
} from '../types';
import { tauriBridge } from '../services/tauriBridge';
import { computeBidirectionalLinks, normalizeNoteName } from '../services/indexer';
import {
  loadStandaloneFlashcards,
  saveStandaloneFlashcards,
  createDefaultProgress,
  generateCardId,
  calculateSM2Review,
  getDueCards,
} from '../services/flashcardService';
import { semanticSearchEngine } from '../services/semanticSearchService';

export type AppTheme = 'crimson-noir';
export type AutoSyncOption = 'off' | 'on_save' | '5m' | '15m';
export type FileSortOption = 'name-asc' | 'name-desc' | 'date-newest' | 'date-oldest';

export interface GraphSettings {
  showWikiLinks: boolean;
  showMentions: boolean;
  mentionConfidence: 'alta' | 'media' | 'bassa';
  showSharedTags: boolean;
  minSharedTags: number;
  groupByFolder: boolean;
  showOrphans: boolean;
  searchFilter: string;
}

interface VaultState {
  vaultPath: string | null;
  fileTree: FileNode[];
  notes: NoteItem[];
  activeNotePath: string | null;
  activeNoteContent: string;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
  lastSavedTime: number | null;
  selectedFolder: string | null;
  selectedTag: string | null;
  searchQuery: string;
  activeView: 'notes' | 'graph' | 'flashcards';
  isInspectorOpen: boolean;
  isSidebarOpen: boolean;
  theme: AppTheme;
  isDarkMode: boolean;
  autoLinkMentions: boolean;
  graphSettings: GraphSettings;
  gitStatus: {
    isSyncing: boolean;
    lastResult: GitSyncResult | null;
    error: string | null;
  };
  isSyncModalOpen: boolean;
  autoSyncInterval: AutoSyncOption;
  lastSyncTime: number | null;
  sortOption: FileSortOption;
  expandedFolders: Record<string, boolean>;
  saveTimeoutId: number | null;
  editorWidth: number; // in pixels, or -1 for 100% full width

  // Auto-Save Configuration
  autoSaveMode: 'manual' | '2s' | 'on_blur';
  setAutoSaveMode: (mode: 'manual' | '2s' | 'on_blur') => void;

  // Search Limitation (up to 1 folder depth after root)
  searchLimitDepth1: boolean;
  setSearchLimitDepth1: (limit: boolean) => void;

  // Custom System Fonts & Typography
  appFont: string;
  editorFont: string;
  fontSize: number;
  isFontModalOpen: boolean;
  setAppFont: (font: string) => void;
  setEditorFont: (font: string) => void;
  setFontSize: (size: number) => void;
  toggleFontModal: () => void;

  // Flashcards & Spaced Repetition (Anki SM-2)
  isFlashcardModalOpen: boolean;
  flashcardTargetFolder: string | null;
  flashcardTargetNotePath: string | null;
  flashcards: FlashcardItem[];
  dueFlashcardsCount: number;
  flashcardProgressMap: Record<string, FlashcardProgress>;
  isNewFlashcardModalOpen: boolean;
  newFlashcardInitialFront: string;
  newFlashcardInitialBack: string;
  newFlashcardInitialDeck: string;
  openNewFlashcardModal: (front?: string, back?: string, deck?: string) => void;
  closeNewFlashcardModal: () => void;

  // Confirmation Modal (Custom dialog replacing window.confirm)
  confirmDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
    resolve?: (value: boolean) => void;
  };
  requestConfirm: (params: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDanger?: boolean;
  }) => Promise<boolean>;
  handleConfirmDialogResponse: (confirmed: boolean) => void;

  // In-App Toast Notifications (replacing window.alert)
  toasts: Array<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>;
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  removeToast: (id: string) => void;

  // Auto Flashcard Modal (Smart AI & Heuristic Generation)
  isAutoFlashcardModalOpen: boolean;
  autoFlashcardInitialText: string;
  autoFlashcardInitialTitle: string;
  autoFlashcardInitialDeck: string;
  openAutoFlashcardModal: (initialText?: string, initialTitle?: string, initialDeck?: string) => void;
  closeAutoFlashcardModal: () => void;

  addFlashcardsBatch: (cards: Array<{
    front: string;
    back: string;
    deck?: string;
    tags?: string[];
    notePath?: string;
    noteTitle?: string;
  }>) => Promise<FlashcardItem[]>;

  // History & Undo / Redo
  undoStack: string[];
  redoStack: string[];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Actions
  initialize: () => Promise<void>;
  openVaultDialog: () => Promise<void>;
  loadVault: (path: string) => Promise<void>;
  selectNote: (path: string) => Promise<void>;
  updateActiveContent: (content: string, isAtomic?: boolean) => void;
  saveActiveNote: () => Promise<void>;
  createNewNote: (title?: string, folder?: string) => Promise<string | null>;
  createFolder: (folderName: string, parentFolder?: string) => Promise<string | null>;
  deleteNote: (path: string) => Promise<void>;
  deleteFolder: (folderPath: string) => Promise<void>;
  renameNote: (oldPath: string, newName: string) => Promise<void>;
  navigateToWikiLink: (targetName: string) => Promise<void>;
  runGitSync: (commitMsg?: string) => Promise<void>;
  setSelectedFolder: (folder: string | null) => void;
  setSelectedTag: (tag: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSortOption: (option: FileSortOption) => void;
  toggleFolder: (path: string) => void;
  setFolderExpanded: (path: string, expanded: boolean) => void;
  expandAllFolders: () => void;
  collapseAllFolders: () => void;
  setActiveView: (view: 'notes' | 'graph' | 'flashcards') => void;
  toggleInspector: () => void;
  toggleSidebar: () => void;
  toggleDarkMode: () => void;
  setTheme: (theme: AppTheme) => void;
  setEditorWidth: (width: number) => void;
  toggleAutoLinkMentions: () => void;
  updateGraphSettings: (settings: Partial<GraphSettings>) => void;
  linkMentionInNote: (sourcePath: string, targetTitle: string, mentionText: string) => Promise<void>;
  setIsSyncModalOpen: (open: boolean) => void;
  toggleSyncModal: () => void;
  setAutoSyncInterval: (interval: AutoSyncOption) => void;

  // Flashcard Actions (Standalone Spaced Repetition)
  loadFlashcards: () => Promise<void>;
  addFlashcard: (card: {
    deck: string;
    front: string;
    back: string;
    tags?: string[];
    notePath?: string;
    noteTitle?: string;
  }) => Promise<FlashcardItem>;
  updateFlashcard: (id: string, updates: Partial<FlashcardItem>) => Promise<void>;
  deleteFlashcard: (id: string) => Promise<void>;
  resetFlashcardProgress: (id: string) => Promise<void>;
  openFlashcardSession: (targetFolder?: string | null, targetNotePath?: string | null) => void;
  closeFlashcardSession: () => void;
  recordCardReview: (cardId: string, rating: FlashcardRating) => Promise<void>;
  refreshFlashcards: () => Promise<void>;

  // Command Palette & Quick Switcher (Ctrl+K / Cmd+K)
  isCommandPaletteOpen: boolean;
  commandPaletteInitialQuery: string;
  openCommandPalette: (initialQuery?: string) => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;

  // Semantic Search & Smart Q&A
  isSmartQAModalOpen: boolean;
  smartQAInitialQuestion: string;
  openSmartQAModal: (initialQuestion?: string) => void;
  closeSmartQAModal: () => void;
  toggleSmartQAModal: () => void;
}

const VAULT_PATH_KEY = 'noterip_last_vault_path';
const THEME_KEY = 'noterip_app_theme';
const AUTO_SYNC_KEY = 'noterip_auto_sync_interval';
const EDITOR_WIDTH_KEY = 'noterip_editor_width';
const AUTOSAVE_MODE_KEY = 'noterip_autosave_mode';
const SEARCH_DEPTH_KEY = 'noterip_search_limit_depth1';
const APP_FONT_KEY = 'noterip_app_font';
const EDITOR_FONT_KEY = 'noterip_editor_font';
const FONT_SIZE_KEY = 'noterip_editor_font_size';

export function applyFonts(appFont: string, editorFont: string, fontSize?: number) {
  const root = document.documentElement;
  if (appFont && appFont.trim()) {
    root.style.setProperty('--app-font-family', `"${appFont}", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`);
  } else {
    root.style.removeProperty('--app-font-family');
  }
  if (editorFont && editorFont.trim()) {
    root.style.setProperty('--editor-font-family', `"${editorFont}", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`);
  } else {
    root.style.removeProperty('--editor-font-family');
  }
  if (fontSize && fontSize >= 11 && fontSize <= 24) {
    root.style.setProperty('--editor-font-size', `${fontSize}px`);
  }
}

function getInitialAutoSaveMode(): 'manual' | '2s' | 'on_blur' {
  const saved = localStorage.getItem(AUTOSAVE_MODE_KEY);
  if (saved === 'manual' || saved === '2s' || saved === 'on_blur') {
    return saved;
  }
  // Default to manual to prevent persistent background saving and Windows Defender locks
  return 'manual';
}

function getInitialSearchDepth(): boolean {
  const saved = localStorage.getItem(SEARCH_DEPTH_KEY);
  if (saved !== null) {
    return saved === 'true';
  }
  return true; // Limit search to root and direct child folder by default
}

function getInitialAppFont(): string {
  return localStorage.getItem(APP_FONT_KEY) || '';
}

function getInitialEditorFont(): string {
  return localStorage.getItem(EDITOR_FONT_KEY) || '';
}

function getInitialFontSize(): number {
  const saved = localStorage.getItem(FONT_SIZE_KEY);
  if (saved) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 11 && parsed <= 24) return parsed;
  }
  return 14;
}

function getInitialEditorWidth(): number {
  try {
    const saved = localStorage.getItem(EDITOR_WIDTH_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && (parsed === -1 || (parsed >= 600 && parsed <= 3000))) {
        return parsed;
      }
    }
  } catch {}
  return 960;
}

let periodicSyncTimer: ReturnType<typeof setInterval> | null = null;

function setupPeriodicSync(interval: AutoSyncOption, runSync: () => void) {
  if (periodicSyncTimer) {
    clearInterval(periodicSyncTimer);
    periodicSyncTimer = null;
  }
  if (interval === '5m') {
    periodicSyncTimer = setInterval(runSync, 5 * 60 * 1000);
  } else if (interval === '15m') {
    periodicSyncTimer = setInterval(runSync, 15 * 60 * 1000);
  }
}

function getInitialAutoSync(): AutoSyncOption {
  const saved = localStorage.getItem(AUTO_SYNC_KEY);
  if (saved === 'off' || saved === 'on_save' || saved === '5m' || saved === '15m') {
    return saved;
  }
  return 'off';
}

export function applyAppTheme(_theme: AppTheme = 'crimson-noir') {
  const root = document.documentElement;
  root.classList.remove('theme-mocha', 'theme-latte', 'theme-dark', 'theme-light');
  root.classList.add('dark', 'theme-crimson-noir');
  root.setAttribute('data-theme', 'crimson-noir');
}

let lastHistorySnapshotTime = 0;

export const useVaultStore = create<VaultState>((set, get) => {
  const initialAutoSync = getInitialAutoSync();

  return {
    vaultPath: null,
    fileTree: [],
    notes: [],
    activeNotePath: null,
    activeNoteContent: '',
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
    isDirty: false,
    isSaving: false,
    saveError: null,
    lastSavedTime: null,
    selectedFolder: null,
    selectedTag: null,
    searchQuery: '',
    activeView: 'notes',
    isSidebarOpen: true,
    isInspectorOpen: true,
    theme: 'crimson-noir',
    isDarkMode: true,
    autoLinkMentions: true, // Default to true so intelligent connections are active

    graphSettings: {
      showWikiLinks: true,
      showMentions: true,
      mentionConfidence: 'media',
      showSharedTags: true,
      minSharedTags: 1,
      groupByFolder: true,
      showOrphans: true,
      searchFilter: '',
    },

    gitStatus: {
      isSyncing: false,
      lastResult: null,
      error: null,
    },
    isSyncModalOpen: false,
    autoSyncInterval: initialAutoSync,
    lastSyncTime: null,
    sortOption: 'name-asc',
    expandedFolders: {},
    saveTimeoutId: null,
    editorWidth: getInitialEditorWidth(),
    isFlashcardModalOpen: false,
    flashcardTargetFolder: null,
    flashcardTargetNotePath: null,
    flashcards: [],
    dueFlashcardsCount: 0,
    flashcardProgressMap: {},
    isCommandPaletteOpen: false,
    commandPaletteInitialQuery: '',
    isSmartQAModalOpen: false,
    smartQAInitialQuestion: '',

    autoSaveMode: getInitialAutoSaveMode(),
    searchLimitDepth1: getInitialSearchDepth(),
    appFont: getInitialAppFont(),
    editorFont: getInitialEditorFont(),
    fontSize: getInitialFontSize(),
    isFontModalOpen: false,
    isNewFlashcardModalOpen: false,
    newFlashcardInitialFront: '',
    newFlashcardInitialBack: '',
    newFlashcardInitialDeck: '',
    confirmDialog: {
      isOpen: false,
      title: '',
      message: '',
      confirmLabel: 'Conferma',
      cancelLabel: 'Annulla',
      isDanger: true,
      resolve: undefined,
    },
    toasts: [],
    isAutoFlashcardModalOpen: false,
    autoFlashcardInitialText: '',
    autoFlashcardInitialTitle: '',
    autoFlashcardInitialDeck: '',

    initialize: async () => {
      applyAppTheme('crimson-noir');

      const appFont = getInitialAppFont();
      const editorFont = getInitialEditorFont();
      const fontSize = getInitialFontSize();
      applyFonts(appFont, editorFont, fontSize);

      const syncPref = getInitialAutoSync();
      setupPeriodicSync(syncPref, () => {
        get().runGitSync('Auto-sync periodico');
      });

      await get().refreshFlashcards();

      const savedPath = localStorage.getItem(VAULT_PATH_KEY);
      if (savedPath) {
        await get().loadVault(savedPath);
      } else {
        const defaultVault = await tauriBridge.selectVault();
        if (defaultVault) {
          await get().loadVault(defaultVault);
        }
      }
    },

    openVaultDialog: async () => {
      try {
        const selected = await tauriBridge.selectVault();
        if (selected) {
          localStorage.setItem(VAULT_PATH_KEY, selected);
          await get().loadVault(selected);
        }
      } catch (err) {
        console.error('Failed to open vault dialog:', err);
      }
    },

    loadVault: async (vaultPath: string) => {
      try {
        const tree = await tauriBridge.scanVault(vaultPath);
        const rawNotesMap = new Map<string, { path: string; title: string; rel_path: string; content: string; updated_at: number; folder: string; folderDepth?: number }>();

        const noteFiles: Array<{ node: FileNode; currentPath: string }> = [];
        function findNoteFiles(nodes: FileNode[], currentPath: string) {
          for (const node of nodes) {
            if (node.is_dir && node.children) {
              const nextPath = currentPath ? `${currentPath}/${node.name}` : node.name;
              findNoteFiles(node.children, nextPath);
            } else if (!node.is_dir) {
              const ext = node.extension?.toLowerCase() || '';
              if (ext === 'md' || ext === 'markdown' || ext === 'txt' || node.name.endsWith('.md')) {
                noteFiles.push({ node, currentPath });
              }
            }
          }
        }
        findNoteFiles(tree, '');

        // Load notes in concurrent batches of 15 to prevent IPC thread locking and memory spikes
        const BATCH_SIZE = 15;
        for (let b = 0; b < noteFiles.length; b += BATCH_SIZE) {
          const slice = noteFiles.slice(b, b + BATCH_SIZE);
          await Promise.all(
            slice.map(async ({ node, currentPath }) => {
              try {
                const content = await tauriBridge.readNote(node.path);
                const title = node.name.replace(/\.(md|markdown|txt)$/i, '');
                const rel_path = currentPath ? `${currentPath}/${node.name}` : node.name;
                const pathParts = rel_path.split('/');
                const folder = pathParts.length > 1 ? pathParts[0] : 'Root';
                const folderDepth = pathParts.length - 1;
                rawNotesMap.set(node.path, {
                  path: node.path,
                  title,
                  rel_path,
                  content,
                  updated_at: node.updated_at || Date.now(),
                  folder,
                  folderDepth,
                });
              } catch (e) {
                console.warn(`Could not read note ${node.path}:`, e);
              }
            })
          );
        }

        const indexedNotes = computeBidirectionalLinks(rawNotesMap);
        indexedNotes.sort((a, b) => b.updated_at - a.updated_at);

        // Folders start completely collapsed when opening the application (Item 12)
        const initialExpanded: Record<string, boolean> = { ...get().expandedFolders };

        set({
          vaultPath,
          fileTree: tree,
          notes: indexedNotes,
          expandedFolders: initialExpanded,
        });

        get().refreshFlashcards();
        // Defer semantic indexing to idle callback to keep startup memory low
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
            semanticSearchEngine.indexVault(indexedNotes);
          });
        } else {
          setTimeout(() => semanticSearchEngine.indexVault(indexedNotes), 2500);
        }

        const currentActive = get().activeNotePath;
        if (currentActive && rawNotesMap.has(currentActive)) {
          const item = rawNotesMap.get(currentActive)!;
          set({ activeNoteContent: item.content, isDirty: false });
        } else if (indexedNotes.length > 0) {
          await get().selectNote(indexedNotes[0].path);
        }
      } catch (err) {
        console.error('Failed to load vault:', err);
      }
    },

    selectNote: async (path: string) => {
      if (get().isDirty) {
        await get().saveActiveNote();
      }

      try {
        const content = await tauriBridge.readNote(path);
        const safeContent = content ?? '';
        lastHistorySnapshotTime = Date.now();
        set({
          activeNotePath: path,
          activeNoteContent: safeContent,
          activeView: 'notes',
          undoStack: [safeContent],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          isDirty: false,
          isSaving: false,
          saveError: null,
        });
      } catch (err) {
        console.error('Failed to read note:', err);
      }
    },

    updateActiveContent: (content: string, isAtomic: boolean = false) => {
      const { activeNotePath, activeNoteContent, undoStack, saveTimeoutId, autoSaveMode } = get();
      if (!activeNotePath || content === activeNoteContent) return;

      const now = Date.now();
      let newUndoStack = [...undoStack];

      if (isAtomic) {
        newUndoStack.push(activeNoteContent);
        if (newUndoStack.length > 50) newUndoStack.shift();
        lastHistorySnapshotTime = now;
      } else if (now - lastHistorySnapshotTime > 800) {
        newUndoStack.push(activeNoteContent);
        if (newUndoStack.length > 50) newUndoStack.shift();
        lastHistorySnapshotTime = now;
      }

      if (saveTimeoutId) {
        window.clearTimeout(saveTimeoutId);
      }

      // Auto-save: only set timer if autoSaveMode is '2s'
      let timeoutId: number | null = null;
      if (autoSaveMode === '2s') {
        timeoutId = window.setTimeout(() => {
          get().saveActiveNote();
        }, 2000);
      }

      set({
        activeNoteContent: content,
        undoStack: newUndoStack,
        redoStack: [],
        canUndo: newUndoStack.length > 0,
        canRedo: false,
        isDirty: true,
        saveError: null,
        saveTimeoutId: timeoutId,
      });
    },

    undo: () => {
      const { activeNotePath, activeNoteContent, undoStack, redoStack, saveTimeoutId } = get();
      if (!activeNotePath || undoStack.length === 0) return;

      const newUndoStack = [...undoStack];
      const prevContent = newUndoStack.pop();
      if (prevContent === undefined) return;

      const newRedoStack = [...redoStack, activeNoteContent];

      if (saveTimeoutId) {
        window.clearTimeout(saveTimeoutId);
      }
      const timeoutId = window.setTimeout(() => {
        get().saveActiveNote();
      }, 800);

      lastHistorySnapshotTime = Date.now();
      set({
        activeNoteContent: prevContent,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: true,
        isDirty: true,
        saveTimeoutId: timeoutId,
      });
    },

    redo: () => {
      const { activeNotePath, activeNoteContent, undoStack, redoStack, saveTimeoutId } = get();
      if (!activeNotePath || redoStack.length === 0) return;

      const newRedoStack = [...redoStack];
      const nextContent = newRedoStack.pop();
      if (nextContent === undefined) return;

      const newUndoStack = [...undoStack, activeNoteContent];

      if (saveTimeoutId) {
        window.clearTimeout(saveTimeoutId);
      }
      const timeoutId = window.setTimeout(() => {
        get().saveActiveNote();
      }, 800);

      lastHistorySnapshotTime = Date.now();
      set({
        activeNoteContent: nextContent,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: true,
        canRedo: newRedoStack.length > 0,
        isDirty: true,
        saveTimeoutId: timeoutId,
      });
    },

    saveActiveNote: async () => {
      const { activeNotePath, activeNoteContent, vaultPath, notes, saveTimeoutId } = get();
      if (!activeNotePath || !vaultPath) return;

      if (saveTimeoutId) {
        window.clearTimeout(saveTimeoutId);
      }

      set({ isSaving: true, saveTimeoutId: null });

      try {
        await tauriBridge.writeNote(activeNotePath, activeNoteContent);

        const updatedNotesMap = new Map<string, { path: string; title: string; rel_path: string; content: string; updated_at: number; folder: string; folderDepth?: number }>();

        notes.forEach((n) => {
          if (n.path === activeNotePath) {
            updatedNotesMap.set(n.path, {
              path: n.path,
              title: n.title,
              rel_path: n.rel_path,
              content: activeNoteContent,
              updated_at: Date.now(),
              folder: n.folder,
              folderDepth: n.folderDepth,
            });
          } else {
            updatedNotesMap.set(n.path, {
              path: n.path,
              title: n.title,
              rel_path: n.rel_path,
              content: n.content,
              updated_at: n.updated_at,
              folder: n.folder,
              folderDepth: n.folderDepth,
            });
          }
        });

        const reindexed = computeBidirectionalLinks(updatedNotesMap);
        reindexed.sort((a, b) => b.updated_at - a.updated_at);

        set({
          isDirty: false,
          isSaving: false,
          saveError: null,
          lastSavedTime: Date.now(),
          notes: reindexed,
          saveTimeoutId: null,
        });

        // Defer semantic re-indexing on save
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
            semanticSearchEngine.indexVault(reindexed);
          });
        } else {
          setTimeout(() => semanticSearchEngine.indexVault(reindexed), 1000);
        }

        // Auto-sync on save if enabled (rate-limited / only if not already syncing)
        if (get().autoSyncInterval === 'on_save' && !get().gitStatus.isSyncing) {
          get().runGitSync('Auto-sync: salvataggio nota');
        }
      } catch (err) {
        console.error('Failed to save note:', err);
        set({
          isSaving: false,
          saveError: err instanceof Error ? err.message : String(err),
          saveTimeoutId: null,
        });
      }
    },

    createNewNote: async (title?: string, folder?: string) => {
      const { vaultPath } = get();
      if (!vaultPath) return null;

      const baseTitle = title?.trim() || `Nuova Nota ${new Date().toLocaleDateString('it-IT')}`;
      const cleanTitle = normalizeNoteName(baseTitle);
      const cleanFolder = folder ? folder.trim().replace(/^\//, '').replace(/\/$/, '') : '';
      const relFolder = cleanFolder ? `${cleanFolder}/` : '';
      const relPath = `${relFolder}${cleanTitle}.md`;

      try {
        const initialContent = `# ${cleanTitle}\n\n`;
        const createdPath = await tauriBridge.createNote(vaultPath, relPath, initialContent);
        
        await get().loadVault(vaultPath);
        if (cleanFolder) {
          get().setFolderExpanded(`${vaultPath}/${cleanFolder}`, true);
        }
        await get().selectNote(createdPath);
        return createdPath;
      } catch (err) {
        console.error('Failed to create new note:', err);
        return null;
      }
    },

    createFolder: async (folderName: string, parentFolder?: string) => {
      const { vaultPath, loadVault } = get();
      if (!vaultPath) return null;
      const cleanName = folderName.trim();
      if (!cleanName) return null;
      const cleanParent = parentFolder ? parentFolder.trim().replace(/^\//, '').replace(/\/$/, '') : '';
      const relPath = cleanParent ? `${cleanParent}/${cleanName}` : cleanName;
      try {
        const created = await tauriBridge.createFolder(vaultPath, relPath);
        await loadVault(vaultPath);
        get().setFolderExpanded(created, true);
        if (cleanParent) {
          get().setFolderExpanded(`${vaultPath}/${cleanParent}`, true);
        }
        return created;
      } catch (err) {
        console.error('Failed to create folder:', err);
        return null;
      }
    },

    deleteFolder: async (folderPath: string) => {
      const { vaultPath, loadVault, activeNotePath } = get();
      if (!vaultPath) return;
      try {
        await tauriBridge.deleteNote(folderPath);
        if (activeNotePath && activeNotePath.startsWith(folderPath)) {
          set({ activeNotePath: null, activeNoteContent: '', isDirty: false });
        }
        await loadVault(vaultPath);
      } catch (err) {
        console.error('Failed to delete folder:', err);
      }
    },

    deleteNote: async (path: string) => {
      const { vaultPath, notes, activeNotePath } = get();
      if (!vaultPath) return;

      try {
        await tauriBridge.deleteNote(path);
        const remaining = notes.filter((n) => n.path !== path);
        
        let nextActive: string | null = null;
        if (activeNotePath === path) {
          nextActive = remaining.length > 0 ? remaining[0].path : null;
        } else {
          nextActive = activeNotePath;
        }

        await get().loadVault(vaultPath);

        if (nextActive) {
          await get().selectNote(nextActive);
        } else {
          set({ activeNotePath: null, activeNoteContent: '', isDirty: false });
        }
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    },

    renameNote: async (oldPath: string, newName: string) => {
      const { vaultPath, activeNotePath } = get();
      if (!vaultPath) return;

      try {
        // Build new path: same directory, new filename
        const separator = oldPath.includes('\\') ? '\\' : '/';
        const parts = oldPath.split(separator);
        const oldExt = parts[parts.length - 1].match(/\.[^.]+$/)?.[0] || '.md';
        const cleanName = newName.trim().replace(/\.(md|markdown|txt)$/i, '');
        if (!cleanName) return;
        parts[parts.length - 1] = `${cleanName}${oldExt}`;
        const newPath = parts.join(separator);

        if (newPath === oldPath) return;

        await tauriBridge.renameNote(oldPath, newPath);
        await get().loadVault(vaultPath);

        // If the renamed note was active, re-select it at its new path
        if (activeNotePath === oldPath) {
          await get().selectNote(newPath);
        }
      } catch (err) {
        console.error('Failed to rename note:', err);
      }
    },

    navigateToWikiLink: async (targetName: string) => {
      const { notes } = get();
      const cleanTarget = normalizeNoteName(targetName).toLowerCase();

      const found = notes.find(
        (n) => n.title.toLowerCase() === cleanTarget || normalizeNoteName(n.rel_path).toLowerCase() === cleanTarget
      );

      if (found) {
        await get().selectNote(found.path);
      } else {
        await get().createNewNote(targetName);
      }
    },

    runGitSync: async (commitMsg?: string) => {
      const { vaultPath } = get();
      if (!vaultPath) return;

      set({ gitStatus: { isSyncing: true, lastResult: null, error: null } });

      try {
        const result = await tauriBridge.gitSyncVault(vaultPath, commitMsg);
        set({
          gitStatus: {
            isSyncing: false,
            lastResult: result,
            error: null,
          },
          lastSyncTime: Date.now(),
        });
      } catch (err: unknown) {
        set({
          gitStatus: {
            isSyncing: false,
            lastResult: null,
            error: String(err),
          },
        });
      }
    },

    setSelectedFolder: (folder: string | null) => set({ selectedFolder: folder }),
    setSelectedTag: (tag: string | null) => set({ selectedTag: tag }),
    setSearchQuery: (query: string) => set({ searchQuery: query }),
    setActiveView: (view: 'notes' | 'graph' | 'flashcards') => set({ activeView: view }),
    toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

    setTheme: (_newTheme: AppTheme) => {
      localStorage.setItem(THEME_KEY, 'crimson-noir');
      applyAppTheme('crimson-noir');
      set({
        theme: 'crimson-noir',
        isDarkMode: true,
      });
    },

    toggleDarkMode: () => {
      applyAppTheme('crimson-noir');
      set({ theme: 'crimson-noir', isDarkMode: true });
    },

    setEditorWidth: (width: number) => {
      try {
        localStorage.setItem(EDITOR_WIDTH_KEY, String(width));
      } catch {}
      set({ editorWidth: width });
    },

    toggleAutoLinkMentions: () => set((state) => ({ autoLinkMentions: !state.autoLinkMentions })),

    updateGraphSettings: (newSettings: Partial<GraphSettings>) => {
      set((state) => ({
        graphSettings: {
          ...state.graphSettings,
          ...newSettings,
        },
      }));
    },

    linkMentionInNote: async (sourcePath: string, targetTitle: string, mentionText: string) => {
      const { notes, activeNotePath, updateActiveContent, loadVault, vaultPath } = get();
      const sourceNote = notes.find((n) => n.path === sourcePath);
      if (!sourceNote) return;

      const currentContent = activeNotePath === sourcePath ? get().activeNoteContent : sourceNote.content;
      const cleanMention = mentionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      let replaced = false;
      let regex: RegExp;
      try {
        regex = new RegExp(`(?<!\\[\\[)(?<![\\p{L}\\p{N}])(${cleanMention})(?![\\p{L}\\p{N}])(?!\\]\\])`, 'ui');
      } catch {
        regex = new RegExp(`(?<!\\[\\[)(?:^|\\b)(${cleanMention})(?:\\b|$)(?!\\]\\])`, 'i');
      }

      const replacement =
        mentionText.toLowerCase() === targetTitle.toLowerCase()
          ? `[[${targetTitle}]]`
          : `[[${targetTitle}|${mentionText}]]`;

      const newContent = currentContent.replace(regex, (match) => {
        if (!replaced) {
          replaced = true;
          return replacement;
        }
        return match;
      });

      if (newContent !== currentContent) {
        if (activeNotePath === sourcePath) {
          updateActiveContent(newContent);
          await get().saveActiveNote();
        } else {
          await tauriBridge.writeNote(sourcePath, newContent);
          if (vaultPath) await loadVault(vaultPath);
        }
      }
    },

    setIsSyncModalOpen: (open: boolean) => set({ isSyncModalOpen: open }),
    toggleSyncModal: () => set((state) => ({ isSyncModalOpen: !state.isSyncModalOpen })),
    setAutoSyncInterval: (interval: AutoSyncOption) => {
      localStorage.setItem(AUTO_SYNC_KEY, interval);
      set({ autoSyncInterval: interval });
      setupPeriodicSync(interval, () => {
        get().runGitSync('Auto-sync periodico');
      });
    },

    setSortOption: (option: FileSortOption) => set({ sortOption: option }),
    toggleFolder: (path: string) =>
      set((state) => ({
        expandedFolders: {
          ...state.expandedFolders,
          [path]: !state.expandedFolders[path],
        },
      })),
    setFolderExpanded: (path: string, expanded: boolean) =>
      set((state) => ({
        expandedFolders: {
          ...state.expandedFolders,
          [path]: expanded,
        },
      })),
    expandAllFolders: () => {
      const { fileTree } = get();
      const all: Record<string, boolean> = {};
      function traverse(nodes: FileNode[]) {
        for (const n of nodes) {
          if (n.is_dir) {
            all[n.path] = true;
            if (n.children) traverse(n.children);
          }
        }
      }
      traverse(fileTree);
      set({ expandedFolders: all });
    },
    collapseAllFolders: () => {
      set({ expandedFolders: {} });
    },

    loadFlashcards: async () => {
      await get().refreshFlashcards();
    },

    refreshFlashcards: async () => {
      const { vaultPath } = get();
      const cards = await loadStandaloneFlashcards(vaultPath);
      const dueCount = getDueCards(cards).length;
      set({
        flashcards: cards,
        dueFlashcardsCount: dueCount,
      });
    },

    addFlashcard: async (cardData) => {
      const { flashcards, vaultPath } = get();
      const newCard: FlashcardItem = {
        id: generateCardId(),
        deck: cardData.deck?.trim() || 'Generale',
        front: cardData.front.trim(),
        back: cardData.back.trim(),
        tags: cardData.tags || [],
        notePath: cardData.notePath,
        noteTitle: cardData.noteTitle,
        progress: createDefaultProgress(),
        createdAt: Date.now(),
      };
      const updated = [newCard, ...flashcards];
      const dueCount = getDueCards(updated).length;
      set({ flashcards: updated, dueFlashcardsCount: dueCount });
      await saveStandaloneFlashcards(updated, vaultPath);
      return newCard;
    },

    addFlashcardsBatch: async (cardsData) => {
      const { flashcards, vaultPath } = get();
      const newCards = cardsData.map((c) => ({
        id: generateCardId(),
        deck: c.deck?.trim() || 'Generale',
        front: c.front.trim(),
        back: c.back.trim(),
        tags: c.tags || [],
        notePath: c.notePath,
        noteTitle: c.noteTitle,
        progress: createDefaultProgress(),
        createdAt: Date.now(),
      }));
      const updated = [...newCards, ...flashcards];
      const dueCount = getDueCards(updated).length;
      set({ flashcards: updated, dueFlashcardsCount: dueCount });
      await saveStandaloneFlashcards(updated, vaultPath);
      return newCards;
    },

    updateFlashcard: async (id: string, updates: Partial<FlashcardItem>) => {
      const { flashcards, vaultPath } = get();
      const updated = flashcards.map((c) =>
        c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
      );
      const dueCount = getDueCards(updated).length;
      set({ flashcards: updated, dueFlashcardsCount: dueCount });
      await saveStandaloneFlashcards(updated, vaultPath);
    },

    deleteFlashcard: async (id: string) => {
      const { flashcards, vaultPath } = get();
      const updated = flashcards.filter((c) => c.id !== id);
      const dueCount = getDueCards(updated).length;
      set({ flashcards: updated, dueFlashcardsCount: dueCount });
      await saveStandaloneFlashcards(updated, vaultPath);
    },

    resetFlashcardProgress: async (id: string) => {
      const { flashcards, vaultPath } = get();
      const updated = flashcards.map((c) =>
        c.id === id ? { ...c, progress: createDefaultProgress() } : c
      );
      const dueCount = getDueCards(updated).length;
      set({ flashcards: updated, dueFlashcardsCount: dueCount });
      await saveStandaloneFlashcards(updated, vaultPath);
    },

    openFlashcardSession: (targetFolder = null, targetNotePath = null) => {
      get().refreshFlashcards();
      set({
        isFlashcardModalOpen: true,
        flashcardTargetFolder: targetFolder,
        flashcardTargetNotePath: targetNotePath,
      });
    },

    closeFlashcardSession: () => {
      set({
        isFlashcardModalOpen: false,
        flashcardTargetFolder: null,
        flashcardTargetNotePath: null,
      });
    },

    recordCardReview: async (cardId: string, rating: FlashcardRating) => {
      const { flashcards, vaultPath } = get();
      const card = flashcards.find((c) => c.id === cardId);
      if (!card) return;

      const newProgress = calculateSM2Review(card.progress, rating);
      const updatedCards = flashcards.map((c) =>
        c.id === cardId ? { ...c, progress: newProgress } : c
      );

      const dueCount = getDueCards(updatedCards).length;

      set({
        flashcards: updatedCards,
        dueFlashcardsCount: dueCount,
      });

      await saveStandaloneFlashcards(updatedCards, vaultPath);
    },

    openCommandPalette: (initialQuery = '') =>
      set({ isCommandPaletteOpen: true, commandPaletteInitialQuery: initialQuery }),
    closeCommandPalette: () =>
      set({ isCommandPaletteOpen: false, commandPaletteInitialQuery: '' }),
    toggleCommandPalette: () =>
      set((state) => ({
        isCommandPaletteOpen: !state.isCommandPaletteOpen,
        commandPaletteInitialQuery: '',
      })),

    openSmartQAModal: (initialQuestion = '') =>
      set({ isSmartQAModalOpen: true, smartQAInitialQuestion: initialQuestion }),
    closeSmartQAModal: () =>
      set({ isSmartQAModalOpen: false, smartQAInitialQuestion: '' }),
    toggleSmartQAModal: () =>
      set((state) => ({
        isSmartQAModalOpen: !state.isSmartQAModalOpen,
        smartQAInitialQuestion: '',
      })),

    // Auto-Save Mode
    setAutoSaveMode: (mode) => {
      localStorage.setItem(AUTOSAVE_MODE_KEY, mode);
      set({ autoSaveMode: mode });
    },

    // Search Depth Limit (up to 1 folder depth after root)
    setSearchLimitDepth1: (limit) => {
      localStorage.setItem(SEARCH_DEPTH_KEY, limit ? 'true' : 'false');
      set({ searchLimitDepth1: limit });
    },

    // Typography & System Fonts
    setAppFont: (font: string) => {
      localStorage.setItem(APP_FONT_KEY, font);
      set({ appFont: font });
      applyFonts(font, get().editorFont, get().fontSize);
    },

    setEditorFont: (font: string) => {
      localStorage.setItem(EDITOR_FONT_KEY, font);
      set({ editorFont: font });
      applyFonts(get().appFont, font, get().fontSize);
    },

    setFontSize: (size: number) => {
      localStorage.setItem(FONT_SIZE_KEY, size.toString());
      set({ fontSize: size });
      applyFonts(get().appFont, get().editorFont, size);
    },

    toggleFontModal: () => {
      set((state) => ({ isFontModalOpen: !state.isFontModalOpen }));
    },

    // Standalone New Flashcard Modal
    openNewFlashcardModal: (front = '', back = '', deck = '') => {
      set({
        isNewFlashcardModalOpen: true,
        newFlashcardInitialFront: front,
        newFlashcardInitialBack: back,
        newFlashcardInitialDeck: deck,
      });
    },

    closeNewFlashcardModal: () => {
      set({
        isNewFlashcardModalOpen: false,
        newFlashcardInitialFront: '',
        newFlashcardInitialBack: '',
        newFlashcardInitialDeck: '',
      });
    },

    requestConfirm: (params) => {
      return new Promise<boolean>((resolve) => {
        set({
          confirmDialog: {
            isOpen: true,
            title: params.title,
            message: params.message,
            confirmLabel: params.confirmLabel || 'Conferma',
            cancelLabel: params.cancelLabel || 'Annulla',
            isDanger: params.isDanger ?? true,
            resolve,
          },
        });
      });
    },

    handleConfirmDialogResponse: (confirmed: boolean) => {
      const { confirmDialog } = get();
      if (confirmDialog.resolve) {
        confirmDialog.resolve(confirmed);
      }
      set({
        confirmDialog: {
          isOpen: false,
          title: '',
          message: '',
          confirmLabel: 'Conferma',
          cancelLabel: 'Annulla',
          isDanger: true,
          resolve: undefined,
        },
      });
    },

    showToast: (message, type = 'info', duration = 3500) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
      set((state) => ({
        toasts: [...state.toasts, { id, message, type }],
      }));
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    },

    removeToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },

    openAutoFlashcardModal: (initialText = '', initialTitle = '', initialDeck = '') => {
      set({
        isAutoFlashcardModalOpen: true,
        autoFlashcardInitialText: initialText,
        autoFlashcardInitialTitle: initialTitle,
        autoFlashcardInitialDeck: initialDeck,
      });
    },

    closeAutoFlashcardModal: () => {
      set({
        isAutoFlashcardModalOpen: false,
        autoFlashcardInitialText: '',
        autoFlashcardInitialTitle: '',
        autoFlashcardInitialDeck: '',
      });
    },
  };
});
