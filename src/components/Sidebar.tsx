import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  useVaultStore,
  normalizePath,
  getPathDirname,
  getPathBasename,
} from '../store/useVaultStore';
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
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { detectCloudDrive } from '../services/cloudDriveDetector';

const SORT_OPTIONS: { id: FileSortOption; label: string; desc: string }[] = [
  { id: 'name-asc', label: 'Nome (A - Z)', desc: 'Ordine alfabetico naturale' },
  { id: 'name-desc', label: 'Nome (Z - A)', desc: 'Ordine alfabetico inverso' },
  { id: 'date-newest', label: 'Modifica recente', desc: 'Note modificate di recente' },
  { id: 'date-oldest', label: 'Meno recenti', desc: 'Note create per prime' },
];

// Synchronous tracking of dragged paths for immediate dragover response without React state delay
let activeDraggedPaths: string[] = [];

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
    selectedPaths,
    setSelectedPaths,
    toggleSelectPath,
    clearSelection,
    moveNodes,
    deleteSelectedNodes,
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
  const sidebarContainerRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop state
  const [draggedPaths, setDraggedPaths] = useState<string[]>([]);
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(null);
  const [isDragOverRoot, setIsDragOverRoot] = useState(false);
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);

  // Pointer-based mouse drag state (guarantees 100% reliable drag-and-drop across desktop webview)
  const [pointerDrag, setPointerDrag] = useState<{
    items: string[];
    x: number;
    y: number;
    targetFolder: string | null;
    isRoot: boolean;
  } | null>(null);
  const justDraggedRef = useRef(false);

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

  // Clean hover-to-expand timer on unmount
  useEffect(() => {
    return () => {
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current);
      }
    };
  }, []);

  const vaultName = useMemo(() => {
    if (!vaultPath) return 'Vault NoteRip';
    const clean = vaultPath.replace(/\\/g, '/').replace(/\/$/, '');
    const parts = clean.split('/');
    return parts[parts.length - 1] || 'Vault';
  }, [vaultPath]);

  // Detect if vault folder belongs to a cloud drive (Google Drive, OneDrive, Dropbox, etc.)
  const cloudDrive = useMemo(() => detectCloudDrive(vaultPath), [vaultPath]);

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

  // Compute visible flattened paths for Shift+Click range selection
  const visiblePaths = useMemo(() => {
    const paths: string[] = [];
    function collect(nodes: FileNode[]) {
      for (const node of nodes) {
        paths.push(node.path);
        if (node.is_dir && expandedFolders[node.path] && node.children) {
          collect(node.children);
        }
      }
    }
    collect(processedTree);
    return paths;
  }, [processedTree, expandedFolders]);

  // Keyboard shortcuts listener for sidebar operations (Delete, Esc, Ctrl+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isEditing =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable);
      if (isEditing) return;

      if (e.key === 'Escape') {
        if (selectedPaths.length > 0) {
          clearSelection();
        }
      } else if (e.key === 'Delete' || (e.key === 'Backspace' && (e.metaKey || e.ctrlKey))) {
        if (selectedPaths.length > 0) {
          e.preventDefault();
          deleteSelectedNodes();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        if (sidebarContainerRef.current && sidebarContainerRef.current.contains(activeEl)) {
          e.preventDefault();
          setSelectedPaths(visiblePaths);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPaths, visiblePaths, clearSelection, deleteSelectedNodes, setSelectedPaths]);

  // Drag and drop validation: can items drop into this folder?
  const canDropInFolder = (sources: string[], targetFolderPath: string) => {
    const items = sources && sources.length > 0 ? sources : activeDraggedPaths;
    if (!items || items.length === 0) return false;
    const normTarget = normalizePath(targetFolderPath).toLowerCase();

    for (const src of items) {
      const normSrc = normalizePath(src).toLowerCase();
      if (normTarget === normSrc) return false;
      if (normTarget.startsWith(normSrc + '/')) return false;
    }

    const allAlreadyInside = items.every((src) => {
      const parent = getPathDirname(normalizePath(src)).toLowerCase();
      return parent === normTarget;
    });

    return !allAlreadyInside;
  };

  // Drag and drop validation: can items drop on vault root?
  const canDropOnRootSources = (sources: string[]) => {
    const items = sources && sources.length > 0 ? sources : activeDraggedPaths;
    if (!vaultPath || items.length === 0) return false;
    const normVault = normalizePath(vaultPath).toLowerCase();

    return items.some((src) => {
      const parent = getPathDirname(normalizePath(src)).toLowerCase();
      return parent !== normVault;
    });
  };

  const canDropOnRoot = useMemo(() => {
    return canDropOnRootSources(draggedPaths.length > 0 ? draggedPaths : activeDraggedPaths);
  }, [vaultPath, draggedPaths]);

  // Drag Start handler
  const handleDragStart = (e: React.DragEvent, nodePath: string) => {
    e.stopPropagation();

    let pathsToDrag = selectedPaths;
    if (!selectedPaths.includes(nodePath)) {
      pathsToDrag = [nodePath];
      setSelectedPaths([nodePath]);
    }

    activeDraggedPaths = pathsToDrag;
    setDraggedPaths(pathsToDrag);

    try {
      e.dataTransfer.setData('application/json', JSON.stringify(pathsToDrag));
      e.dataTransfer.setData('text/plain', pathsToDrag.join('\n'));
      e.dataTransfer.effectAllowed = 'move';
    } catch {
      // ignore
    }

    // Ghost drag image if multiple items
    if (pathsToDrag.length > 1) {
      if (ghostRef.current && document.body.contains(ghostRef.current)) {
        document.body.removeChild(ghostRef.current);
        ghostRef.current = null;
      }
      const ghost = document.createElement('div');
      ghost.style.position = 'fixed';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.padding = '6px 12px';
      ghost.style.borderRadius = '8px';
      ghost.style.backgroundColor = '#171B22';
      ghost.style.color = '#F3F4F6';
      ghost.style.border = '1px solid #E5484D';
      ghost.style.fontSize = '12px';
      ghost.style.fontWeight = '600';
      ghost.style.display = 'flex';
      ghost.style.alignItems = 'center';
      ghost.style.gap = '6px';
      ghost.style.zIndex = '99999';
      ghost.style.pointerEvents = 'none';
      ghost.style.boxShadow = '0 8px 24px rgba(0,0,0,0.6)';
      ghost.textContent = `📁 Sposta ${pathsToDrag.length} elementi`;
      document.body.appendChild(ghost);
      ghostRef.current = ghost;
      try {
        e.dataTransfer.setDragImage(ghost, 20, 20);
      } catch {
        // ignore
      }
    }
  };

  // Drag End handler
  const handleDragEnd = () => {
    activeDraggedPaths = [];
    setDraggedPaths([]);
    setDragOverFolderPath(null);
    setIsDragOverRoot(false);
    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    if (ghostRef.current) {
      if (document.body.contains(ghostRef.current)) {
        document.body.removeChild(ghostRef.current);
      }
      ghostRef.current = null;
    }
  };

  // Folder Drag Over
  const handleFolderDragOver = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();

    const sources = activeDraggedPaths.length > 0 ? activeDraggedPaths : draggedPaths;
    if (sources.length > 0 && !canDropInFolder(sources, folderPath)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolderPath !== folderPath) {
      setDragOverFolderPath(folderPath);

      // Auto-expand folder on hover if collapsed
      if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
      if (!expandedFolders[folderPath]) {
        hoverExpandTimerRef.current = setTimeout(() => {
          useVaultStore.getState().setFolderExpanded(folderPath, true);
        }, 600);
      }
    }
  };

  // Folder Drag Leave
  const handleFolderDragLeave = (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverFolderPath === folderPath) {
      setDragOverFolderPath(null);
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current);
        hoverExpandTimerRef.current = null;
      }
    }
  };

  // Folder Drop
  const handleFolderDrop = async (e: React.DragEvent, folderPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderPath(null);
    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }

    let items = activeDraggedPaths.length > 0 ? activeDraggedPaths : draggedPaths;
    if (items.length === 0) {
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (raw) items = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    if (items.length === 0) {
      try {
        const text = e.dataTransfer.getData('text/plain');
        if (text) items = text.split('\n').map((s) => s.trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }

    if (items && items.length > 0 && canDropInFolder(items, folderPath)) {
      await moveNodes(items, folderPath);
    }
    handleDragEnd();
  };

  // Root Drag Over
  const handleRootDragOver = (e: React.DragEvent) => {
    const sources = activeDraggedPaths.length > 0 ? activeDraggedPaths : draggedPaths;
    if (!canDropOnRootSources(sources)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOverRoot(true);
  };

  // Root Drag Leave
  const handleRootDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
  };

  // Root Drop
  const handleRootDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);

    let items = activeDraggedPaths.length > 0 ? activeDraggedPaths : draggedPaths;
    if (items.length === 0) {
      try {
        const raw = e.dataTransfer.getData('application/json');
        if (raw) items = JSON.parse(raw);
      } catch {
        // ignore
      }
    }
    if (items.length === 0) {
      try {
        const text = e.dataTransfer.getData('text/plain');
        if (text) items = text.split('\n').map((s) => s.trim()).filter(Boolean);
      } catch {
        // ignore
      }
    }

    if (items && items.length > 0 && canDropOnRootSources(items)) {
      await moveNodes(items, null);
    }
    handleDragEnd();
  };

  // File Drag Over: files redirect drop to their parent folder (or root)
  const handleFileDragOver = (e: React.DragEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();

    const sources = activeDraggedPaths.length > 0 ? activeDraggedPaths : draggedPaths;
    const parentFolder = getPathDirname(normalizePath(filePath));
    const normVault = vaultPath ? normalizePath(vaultPath).toLowerCase() : '';
    const isParentRoot = !parentFolder || parentFolder.toLowerCase() === normVault;

    if (isParentRoot) {
      if (canDropOnRootSources(sources)) {
        e.dataTransfer.dropEffect = 'move';
        setIsDragOverRoot(true);
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    } else {
      if (canDropInFolder(sources, parentFolder)) {
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolderPath(parentFolder);
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    }
  };

  // File Drag Leave
  const handleFileDragLeave = (e: React.DragEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    const parentFolder = getPathDirname(normalizePath(filePath));
    const normVault = vaultPath ? normalizePath(vaultPath).toLowerCase() : '';
    const isParentRoot = !parentFolder || parentFolder.toLowerCase() === normVault;

    if (isParentRoot) {
      setIsDragOverRoot(false);
    } else if (dragOverFolderPath && dragOverFolderPath.toLowerCase() === parentFolder.toLowerCase()) {
      setDragOverFolderPath(null);
    }
  };

  // File Drop
  const handleFileDrop = async (e: React.DragEvent, filePath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverRoot(false);
    setDragOverFolderPath(null);

    const parentFolder = getPathDirname(normalizePath(filePath));
    const normVault = vaultPath ? normalizePath(vaultPath).toLowerCase() : '';
    const isParentRoot = !parentFolder || parentFolder.toLowerCase() === normVault;

    if (isParentRoot) {
      await handleRootDrop(e);
    } else {
      await handleFolderDrop(e, parentFolder);
    }
  };

  // Pointer-based (mouse) drag handler for 100% reliable desktop drag-and-drop
  const handleRowMouseDown = (e: React.MouseEvent, nodePath: string) => {
    // Only primary mouse button (left click)
    if (e.button !== 0) return;
    if (renamingPath) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let didStartDrag = false;

    const currentSelected = useVaultStore.getState().selectedPaths;
    const isModifier = e.ctrlKey || e.metaKey || e.shiftKey;
    const itemsToDrag = currentSelected.includes(nodePath)
      ? currentSelected
      : isModifier
      ? [...currentSelected, nodePath]
      : [nodePath];

    const cleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') {
        cleanup();
        setPointerDrag(null);
        handleDragEnd();
      }
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (moveEvent.buttons === 0) {
        cleanup();
        setPointerDrag(null);
        handleDragEnd();
        return;
      }

      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!didStartDrag && dist > 4) {
        didStartDrag = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        activeDraggedPaths = itemsToDrag;
        setDraggedPaths(itemsToDrag);
        if (!currentSelected.includes(nodePath)) {
          setSelectedPaths(itemsToDrag);
        }
      }

      if (didStartDrag) {
        moveEvent.preventDefault();
        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const dropTargetEl = el?.closest('[data-droptarget]');

        let targetFolder: string | null = null;
        let isRoot = false;

        if (dropTargetEl) {
          const targetType = dropTargetEl.getAttribute('data-droptarget');
          const targetPath = dropTargetEl.getAttribute('data-targetpath');

          if (targetType === 'folder' && targetPath) {
            if (canDropInFolder(itemsToDrag, targetPath)) {
              targetFolder = targetPath;
            }
          } else if (targetType === 'file' && targetPath) {
            const parentFolder = getPathDirname(normalizePath(targetPath));
            const normVault = vaultPath ? normalizePath(vaultPath).toLowerCase() : '';
            const isParentRoot = !parentFolder || parentFolder.toLowerCase() === normVault;

            if (isParentRoot) {
              if (canDropOnRootSources(itemsToDrag)) {
                isRoot = true;
              }
            } else {
              if (canDropInFolder(itemsToDrag, parentFolder)) {
                targetFolder = parentFolder;
              }
            }
          } else if (targetType === 'root') {
            if (canDropOnRootSources(itemsToDrag)) {
              isRoot = true;
            }
          }
        }

        setDragOverFolderPath(targetFolder);
        setIsDragOverRoot(isRoot);

        // Auto-expand folder on hover
        if (targetFolder) {
          if (!expandedFolders[targetFolder]) {
            if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
            hoverExpandTimerRef.current = setTimeout(() => {
              useVaultStore.getState().setFolderExpanded(targetFolder, true);
            }, 600);
          }
        }

        setPointerDrag({
          items: itemsToDrag,
          x: moveEvent.clientX,
          y: moveEvent.clientY,
          targetFolder,
          isRoot,
        });
      }
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      cleanup();

      if (didStartDrag) {
        justDraggedRef.current = true;
        setTimeout(() => {
          justDraggedRef.current = false;
        }, 150);

        const el = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const dropTargetEl = el?.closest('[data-droptarget]');

        if (dropTargetEl) {
          const targetType = dropTargetEl.getAttribute('data-droptarget');
          const targetPath = dropTargetEl.getAttribute('data-targetpath');

          if (targetType === 'folder' && targetPath && canDropInFolder(itemsToDrag, targetPath)) {
            await moveNodes(itemsToDrag, targetPath);
          } else if (targetType === 'file' && targetPath) {
            const parentFolder = getPathDirname(normalizePath(targetPath));
            const normVault = vaultPath ? normalizePath(vaultPath).toLowerCase() : '';
            const isParentRoot = !parentFolder || parentFolder.toLowerCase() === normVault;

            if (isParentRoot && canDropOnRootSources(itemsToDrag)) {
              await moveNodes(itemsToDrag, null);
            } else if (!isParentRoot && canDropInFolder(itemsToDrag, parentFolder)) {
              await moveNodes(itemsToDrag, parentFolder);
            }
          } else if (targetType === 'root' && canDropOnRootSources(itemsToDrag)) {
            await moveNodes(itemsToDrag, null);
          }
        }

        setPointerDrag(null);
        handleDragEnd();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
  };

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
      ref={sidebarContainerRef}
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
      <div
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            clearSelection();
          }
        }}
        className="flex-1 flex flex-col overflow-y-auto px-2 py-3 space-y-4"
      >
        {/* Notebooks / Files Section Header */}
        <div className="flex-1 flex flex-col">
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

          {/* Multi-Selection Status & Batch Actions Bar */}
          {selectedPaths.length > 1 && (
            <div className="mx-1 mb-2 px-2.5 py-1.5 rounded-xl bg-[#171B22] border border-[#E5484D]/40 flex items-center justify-between shadow-apple-sm animate-in fade-in duration-150">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-[#E5484D] animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-[#F3F4F6] truncate">
                  {selectedPaths.length} elementi selezionati
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => deleteSelectedNodes()}
                  className="p-1 rounded text-[#9CA3AF] hover:text-[#E5484D] hover:bg-[#E5484D]/10 transition-colors"
                  title="Elimina tutti gli elementi selezionati (Canc)"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => clearSelection()}
                  className="p-1 rounded text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#272C36] transition-colors"
                  title="Deseleziona tutti (Esc)"
                >
                  <X size={13} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          )}

          {/* Root Drop Zone Banner (shown during drag if items can be moved to root) */}
          {(draggedPaths.length > 0 || pointerDrag !== null) && canDropOnRoot && (
            <div
              data-droptarget="root"
              onDragOver={handleRootDragOver}
              onDragLeave={handleRootDragLeave}
              onDrop={handleRootDrop}
              className={`mx-1 mb-2 py-2 px-3 rounded-xl border border-dashed text-xs text-center font-medium transition-all cursor-pointer ${
                isDragOverRoot || pointerDrag?.isRoot
                  ? 'bg-[#E5484D]/25 border-[#E5484D] text-[#FFFFFF] ring-2 ring-[#E5484D]/50 shadow-md scale-[1.01]'
                  : 'bg-[#171B22]/80 border-[#272C36] text-[#9CA3AF] hover:border-[#E5484D]/60 hover:text-[#F3F4F6]'
              }`}
            >
              <span>📥 Sposta nella cartella principale (Root)</span>
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
                  activeNotePath={activeNotePath}
                  expandedFolders={expandedFolders}
                  selectedPaths={selectedPaths}
                  visiblePaths={visiblePaths}
                  draggedPaths={draggedPaths}
                  dragOverFolderPath={dragOverFolderPath}
                  creatingItem={creatingItem}
                  createInputName={createInputName}
                  createInputRef={createInputRef}
                  renamingPath={renamingPath}
                  renamingName={renamingName}
                  toggleFolder={toggleFolder}
                  selectNote={selectNote}
                  deleteNote={deleteNote}
                  deleteFolder={deleteFolder}
                  toggleSelectPath={toggleSelectPath}
                  setSelectedPaths={setSelectedPaths}
                  clearSelection={clearSelection}
                  deleteSelectedNodes={deleteSelectedNodes}
                  onRowMouseDown={handleRowMouseDown}
                  justDraggedRef={justDraggedRef}
                  pointerDrag={pointerDrag}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onFolderDragOver={handleFolderDragOver}
                  onFolderDragLeave={handleFolderDragLeave}
                  onFolderDrop={handleFolderDrop}
                  onFileDragOver={handleFileDragOver}
                  onFileDragLeave={handleFileDragLeave}
                  onFileDrop={handleFileDrop}
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

          {/* Empty Space at Bottom of Tree (allows clicking to deselect or dropping to root) */}
          <div
            data-droptarget="root"
            className="flex-1 min-h-[60px]"
            onClick={(e) => {
              if (justDraggedRef.current) return;
              if (e.target === e.currentTarget) {
                clearSelection();
              }
            }}
            onDragOver={(e) => {
              const sources = activeDraggedPaths.length > 0 ? activeDraggedPaths : draggedPaths;
              if (canDropOnRootSources(sources)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setIsDragOverRoot(true);
              }
            }}
            onDragLeave={() => setIsDragOverRoot(false)}
            onDrop={async (e) => {
              await handleRootDrop(e);
            }}
          />
        </div>
      </div>

      {/* 4. Bottom Utility Bar: Cloud Drive / Git Sync & Local-First indicator */}
      <div className="p-3 border-t border-[#272C36] bg-[#0E1116] space-y-2">
        <div className="flex items-center justify-between text-xs">
          {cloudDrive.isCloudDrive ? (
            <button
              onClick={toggleSyncModal}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-apple-sm"
              title={cloudDrive.description}
            >
              <div className="relative flex items-center justify-center">
                <Cloud size={13} strokeWidth={1.75} className="text-emerald-400" />
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="font-semibold text-emerald-400 tracking-wide">Synced</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-400/15 text-emerald-300">
                {cloudDrive.providerShort}
              </span>
            </button>
          ) : (
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
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />
            <span>Local-First</span>
          </div>
        </div>
      </div>

      {/* Floating Pointer Drag Badge */}
      {pointerDrag && (
        <div
          className="fixed z-[99999] pointer-events-none px-3 py-1.5 rounded-xl bg-[#171B22]/95 border border-[#E5484D] text-[#F3F4F6] text-xs font-semibold shadow-2xl flex items-center gap-2 backdrop-blur-md transition-none ring-1 ring-[#E5484D]/30"
          style={{
            left: pointerDrag.x + 14,
            top: pointerDrag.y + 14,
          }}
        >
          <span className="w-2 h-2 rounded-full bg-[#E5484D] animate-ping" />
          <span>
            {pointerDrag.items.length === 1
              ? `Sposta "${getPathBasename(pointerDrag.items[0]).replace(/\.(md|markdown|txt)$/i, '')}"`
              : `Sposta ${pointerDrag.items.length} elementi`}
          </span>
          {pointerDrag.targetFolder ? (
            <span className="text-[10px] text-[#4ADE80] font-normal">
              → {getPathBasename(pointerDrag.targetFolder)}
            </span>
          ) : pointerDrag.isRoot ? (
            <span className="text-[10px] text-[#4ADE80] font-normal">→ Root</span>
          ) : null}
        </div>
      )}
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
  activeNotePath: string | null;
  expandedFolders: Record<string, boolean>;
  selectedPaths: string[];
  visiblePaths: string[];
  draggedPaths: string[];
  dragOverFolderPath: string | null;
  creatingItem: { type: 'file' | 'folder'; parentFolderRel?: string } | null;
  createInputName: string;
  createInputRef: React.RefObject<HTMLInputElement | null>;
  renamingPath: string | null;
  renamingName: string;
  toggleFolder: (path: string) => void;
  selectNote: (path: string) => void;
  deleteNote: (path: string) => void;
  deleteFolder: (path: string) => void;
  toggleSelectPath: (path: string, isMulti: boolean, isRange?: boolean, visiblePaths?: string[]) => void;
  setSelectedPaths: (paths: string[]) => void;
  clearSelection: () => void;
  deleteSelectedNodes: () => Promise<void>;
  onDragStart: (e: React.DragEvent, path: string) => void;
  onDragEnd: () => void;
  onFolderDragOver: (e: React.DragEvent, path: string) => void;
  onFolderDragLeave: (e: React.DragEvent, path: string) => void;
  onFolderDrop: (e: React.DragEvent, path: string) => void;
  onFileDragOver: (e: React.DragEvent, path: string) => void;
  onFileDragLeave: (e: React.DragEvent, path: string) => void;
  onFileDrop: (e: React.DragEvent, path: string) => void;
  onRowMouseDown: (e: React.MouseEvent, path: string) => void;
  justDraggedRef: React.RefObject<boolean>;
  pointerDrag: { items: string[]; targetFolder: string | null; isRoot: boolean } | null;
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
  activeNotePath,
  expandedFolders,
  selectedPaths,
  visiblePaths,
  draggedPaths,
  dragOverFolderPath,
  creatingItem,
  createInputName,
  createInputRef,
  renamingPath,
  renamingName,
  toggleFolder,
  selectNote,
  deleteNote,
  deleteFolder,
  toggleSelectPath,
  setSelectedPaths,
  clearSelection,
  deleteSelectedNodes,
  onRowMouseDown,
  justDraggedRef,
  pointerDrag,
  onDragStart,
  onDragEnd,
  onFolderDragOver,
  onFolderDragLeave,
  onFolderDrop,
  onFileDragOver,
  onFileDragLeave,
  onFileDrop,
  onStartCreate,
  setCreateInputName,
  onSubmitCreate,
  onCancelCreate,
  onStartRename,
  setRenamingName,
  onSubmitRename,
  onCancelRename,
}) => {
  const requestConfirm = useVaultStore((state) => state.requestConfirm);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const isExpanded = expandedFolders[node.path] ?? false;
  const currentRel = parentRel ? `${parentRel}/${node.name}` : node.name;
  const isCreatingInside = creatingItem && creatingItem.parentFolderRel === currentRel;
  const isRenaming = renamingPath === node.path;

  const isSelected = selectedPaths.includes(node.path);
  const isBeingDragged =
    draggedPaths.includes(node.path) || (pointerDrag?.items.includes(node.path) ?? false);
  const isDropTarget =
    node.is_dir &&
    (dragOverFolderPath === node.path || pointerDrag?.targetFolder === node.path);

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

  // FOLDER NODE
  if (node.is_dir) {
    return (
      <div className="space-y-0.5">
        <div
          data-droptarget="folder"
          data-targetpath={node.path}
          draggable={!isRenaming}
          style={{ WebkitUserDrag: !isRenaming ? 'element' : 'none' } as React.CSSProperties}
          onMouseDown={(e) => onRowMouseDown(e, node.path)}
          onDragStart={(e) => onDragStart(e, node.path)}
          onDragEnd={onDragEnd}
          onDragOver={(e) => onFolderDragOver(e, node.path)}
          onDragLeave={(e) => onFolderDragLeave(e, node.path)}
          onDrop={(e) => onFolderDrop(e, node.path)}
          onClick={(e) => {
            if (justDraggedRef.current) return;
            if (isRenaming) return;
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;
            const isShift = e.shiftKey;

            if (isCtrlOrCmd) {
              e.preventDefault();
              e.stopPropagation();
              toggleSelectPath(node.path, true, false);
              return;
            }

            if (isShift) {
              e.preventDefault();
              e.stopPropagation();
              toggleSelectPath(node.path, false, true, visiblePaths);
              return;
            }

            toggleSelectPath(node.path, false, false);
            toggleFolder(node.path);
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isSelected) {
              setSelectedPaths([node.path]);
            }
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
          className={`group flex items-center justify-between ${
            depth === 0 ? 'px-2' : 'px-1.5'
          } py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150 select-none ${
            isBeingDragged
              ? 'opacity-40 border border-dashed border-[#E5484D] scale-[0.99]'
              : isDropTarget
              ? 'bg-[#E5484D]/25 ring-2 ring-[#E5484D] text-[#FFFFFF] shadow-lg shadow-[#E5484D]/20 scale-[1.01]'
              : isSelected
              ? 'bg-[#E5484D]/15 text-[#F3F4F6] border border-[#E5484D]/40 font-semibold shadow-2xs'
              : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 pointer-events-none">
            <span
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.path);
              }}
              className="text-[#6B7280] hover:text-[#F3F4F6] p-0.5 rounded shrink-0 transition-transform duration-150 ease-out pointer-events-auto"
              title={isExpanded ? 'Comprimi cartella' : 'Espandi cartella'}
            >
              <ChevronRight
                size={13}
                strokeWidth={1.5}
                className={`transform transition-transform ${isExpanded ? 'rotate-90 text-[#F3F4F6]' : ''}`}
              />
            </span>
            <Folder
              size={13}
              strokeWidth={1.5}
              className={`shrink-0 ${isSelected || isDropTarget ? 'text-[#E5484D]' : 'text-[#9CA3AF]'}`}
            />
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renamingName}
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => setRenamingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSubmitRename();
                  if (e.key === 'Escape') onCancelRename();
                }}
                onBlur={onSubmitRename}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-transparent text-xs font-medium focus:outline-none border-b border-[#E5484D] text-[#F3F4F6] pointer-events-auto"
                placeholder="Nuovo nome..."
              />
            ) : (
              <span className="truncate text-xs font-medium">{node.name}</span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {isDropTarget && (
              <span className="text-[10px] font-semibold text-[#FFFFFF] bg-[#E5484D] px-1.5 py-0.5 rounded-full shadow-xs animate-pulse pointer-events-none">
                Sposta qui
              </span>
            )}

            {!isRenaming && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
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
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartCreate('folder', currentRel);
                  }}
                  className="p-1 hover:bg-[#1C212B] rounded text-[#9CA3AF] hover:text-[#F3F4F6]"
                  title="Nuova sottocartella"
                >
                  <FolderPlus size={12} strokeWidth={1.5} />
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartRename(node.path, node.name);
                  }}
                  className="p-1 hover:bg-[#1C212B] rounded text-[#6B7280] hover:text-[#F3F4F6]"
                  title="Rinomina cartella"
                >
                  <Pencil size={12} strokeWidth={1.5} />
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const confirmed = await requestConfirm({
                      title: 'Elimina Cartella',
                      message: `Eliminare la cartella "${node.name}" e tutto il suo contenuto?`,
                      confirmLabel: 'Elimina Cartella',
                      isDanger: true,
                    });
                    if (confirmed) {
                      deleteFolder(node.path);
                    }
                  }}
                  className="p-1 hover:bg-[#E5484D]/20 hover:text-[#E5484D] rounded text-[#6B7280]"
                  title="Elimina cartella"
                >
                  <Trash2 size={12} strokeWidth={1.5} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Folder Context Menu */}
        {contextMenu && (
          <div
            ref={contextMenuRef}
            className="fixed z-[999] min-w-[170px] rounded-xl shadow-popover border border-[#272C36] p-1 text-xs bg-[#171B22] animate-in fade-in zoom-in-95 duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedPaths.length > 1 && isSelected ? (
              <>
                <div className="px-2.5 py-1 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
                  {selectedPaths.length} selezionati
                </div>
                <button
                  onClick={async () => {
                    setContextMenu(null);
                    await deleteSelectedNodes();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#E5484D] hover:bg-[#E5484D]/15 transition-colors"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                  <span>Elimina {selectedPaths.length} elementi</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    clearSelection();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
                >
                  <X size={13} strokeWidth={1.5} />
                  <span>Deseleziona tutti</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    onStartCreate('file', currentRel);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
                >
                  <FilePlus size={13} strokeWidth={1.5} className="text-[#9CA3AF]" />
                  <span>Nuova Nota</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    onStartCreate('folder', currentRel);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
                >
                  <FolderPlus size={13} strokeWidth={1.5} className="text-[#9CA3AF]" />
                  <span>Nuova Sottocartella</span>
                </button>
                <button
                  onClick={() => {
                    setContextMenu(null);
                    onStartRename(node.path, node.name);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
                >
                  <Pencil size={13} strokeWidth={1.5} className="text-[#9CA3AF]" />
                  <span>Rinomina</span>
                </button>
                <div className="border-t border-[#272C36] my-1" />
                <button
                  onClick={async () => {
                    setContextMenu(null);
                    const confirmed = await requestConfirm({
                      title: 'Elimina Cartella',
                      message: `Eliminare la cartella "${node.name}" e tutto il suo contenuto?`,
                      confirmLabel: 'Elimina Cartella',
                      isDanger: true,
                    });
                    if (confirmed) {
                      deleteFolder(node.path);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#E5484D] hover:bg-[#E5484D]/15 transition-colors"
                >
                  <Trash2 size={13} strokeWidth={1.5} />
                  <span>Elimina</span>
                </button>
              </>
            )}
          </div>
        )}

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
                  activeNotePath={activeNotePath}
                  expandedFolders={expandedFolders}
                  selectedPaths={selectedPaths}
                  visiblePaths={visiblePaths}
                  draggedPaths={draggedPaths}
                  dragOverFolderPath={dragOverFolderPath}
                  creatingItem={creatingItem}
                  createInputName={createInputName}
                  createInputRef={createInputRef}
                  renamingPath={renamingPath}
                  renamingName={renamingName}
                  toggleFolder={toggleFolder}
                  selectNote={selectNote}
                  deleteNote={deleteNote}
                  deleteFolder={deleteFolder}
                  toggleSelectPath={toggleSelectPath}
                  setSelectedPaths={setSelectedPaths}
                  clearSelection={clearSelection}
                  deleteSelectedNodes={deleteSelectedNodes}
                  onRowMouseDown={onRowMouseDown}
                  justDraggedRef={justDraggedRef}
                  pointerDrag={pointerDrag}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onFolderDragOver={onFolderDragOver}
                  onFolderDragLeave={onFolderDragLeave}
                  onFolderDrop={onFolderDrop}
                  onFileDragOver={onFileDragOver}
                  onFileDragLeave={onFileDragLeave}
                  onFileDrop={onFileDrop}
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
                <div
                  data-droptarget="folder"
                  data-targetpath={node.path}
                  onDragOver={(e) => onFolderDragOver(e, node.path)}
                  onDragLeave={(e) => onFolderDragLeave(e, node.path)}
                  onDrop={(e) => onFolderDrop(e, node.path)}
                  className={`py-1.5 px-2 text-[10px] rounded-lg transition-colors border border-dashed ${
                    isDropTarget
                      ? 'border-[#E5484D] bg-[#E5484D]/10 text-[#F3F4F6]'
                      : 'border-transparent text-[#6B7280] italic'
                  }`}
                >
                  {isDropTarget ? 'Rilascia qui per spostare' : 'Cartella vuota (trascina file qui)'}
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  }

  // FILE NODE
  const isActive = activeNotePath === node.path;
  const cleanTitle = node.name.replace(/\.(md|markdown|txt)$/i, '');

  return (
    <div className="relative">
      <div
        data-droptarget="file"
        data-targetpath={node.path}
        draggable={!isRenaming}
        style={{ WebkitUserDrag: !isRenaming ? 'element' : 'none' } as React.CSSProperties}
        onMouseDown={(e) => onRowMouseDown(e, node.path)}
        onDragStart={(e) => onDragStart(e, node.path)}
        onDragEnd={onDragEnd}
        onDragOver={(e) => onFileDragOver(e, node.path)}
        onDragLeave={(e) => onFileDragLeave(e, node.path)}
        onDrop={(e) => onFileDrop(e, node.path)}
        onClick={(e) => {
          if (justDraggedRef.current) return;
          if (isRenaming) return;
          const isCtrlOrCmd = e.ctrlKey || e.metaKey;
          const isShift = e.shiftKey;

          if (isCtrlOrCmd) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelectPath(node.path, true, false);
            return;
          }

          if (isShift) {
            e.preventDefault();
            e.stopPropagation();
            toggleSelectPath(node.path, false, true, visiblePaths);
            return;
          }

          toggleSelectPath(node.path, false, false);
          selectNote(node.path);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isSelected) {
            setSelectedPaths([node.path]);
          }
          setContextMenu({ x: e.clientX, y: e.clientY });
        }}
        className={`group flex items-center justify-between ${
          depth === 0 ? 'px-2.5' : 'px-2'
        } py-1.5 rounded-lg text-xs cursor-pointer transition-all duration-150 select-none relative ${
          isBeingDragged
            ? 'opacity-40 border border-dashed border-[#E5484D] scale-[0.99]'
            : isSelected
            ? isActive
              ? 'bg-[#E5484D]/20 border-l-2 border-[#E5484D] text-[#F3F4F6] font-semibold ring-1 ring-[#E5484D]/30'
              : 'bg-[#E5484D]/15 text-[#F3F4F6] border border-[#E5484D]/40 font-medium'
            : isActive
            ? 'bg-[#171B22] border-l-2 border-[#E5484D] text-[#F3F4F6] font-medium'
            : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#171B22]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pointer-events-none">
          <FileText
            size={13}
            strokeWidth={1.5}
            className={`shrink-0 ${
              isActive || isSelected ? 'text-[#E5484D]' : 'text-[#6B7280]'
            }`}
          />
          {isRenaming ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renamingName}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => setRenamingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmitRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              onBlur={onSubmitRename}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent text-xs font-medium focus:outline-none border-b border-[#E5484D] text-[#F3F4F6] pointer-events-auto"
              placeholder="Nuovo nome..."
            />
          ) : (
            <span
              className={`truncate text-xs ${
                isActive || isSelected ? 'text-[#F3F4F6]' : ''
              }`}
            >
              {cleanTitle}
            </span>
          )}
        </div>

        {!isRenaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onMouseDown={(e) => e.stopPropagation()}
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
              onMouseDown={(e) => e.stopPropagation()}
              onClick={async (e) => {
                e.stopPropagation();
                const confirmed = await requestConfirm({
                  title: 'Elimina Nota',
                  message: `Eliminare la nota "${cleanTitle}"?`,
                  confirmLabel: 'Elimina Nota',
                  isDanger: true,
                });
                if (confirmed) {
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
          className="fixed z-[999] min-w-[170px] rounded-xl shadow-popover border border-[#272C36] p-1 text-xs bg-[#171B22] animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {selectedPaths.length > 1 && isSelected ? (
            <>
              <div className="px-2.5 py-1 text-[10px] font-semibold text-[#6B7280] uppercase tracking-wider">
                {selectedPaths.length} selezionati
              </div>
              <button
                onClick={async () => {
                  setContextMenu(null);
                  await deleteSelectedNodes();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#E5484D] hover:bg-[#E5484D]/15 transition-colors"
              >
                <Trash2 size={13} strokeWidth={1.5} />
                <span>Elimina {selectedPaths.length} elementi</span>
              </button>
              <button
                onClick={() => {
                  setContextMenu(null);
                  clearSelection();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
              >
                <X size={13} strokeWidth={1.5} />
                <span>Deseleziona tutti</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setContextMenu(null);
                  onStartRename(node.path, cleanTitle);
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
              >
                <Pencil size={13} strokeWidth={1.5} className="text-[#9CA3AF]" />
                <span>Rinomina</span>
              </button>
              <div className="border-t border-[#272C36] my-1" />
              <button
                onClick={async () => {
                  setContextMenu(null);
                  const confirmed = await requestConfirm({
                    title: 'Elimina Nota',
                    message: `Eliminare la nota "${cleanTitle}"?`,
                    confirmLabel: 'Elimina Nota',
                    isDanger: true,
                  });
                  if (confirmed) {
                    deleteNote(node.path);
                  }
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[#E5484D] hover:bg-[#E5484D]/15 transition-colors"
              >
                <Trash2 size={13} strokeWidth={1.5} />
                <span>Elimina</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
