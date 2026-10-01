import React, { useState, useRef, useEffect } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { DataviewRenderer } from './DataviewRenderer';
import { renderLatexSafe } from '../services/latexSanitizer';
import { CodeBlockView } from './CodeBlockView';
import { MermaidRenderer } from './MermaidRenderer';
import { CircuitRenderer } from './CircuitRenderer';
import { ErrorBoundary } from './ErrorBoundary';
import {
  Columns,
  Link2,
  FileCode2,
  Sigma,
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Table,
  Image as ImageIcon,
  Link as LinkIcon,
  Code,
  Minus,
  Sparkles,
  Plus,
  ChevronDown,
  Workflow,
  Cpu,
  CircuitBoard,
  MoveHorizontal,
  Brain,
  Undo2,
  Redo2,
  Type,
} from 'lucide-react';

type EditorMode = 'live' | 'split' | 'source';

interface BlockItem {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'math' | 'code' | 'dataview' | 'table' | 'quote' | 'task' | 'list' | 'hr' | 'paragraph';
  rawText: string;
  startLine: number;
  endLine: number;
  indentLevel?: number;
  listMarker?: string;
}

export const EditorView: React.FC = () => {
  const {
    activeNotePath,
    activeNoteContent,
    notes,
    updateActiveContent,
    navigateToWikiLink,
    editorWidth,
    setEditorWidth,
    openFlashcardSession,
    flashcards,
    undo,
    redo,
    canUndo,
    canRedo,
    saveActiveNote,
    autoSaveMode,
    setAutoSaveMode,
    openNewFlashcardModal,
    openAutoFlashcardModal,
    setActiveView,
    toggleFontModal,
  } = useVaultStore();

  // Default mode: 'live' (Obsidian Live Preview)
  const [mode, setMode] = useState<EditorMode>('live');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePos, setAutocompletePos] = useState({ top: 0, left: 0 });
  const [cursorIndex, setCursorIndex] = useState(0);

  // In-place block editing for Live Preview
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [activeBlockDraft, setActiveBlockDraft] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveContainerRef = useRef<HTMLDivElement>(null);
  const blockInputRef = useRef<HTMLTextAreaElement>(null);

  // Dropdown menus for Mermaid Diagrams, C/Java Snippets, Circuits, Width Control and Flashcards
  const [showDiagramMenu, setShowDiagramMenu] = useState(false);
  const [showCodeSnippetMenu, setShowCodeSnippetMenu] = useState(false);
  const [showCircuitMenu, setShowCircuitMenu] = useState(false);
  const [showWidthMenu, setShowWidthMenu] = useState(false);
  const [showFlashcardMenu, setShowFlashcardMenu] = useState(false);
  const diagramMenuRef = useRef<HTMLDivElement>(null);
  const codeSnippetMenuRef = useRef<HTMLDivElement>(null);
  const circuitMenuRef = useRef<HTMLDivElement>(null);
  const widthMenuRef = useRef<HTMLDivElement>(null);
  const flashcardMenuRef = useRef<HTMLDivElement>(null);

  // Interactive Drag Resizing for writing area width
  const [isDraggingWidth, setIsDraggingWidth] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(960);

  const handleStartDragWidth = (e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingWidth(true);
    dragStartXRef.current = e.clientX;
    const currentW = editorWidth === -1 ? window.innerWidth - 80 : editorWidth;
    dragStartWidthRef.current = currentW;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - dragStartXRef.current;
      const multiplier = side === 'right' ? 2 : -2;
      const newWidth = Math.max(620, Math.min(window.innerWidth - 60, dragStartWidthRef.current + deltaX * multiplier));
      setEditorWidth(Math.round(newWidth));
    };

    const onPointerUp = () => {
      setIsDraggingWidth(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const isFullWidth = editorWidth === -1 || editorWidth >= 2400;
  const contentContainerStyle: React.CSSProperties = isFullWidth
    ? { maxWidth: '100%' }
    : { maxWidth: `${editorWidth}px` };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (diagramMenuRef.current && !diagramMenuRef.current.contains(e.target as Node)) {
        setShowDiagramMenu(false);
      }
      if (codeSnippetMenuRef.current && !codeSnippetMenuRef.current.contains(e.target as Node)) {
        setShowCodeSnippetMenu(false);
      }
      if (circuitMenuRef.current && !circuitMenuRef.current.contains(e.target as Node)) {
        setShowCircuitMenu(false);
      }
      if (widthMenuRef.current && !widthMenuRef.current.contains(e.target as Node)) {
        setShowWidthMenu(false);
      }
      if (flashcardMenuRef.current && !flashcardMenuRef.current.contains(e.target as Node)) {
        setShowFlashcardMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const insertSnippet = (snippet: string) => {
    applyFormat(`\n${snippet.trim()}\n`, '', '');
    setShowDiagramMenu(false);
    setShowCodeSnippetMenu(false);
    setShowCircuitMenu(false);
  };

  const activeNote = React.useMemo(() => {
    if (!activeNotePath) return null;
    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    const normalizedActive = norm(activeNotePath);
    const found = notes.find((n) => norm(n.path) === normalizedActive);
    if (found) return found;

    // Resilient fallback: If path is set, derive NoteItem representation from activeNotePath & activeNoteContent
    const cleanPath = activeNotePath.replace(/\\/g, '/');
    const segments = cleanPath.split('/');
    const filename = segments[segments.length - 1] || 'Nota';
    const title = filename.replace(/\.md$/i, '');
    const folder = segments.length > 1 ? segments[segments.length - 2] : 'Root';

    return {
      path: activeNotePath,
      title,
      rel_path: filename,
      preview: (activeNoteContent || '').slice(0, 100),
      content: activeNoteContent || '',
      folder,
      updated_at: Date.now(),
      tags: [],
      outlinks: [],
      backlinks: [],
    };
  }, [notes, activeNotePath, activeNoteContent]);

  const noteFlashcardsCount = React.useMemo(() => {
    if (!activeNotePath) return 0;
    return flashcards.filter((f) => f.notePath === activeNotePath).length;
  }, [flashcards, activeNotePath]);

  // Adjust active block textarea height automatically
  useEffect(() => {
    if (activeBlockId && blockInputRef.current) {
      blockInputRef.current.style.height = 'auto';
      blockInputRef.current.style.height = `${Math.max(38, blockInputRef.current.scrollHeight)}px`;
    }
  }, [activeBlockId, activeBlockDraft]);

  // Save current block edit to activeNoteContent
  const commitBlockEdit = (blockId: string, newRawText: string) => {
    const lines = activeNoteContent.split('\n');
    const block = parsedBlocks.find((b) => b.id === blockId);
    if (!block) {
      setActiveBlockId(null);
      return;
    }

    const beforeLines = lines.slice(0, block.startLine);
    const afterLines = lines.slice(block.endLine + 1);
    const newBlockLines = newRawText.split('\n');
    const updatedLines = [...beforeLines, ...newBlockLines, ...afterLines];

    updateActiveContent(updatedLines.join('\n'), true);
    setActiveBlockId(null);
  };

  // Smart Toggle Bold (**text** <-> text) with exact cursor retention
  const toggleBoldInInput = (
    input: HTMLTextAreaElement,
    onUpdate: (newVal: string, selStart: number, selEnd: number) => void
  ) => {
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const val = input.value;

    if (start !== end) {
      const selected = val.slice(start, end);

      // Case 1: The selection itself starts and ends with ** (e.g. "**test**")
      if (selected.startsWith('**') && selected.endsWith('**') && selected.length >= 4) {
        const unwrapped = selected.slice(2, -2);
        const newVal = val.slice(0, start) + unwrapped + val.slice(end);
        onUpdate(newVal, start, start + unwrapped.length);
        return;
      }

      // Case 2: The selection is directly surrounded by ** (e.g. "**|test|**")
      if (start >= 2 && end + 2 <= val.length && val.slice(start - 2, start) === '**' && val.slice(end, end + 2) === '**') {
        const newVal = val.slice(0, start - 2) + selected + val.slice(end + 2);
        onUpdate(newVal, start - 2, start - 2 + selected.length);
        return;
      }

      // Case 3: Wrap selected text with **
      const wrapped = `**${selected}**`;
      const newVal = val.slice(0, start) + wrapped + val.slice(end);
      onUpdate(newVal, start, start + wrapped.length);
      return;
    }

    // If no text is selected:
    // Check if cursor is directly between empty bold markers: "**|**"
    if (start >= 2 && start + 2 <= val.length && val.slice(start - 2, start) === '**' && val.slice(start, start + 2) === '**') {
      const newVal = val.slice(0, start - 2) + val.slice(start + 2);
      onUpdate(newVal, start - 2, start - 2);
      return;
    }

    // Check if cursor is inside a bold phrase on the current line
    const lastNewline = val.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const nextNewline = val.indexOf('\n', start);
    const lineEnd = nextNewline === -1 ? val.length : nextNewline;

    const beforeCursor = val.slice(lineStart, start);
    const afterCursor = val.slice(start, lineEnd);

    const boldCountBefore = (beforeCursor.match(/\*\*/g) || []).length;
    if (boldCountBefore % 2 === 1) {
      // Odd count means cursor is inside a bold segment
      const openIdx = beforeCursor.lastIndexOf('**');
      const closeIdx = afterCursor.indexOf('**');
      if (closeIdx !== -1) {
        const absOpen = lineStart + openIdx;
        const absClose = start + closeIdx;
        const innerText = val.slice(absOpen + 2, absClose);
        const newVal = val.slice(0, absOpen) + innerText + val.slice(absClose + 2);
        const newPos = Math.max(absOpen, Math.min(absOpen + innerText.length, start - 2));
        onUpdate(newVal, newPos, newPos);
        return;
      }
    }

    // Default: Insert **** and place cursor between them
    const newVal = val.slice(0, start) + '****' + val.slice(start);
    onUpdate(newVal, start + 2, start + 2);
  };

  const handleToggleBold = () => {
    // 1. If currently editing a block in Live Preview
    if (activeBlockId !== null && blockInputRef.current) {
      const input = blockInputRef.current;
      toggleBoldInInput(input, (newVal, selStart, selEnd) => {
        setActiveBlockDraft(newVal);
        requestAnimationFrame(() => {
          if (blockInputRef.current) {
            blockInputRef.current.focus({ preventScroll: true });
            blockInputRef.current.setSelectionRange(selStart, selEnd);
          }
        });
      });
      return;
    }

    // 2. If in Split or Source mode textarea
    if (textareaRef.current && (mode === 'split' || mode === 'source')) {
      const textarea = textareaRef.current;
      toggleBoldInInput(textarea, (newVal, selStart, selEnd) => {
        const savedScrollTop = textarea.scrollTop;
        updateActiveContent(newVal, true);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus({ preventScroll: true });
            textareaRef.current.scrollTop = savedScrollTop;
            textareaRef.current.setSelectionRange(selStart, selEnd);
          }
        });
      });
      return;
    }

    // 3. If user selected text on rendered document in Live Preview
    const domSelection = window.getSelection()?.toString().trim();
    if (domSelection && domSelection.length > 0) {
      const content = activeNoteContent;
      const boldWrapped = `**${domSelection}**`;
      if (content.includes(boldWrapped)) {
        const newContent = content.replace(boldWrapped, domSelection);
        updateActiveContent(newContent, true);
      } else {
        const matchIndex = content.indexOf(domSelection);
        if (matchIndex !== -1) {
          const beforeMatch = content.slice(Math.max(0, matchIndex - 2), matchIndex);
          const afterMatch = content.slice(matchIndex + domSelection.length, matchIndex + domSelection.length + 2);
          if (beforeMatch === '**' && afterMatch === '**') {
            const newContent = content.slice(0, matchIndex - 2) + domSelection + content.slice(matchIndex + domSelection.length + 2);
            updateActiveContent(newContent, true);
          } else {
            const newContent = content.slice(0, matchIndex) + boldWrapped + content.slice(matchIndex + domSelection.length);
            updateActiveContent(newContent, true);
          }
        }
      }
    } else {
      applyFormat('**', '**', 'grassetto');
    }
  };

  // Safe Highlighter: requires at least one selected word, never jumps or inserts dummy text
  const handleHighlight = () => {
    // 1. If currently editing a block in Live Preview
    if (activeBlockId !== null && blockInputRef.current) {
      const input = blockInputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const selected = input.value.slice(start, end).trim();
      if (!selected || start === end) return; // REQUIRE at least one word!

      const before = input.value.slice(0, start);
      const after = input.value.slice(end);
      const newBlockVal = `${before}==${selected}==${after}`;
      setActiveBlockDraft(newBlockVal);
      commitBlockEdit(activeBlockId, newBlockVal);
      return;
    }

    // 2. If in Split or Source mode textarea
    if (textareaRef.current && (mode === 'split' || mode === 'source')) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = textarea.value.slice(start, end).trim();
      if (!selected || start === end) return; // REQUIRE at least one word!

      applyFormat('==', '==', '');
      return;
    }

    // 3. If user selected text on the rendered document in Live Preview
    const domSelection = window.getSelection()?.toString().trim();
    if (domSelection && domSelection.length > 0) {
      const savedScrollTop = liveContainerRef.current?.scrollTop || 0;
      const content = activeNoteContent;
      const matchIndex = content.indexOf(domSelection);
      if (matchIndex !== -1) {
        const newContent =
          content.slice(0, matchIndex) + `==${domSelection}==` + content.slice(matchIndex + domSelection.length);
        updateActiveContent(newContent, true);

        requestAnimationFrame(() => {
          if (liveContainerRef.current) {
            liveContainerRef.current.scrollTop = savedScrollTop;
          }
        });
      }
    }
  };

  // Toolbar Formatting Action Helper with Strict Scroll Lock
  const applyFormat = (prefix: string, suffix: string = '', defaultPlaceholder: string = '') => {
    // If in Live Preview active block
    if (activeBlockId !== null && blockInputRef.current) {
      const input = blockInputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const selected = input.value.slice(start, end);
      if (!selected && !defaultPlaceholder) return;

      const textToWrap = selected || defaultPlaceholder;
      const replacement = `${prefix}${textToWrap}${suffix}`;
      const newBlockVal = input.value.slice(0, start) + replacement + input.value.slice(end);
      setActiveBlockDraft(newBlockVal);
      return;
    }

    // If in textarea
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = activeNoteContent;

    const selected = content.slice(start, end);
    if (!selected && !defaultPlaceholder) return;

    const textToWrap = selected || defaultPlaceholder;
    const replacement = `${prefix}${textToWrap}${suffix}`;
    const newContent = content.slice(0, start) + replacement + content.slice(end);

    // Save exact scroll positions to prevent jumping
    const savedScrollTop = textarea.scrollTop;
    const parent = textarea.parentElement;
    const savedParentScrollTop = parent?.scrollTop || 0;

    updateActiveContent(newContent, true);

    // Lock scroll position and re-select smoothly
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.scrollTop = savedScrollTop;
        if (textareaRef.current.parentElement) {
          textareaRef.current.parentElement.scrollTop = savedParentScrollTop;
        }
        if (!selected) {
          const newCursor = start + prefix.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor + defaultPlaceholder.length);
        } else {
          const newCursor = start + replacement.length;
          textareaRef.current.setSelectionRange(newCursor, newCursor);
        }
      }
    });
  };

  const insertHeading = (level: number) => {
    const prefix = '#'.repeat(level) + ' ';

    if (activeBlockId !== null) {
      const block = parsedBlocks.find((b) => b.id === activeBlockId);
      if (block) {
        const cleanText = block.rawText.replace(/^#+\s*/, '');
        commitBlockEdit(activeBlockId, `${prefix}${cleanText}`);
        return;
      }
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const content = activeNoteContent;
    const lastNewline = content.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const currentLine = content.slice(lineStart);
    const existingHeaderMatch = currentLine.match(/^(#+)\s*/);

    let newContent = '';
    let newPos = 0;
    if (existingHeaderMatch) {
      newContent = content.slice(0, lineStart) + prefix + currentLine.slice(existingHeaderMatch[0].length);
      newPos = lineStart + prefix.length;
    } else {
      newContent = content.slice(0, lineStart) + prefix + currentLine;
      newPos = start + prefix.length;
    }

    const savedScrollTop = textarea.scrollTop;
    updateActiveContent(newContent);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.scrollTop = savedScrollTop;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    });
  };

  const insertList = (type: 'bullet' | 'number' | 'task') => {
    const marker = type === 'bullet' ? '- ' : type === 'number' ? '1. ' : '- [ ] ';
    applyFormat(`\n${marker}`, '', 'Elemento lista');
  };

  const insertTableTemplate = () => {
    const template = `\n| Concetto | Definizione | Note |\n| :--- | :--- | :--- |\n| Esempio 1 | Spiegazione del concetto | Dettagli |\n| Esempio 2 | Altra spiegazione | formula |\n`;
    applyFormat(template, '', '');
  };

  const insertImageTemplate = () => {
    const url = prompt(
      "Inserisci URL o percorso relativo dell'immagine:",
      'https://images.unsplash.com/photo-1517842645767-c639042777db?w=600'
    );
    if (url) {
      applyFormat(`\n![Descrizione immagine](`, `)\n`, url);
    }
  };

  const insertLinkTemplate = () => {
    const textarea = textareaRef.current;
    const selected = textarea ? textarea.value.slice(textarea.selectionStart, textarea.selectionEnd) : '';
    const url = prompt('Inserisci indirizzo web (URL):', 'https://');
    if (url) {
      applyFormat(`[${selected || 'Titolo del Link'}](${url})`, '', '');
    }
  };

  // "Paste URL into selection" feature
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardText = e.clipboardData.getData('text').trim();
    const isUrl = /^https?:\/\/[^\s]+$/i.test(clipboardText);

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (isUrl && start !== end) {
      e.preventDefault();
      const content = activeNoteContent;
      const selectedText = content.slice(start, end);
      const markdownLink = `[${selectedText}](${clipboardText})`;
      const newContent = content.slice(0, start) + markdownLink + content.slice(end);

      const savedScrollTop = textarea.scrollTop;
      updateActiveContent(newContent);

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.scrollTop = savedScrollTop;
          const newPos = start + markdownLink.length;
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      });
    }
  };

  // Insert or wrap with inline math ($...$) via Ctrl+M / Cmd+M
  const handleInsertInlineMath = () => {
    // 1. If currently editing a block in Live Preview
    if (activeBlockId !== null && blockInputRef.current) {
      const input = blockInputRef.current;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const val = input.value;
      const selected = val.slice(start, end);

      if (start !== end && selected) {
        const replacement = `$${selected}$`;
        const newVal = val.slice(0, start) + replacement + val.slice(end);
        setActiveBlockDraft(newVal);
        requestAnimationFrame(() => {
          if (blockInputRef.current) {
            blockInputRef.current.focus();
            blockInputRef.current.setSelectionRange(start + 1, start + 1 + selected.length);
          }
        });
      } else {
        const newVal = val.slice(0, start) + '$$' + val.slice(end);
        setActiveBlockDraft(newVal);
        requestAnimationFrame(() => {
          if (blockInputRef.current) {
            blockInputRef.current.focus();
            blockInputRef.current.setSelectionRange(start + 1, start + 1);
          }
        });
      }
      return;
    }

    // 2. If in textarea (Split or Source mode)
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const content = activeNoteContent;
      const selected = content.slice(start, end);
      const savedScrollTop = textarea.scrollTop;

      if (start !== end && selected) {
        const replacement = `$${selected}$`;
        const newContent = content.slice(0, start) + replacement + content.slice(end);
        updateActiveContent(newContent);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.scrollTop = savedScrollTop;
            textareaRef.current.setSelectionRange(start + 1, start + 1 + selected.length);
          }
        });
      } else {
        const newContent = content.slice(0, start) + '$$' + content.slice(end);
        updateActiveContent(newContent);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.scrollTop = savedScrollTop;
            textareaRef.current.setSelectionRange(start + 1, start + 1);
          }
        });
      }
      return;
    }

    // 3. Fallback for Live Preview view mode
    const domSelection = window.getSelection()?.toString();
    if (domSelection && domSelection.length > 0) {
      const content = activeNoteContent;
      const matchIndex = content.indexOf(domSelection);
      if (matchIndex !== -1) {
        const newContent =
          content.slice(0, matchIndex) + `$${domSelection}$` + content.slice(matchIndex + domSelection.length);
        updateActiveContent(newContent, true);
      }
    } else {
      const newContent = activeNoteContent ? activeNoteContent + '\n$$' : '$$';
      updateActiveContent(newContent, true);
    }
  };

  // Global Shortcuts: Ctrl+Z (Undo), Ctrl+Y / Ctrl+Shift+Z (Redo), Ctrl+B (Toggle Bold), Ctrl+M (Math)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (!activeNotePath) return;

      const activeEl = document.activeElement;
      const isOtherInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          (activeEl.tagName === 'TEXTAREA' &&
            activeEl !== textareaRef.current &&
            activeEl !== blockInputRef.current));
      if (isOtherInput) return;

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Z: Undo / Redo
        if ((e.key === 'z' || e.key === 'Z') && !e.altKey) {
          if (activeEl === textareaRef.current) return; // Handled by textarea onKeyDown
          e.preventDefault();
          e.stopPropagation();
          if (activeBlockId !== null) setActiveBlockId(null);
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }

        // Ctrl+Y: Redo
        if ((e.key === 'y' || e.key === 'Y') && !e.shiftKey && !e.altKey) {
          if (activeEl === textareaRef.current) return; // Handled by textarea onKeyDown
          e.preventDefault();
          e.stopPropagation();
          if (activeBlockId !== null) setActiveBlockId(null);
          redo();
          return;
        }

        // Ctrl+B: Toggle Bold
        if ((e.key === 'b' || e.key === 'B') && !e.shiftKey && !e.altKey) {
          if (activeEl === textareaRef.current) return; // Handled by textarea onKeyDown
          e.preventDefault();
          e.stopPropagation();
          handleToggleBold();
          return;
        }

        // Ctrl+M: Inline Math
        if ((e.key === 'm' || e.key === 'M') && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          handleInsertInlineMath();
          return;
        }

        // Ctrl+S: Immediate Save Note
        if ((e.key === 's' || e.key === 'S') && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          if (activeBlockId !== null && blockInputRef.current) {
            commitBlockEdit(activeBlockId, activeBlockDraft);
          }
          saveActiveNote();
          return;
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeNotePath, activeBlockId, activeBlockDraft, activeNoteContent, mode, canUndo, canRedo, saveActiveNote]);

  // LaTeX Suite snippet expansions ('mk' -> $ | $, 'dm' -> $$\n|\n$$, auto-wrap $) and local shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const content = activeNoteContent;

    // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y: Undo & Redo with robust store history
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y') && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      redo();
      return;
    }

    // Ctrl+B: Toggle Bold
    if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      handleToggleBold();
      return;
    }

    // Ctrl+M or Cmd+M: Insert or wrap inline math ($...$)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M') && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      handleInsertInlineMath();
      return;
    }

    // Ctrl+S: Immediate Save
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      e.stopPropagation();
      saveActiveNote();
      return;
    }

    // Auto-wrap selection with $ for math
    if (e.key === '$' && start !== end) {
      e.preventDefault();
      const selectedText = content.slice(start, end);
      const wrapped = `$${selectedText}$`;
      const newContent = content.slice(0, start) + wrapped + content.slice(end);
      updateActiveContent(newContent, true);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.setSelectionRange(start + 1, end + 1);
        }
      });
      return;
    }

    // Auto-wrap selection with [[ ]] for WikiLinks
    if (e.key === '[' && start !== end) {
      e.preventDefault();
      const selectedText = content.slice(start, end);
      const wrapped = `[[${selectedText}]]`;
      const newContent = content.slice(0, start) + wrapped + content.slice(end);
      updateActiveContent(newContent, true);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.setSelectionRange(start + 2, end + 2);
        }
      });
      return;
    }

    // Tab key handling
    if (e.key === 'Tab') {
      e.preventDefault();
      const newContent = content.slice(0, start) + '  ' + content.slice(end);
      updateActiveContent(newContent, true);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus({ preventScroll: true });
          textareaRef.current.setSelectionRange(start + 2, start + 2);
        }
      });
      return;
    }
  };

  // Text change handler with LaTeX Suite trigger detection ('mk', 'dm') and [[ autocomplete
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    setCursorIndex(pos);

    // LaTeX Suite: 'mk' -> inline math $ | $
    if (pos >= 2 && val.slice(pos - 2, pos) === 'mk') {
      const prevChar = pos >= 3 ? val.charAt(pos - 3) : ' ';
      if (/[\s(;,]/.test(prevChar) || pos === 2) {
        const newContent = val.slice(0, pos - 2) + '$  $' + val.slice(pos);
        updateActiveContent(newContent);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus({ preventScroll: true });
            textareaRef.current.setSelectionRange(pos, pos);
          }
        });
        return;
      }
    }

    // LaTeX Suite: 'dm' -> display block math $$\n|\n$$
    if (pos >= 2 && val.slice(pos - 2, pos) === 'dm') {
      const prevChar = pos >= 3 ? val.charAt(pos - 3) : ' ';
      if (/[\s\n]/.test(prevChar) || pos === 2) {
        const newContent = val.slice(0, pos - 2) + '$$\n\n$$' + val.slice(pos);
        updateActiveContent(newContent);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.focus({ preventScroll: true });
            textareaRef.current.setSelectionRange(pos + 1, pos + 1);
          }
        });
        return;
      }
    }

    updateActiveContent(val);

    // Look back to see if user is typing a [[WikiLink
    const beforeCursor = val.slice(0, pos);
    const lastOpenIndex = beforeCursor.lastIndexOf('[[');
    const lastCloseIndex = beforeCursor.lastIndexOf(']]');

    if (lastOpenIndex !== -1 && lastOpenIndex > lastCloseIndex) {
      const query = beforeCursor.slice(lastOpenIndex + 2);
      if (!query.includes('\n')) {
        setAutocompleteQuery(query);
        setShowAutocomplete(true);
        setAutocompletePos({ top: 85, left: 90 });
        return;
      }
    }

    setShowAutocomplete(false);
  };

  const insertWikiLink = (noteTitle: string) => {
    if (activeBlockId !== null) {
      setActiveBlockDraft((prev) => `${prev} [[${noteTitle}]]`);
      setShowAutocomplete(false);
      return;
    }

    if (!textareaRef.current) return;
    const content = activeNoteContent;
    const beforeCursor = content.slice(0, cursorIndex);
    const lastOpenIndex = beforeCursor.lastIndexOf('[[');

    let newContent = '';
    let newCursorPos = 0;

    if (lastOpenIndex !== -1) {
      const afterCursor = content.slice(cursorIndex);
      newContent = content.slice(0, lastOpenIndex) + `[[${noteTitle}]]` + afterCursor;
      newCursorPos = lastOpenIndex + noteTitle.length + 4;
    } else {
      newContent = content.slice(0, cursorIndex) + `[[${noteTitle}]]` + content.slice(cursorIndex);
      newCursorPos = cursorIndex + noteTitle.length + 4;
    }

    updateActiveContent(newContent);
    setShowAutocomplete(false);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus({ preventScroll: true });
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    });
  };

  const matchingNotes = React.useMemo(() => {
    if (!autocompleteQuery.trim()) return notes.slice(0, 8);
    const q = autocompleteQuery.toLowerCase();
    return notes
      .filter((n) => n.title.toLowerCase().includes(q) && n.path !== activeNotePath)
      .slice(0, 8);
  }, [notes, autocompleteQuery, activeNotePath]);

  // Click handler for WikiLinks in preview
  const handleWikiLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, target: string) => {
    e.preventDefault();
    e.stopPropagation();
    navigateToWikiLink(target);
  };

  // Toggle checklist task from Live Preview
  const handleToggleTask = (taskIndex: number) => {
    const lines = activeNoteContent.split('\n');
    let currentTaskCount = 0;

    const newLines = lines.map((line) => {
      const unchecked = line.match(/^(\s*[-*]\s+\[)\s(\]\s+.+)$/);
      const checked = line.match(/^(\s*[-*]\s+\[)[xX](\]\s+.+)$/);

      if (unchecked || checked) {
        if (currentTaskCount === taskIndex) {
          currentTaskCount++;
          if (unchecked) {
            return `${unchecked[1]}x${unchecked[2]}`;
          } else if (checked) {
            return `${checked[1]} ${checked[2]}`;
          }
        }
        currentTaskCount++;
      }
      return line;
    });

    const savedScrollTop = liveContainerRef.current?.scrollTop || 0;
    updateActiveContent(newLines.join('\n'));

    requestAnimationFrame(() => {
      if (liveContainerRef.current) {
        liveContainerRef.current.scrollTop = savedScrollTop;
      }
    });
  };

  // Safe KaTeX renderer for block math
  const renderMathBlock = (mathString: string, key: string | number) => {
    const result = renderLatexSafe(mathString, true);
    return (
      <div
        key={key}
        className="my-3.5 py-3.5 px-5 rounded-2xl bg-[var(--card-bg)]/60 backdrop-blur-md border border-[var(--border-subtle)] overflow-x-auto text-center shadow-2xs transition-all hover:border-[var(--accent)]/40 hover:bg-[var(--card-bg)]/80"
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    );
  };

  // Robust table row parser: trims edges and splits cells
  const parseTableRow = (line: string): string[] => {
    let trimmed = line.trim();
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
    return trimmed.split('|').map((c) => c.trim());
  };

  // Inline formatting parser: handles display math, inline math, highlights, WikiLinks, and markdown
  const renderInlineFormatted = (text?: string | null): React.ReactNode[] => {
    if (!text || typeof text !== 'string') return [];
    const tokens: React.ReactNode[] = [];

    // Unified regex for inline syntax:
    // 1. Display math: \$\$([\s\S]*?)\$\$ or \\\[([\s\S]*?)\\\]
    // 2. Inline math: \$([^\s$](?:[^$\n]*?[^\s\\$])?)\$ or \\\(([\s\S]*?)\\\)
    // 3. Highlight: ==(.+?)== or <mark>(.+?)</mark>
    // 4. Strikethrough: ~~(.+?)~~
    // 5. Image: !\[(.*?)\]\((.+?)\)
    // 6. WikiLink: \[\[([^\]|]+)(?:\|([^\]]+))?\]\]
    // 7. Markdown Link: \[([^\]]+)\]\(([^)]+)\)
    // 8. Code: `([^`]+)`
    // 9. Bold: \*\*([^*]+)\*\*
    // 10. Italic: \*([^*]+)\*
    // 11. Cloze Deletion: {c(\d+)::([^}]+)}
    // 12. Flashcard QA Separator: \s*::\s*
    const combinedRegex =
      /(?:\$\$([\s\S]+?)\$\$)|(?:\\\[([\s\S]+?)\\\])|(?:\$([^\s$](?:[^$\n]*?[^\s\\$])?)\$)|(?:\\\(([\s\S]+?)\\\))|(?:==([^=\n]+)==)|(?:<mark>([^<]+)<\/mark>)|(?:~~([^~\n]+)~~)|(?:!\[([^\]]*)\]\(([^)]+)\))|(?:\[\[([^[\]|]+)(?:\|([^\]]+))?\]\])|(?:\[([^\]]+)\]\(([^)]+)\))|(?:`([^`]+)`)|(?:\*\*([^*]+)\*\*)|(?:\*([^*]+)\*)|(?:\{c(\d+)::([^}]+)\})|(\s*::\s*)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = combinedRegex.exec(text)) !== null) {
      if (match.index === combinedRegex.lastIndex) {
        combinedRegex.lastIndex++;
      }
      if (match.index > lastIndex) {
        tokens.push(text.slice(lastIndex, match.index));
      }

      const [
        ,
        displayMath1,
        displayMath2,
        inlineMath1,
        inlineMath2,
        highlightText1,
        highlightText2,
        strikeText,
        imgAlt,
        imgSrc,
        wikiTarget,
        wikiAlias,
        linkText,
        linkUrl,
        inlineCode,
        boldText,
        italicText,
        clozeNum,
        clozeContent,
        qaSep,
      ] = match;

      const displayMath = displayMath1 || displayMath2;
      const inlineMath = inlineMath1 || inlineMath2;

      if (displayMath !== undefined) {
        const result = renderLatexSafe(displayMath, true);
        tokens.push(
          <div
            key={`dmath-${match.index}`}
            className="my-3 py-2 px-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-subtle)] overflow-x-auto text-center"
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        );
      } else if (inlineMath !== undefined) {
        const result = renderLatexSafe(inlineMath, false);
        if (result.displayMode) {
          tokens.push(
            <div
              key={`math-disp-${match.index}`}
              className="my-2 py-2 px-3 rounded-xl bg-[var(--card-bg)] border border-[var(--border-subtle)] overflow-x-auto text-center"
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
          );
        } else {
          tokens.push(
            <span
              key={`math-${match.index}`}
              className="inline-math mx-0.5 inline-block"
              dangerouslySetInnerHTML={{ __html: result.html }}
            />
          );
        }
      } else if (highlightText1 !== undefined || highlightText2 !== undefined) {
        const hl = highlightText1 || highlightText2;
        tokens.push(
          <mark
            key={`hl-${match.index}`}
            className="px-1.5 py-0.5 rounded-md bg-amber-300/40 dark:bg-amber-400/30 text-amber-950 dark:text-amber-100 font-medium"
          >
            {renderInlineFormatted(hl)}
          </mark>
        );
      } else if (strikeText !== undefined) {
        tokens.push(
          <span key={`strike-${match.index}`} className="line-through text-neutral-400 dark:text-neutral-500">
            {renderInlineFormatted(strikeText)}
          </span>
        );
      } else if (imgSrc !== undefined) {
        tokens.push(
          <img
            key={`img-${match.index}`}
            src={imgSrc}
            alt={imgAlt || 'Immagine'}
            className="my-3 rounded-2xl border border-black/10 dark:border-white/10 max-h-80 object-contain shadow-apple-sm"
          />
        );
      } else if (wikiTarget !== undefined) {
        const target = wikiTarget.trim();
        const alias = wikiAlias?.trim() || target;
        tokens.push(
          <a
            key={`wiki-${match.index}`}
            href={`#${target}`}
            onClick={(e) => handleWikiLinkClick(e, target)}
            className="wikilink-badge"
            title={`Apri o crea la nota: [[${target}]]`}
          >
            <Link2 size={11} className="mr-1 opacity-70" />
            <span>{alias}</span>
          </a>
        );
      } else if (linkText !== undefined && linkUrl !== undefined) {
        tokens.push(
          <a
            key={`link-${match.index}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {linkText}
          </a>
        );
      } else if (inlineCode !== undefined) {
        tokens.push(
          <code
            key={`code-${match.index}`}
            className="px-1.5 py-0.5 rounded text-[11px] bg-black/5 dark:bg-white/10 font-mono text-amber-700 dark:text-amber-300"
          >
            {inlineCode}
          </code>
        );
      } else if (boldText !== undefined) {
        tokens.push(
          <strong key={`bold-${match.index}`} className="font-semibold text-neutral-900 dark:text-neutral-100">
            {renderInlineFormatted(boldText)}
          </strong>
        );
      } else if (italicText !== undefined) {
        tokens.push(
          <em key={`italic-${match.index}`} className="italic">
            {renderInlineFormatted(italicText)}
          </em>
        );
      } else if (clozeNum !== undefined && clozeContent !== undefined) {
        tokens.push(
          <span
            key={`cloze-${match.index}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-amber-500/15 border border-dashed border-amber-500/40 text-amber-700 dark:text-amber-300 font-mono text-[11px] align-baseline select-text"
            title={`Flashcard Cloze Deletion [c${clozeNum}]`}
          >
            <span className="text-[9px] font-bold px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 uppercase">
              c{clozeNum}
            </span>
            <span>{renderInlineFormatted(clozeContent)}</span>
          </span>
        );
      } else if (qaSep !== undefined) {
        tokens.push(
          <span
            key={`qasep-${match.index}`}
            className="inline-flex items-center gap-1 mx-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 select-none align-middle border border-amber-500/30 shadow-2xs"
            title="Separatore Flashcard SM-2 (Domanda :: Risposta)"
          >
            <Brain size={10} />
            <span>::</span>
          </span>
        );
      }

      lastIndex = combinedRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push(text.slice(lastIndex));
    }

    return tokens;
  };

  // Parse document into semantic blocks for in-place Live Preview editing
  const parsedBlocks = React.useMemo<BlockItem[]>(() => {
    const lines = activeNoteContent.split('\n');
    const blocks: BlockItem[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty lines
      if (!trimmed) {
        i++;
        continue;
      }

      // 1. Display math block $$ ... $$ or \[ ... \]
      if (trimmed.startsWith('$$') || trimmed.startsWith('\\[')) {
        const isDoubleDollar = trimmed.startsWith('$$');
        const startLine = i;
        let rawMath = line;
        const closeDelimiter = isDoubleDollar ? '$$' : '\\]';

        // Check if formula is self-contained on a single line
        const isSingleLine = isDoubleDollar
          ? trimmed.length >= 4 && trimmed.slice(2).includes('$$')
          : trimmed.length >= 4 && trimmed.slice(2).includes('\\]');

        if (!isSingleLine) {
          i++;
          while (i < lines.length && !lines[i].includes(closeDelimiter)) {
            rawMath += '\n' + lines[i];
            i++;
          }
          if (i < lines.length) {
            rawMath += '\n' + lines[i];
          }
        }
        blocks.push({
          id: `block-math-${startLine}`,
          type: 'math',
          rawText: rawMath,
          startLine,
          endLine: i,
        });
        i++;
        continue;
      }

      // 2. Code block (```dataview or ```lang)
      if (trimmed.startsWith('```')) {
        const startLine = i;
        const lang = trimmed.slice(3).trim().toLowerCase();
        let codeBody = line;
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeBody += '\n' + lines[i];
          i++;
        }
        if (i < lines.length) {
          codeBody += '\n' + lines[i];
        }
        blocks.push({
          id: `block-code-${startLine}`,
          type: lang === 'dataview' ? 'dataview' : 'code',
          rawText: codeBody,
          startLine,
          endLine: i,
        });
        i++;
        continue;
      }

      // 3. Table
      if (
        trimmed.startsWith('|') &&
        i + 1 < lines.length &&
        lines[i + 1].trim().startsWith('|') &&
        /\|(?:\s*:?-+:?\s*\|)+/.test(lines[i + 1].trim())
      ) {
        const startLine = i;
        let tableRaw = line + '\n' + lines[i + 1];
        i += 2;
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableRaw += '\n' + lines[i];
          i++;
        }
        blocks.push({
          id: `block-table-${startLine}`,
          type: 'table',
          rawText: tableRaw,
          startLine,
          endLine: i - 1,
        });
        continue;
      }

      // 4. Headings (H1 to H6)
      if (line.startsWith('# ')) {
        blocks.push({
          id: `block-h1-${i}`,
          type: 'h1',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        blocks.push({
          id: `block-h2-${i}`,
          type: 'h2',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        blocks.push({
          id: `block-h3-${i}`,
          type: 'h3',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }
      if (line.startsWith('#### ')) {
        blocks.push({
          id: `block-h4-${i}`,
          type: 'h4',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }
      if (line.startsWith('##### ')) {
        blocks.push({
          id: `block-h5-${i}`,
          type: 'h5',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }
      if (line.startsWith('###### ')) {
        blocks.push({
          id: `block-h6-${i}`,
          type: 'h6',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }

      // 5. Blockquote / Callout
      if (line.startsWith('> ')) {
        const startLine = i;
        let quoteRaw = line;
        while (i + 1 < lines.length && lines[i + 1].startsWith('> ')) {
          i++;
          quoteRaw += '\n' + lines[i];
        }
        blocks.push({
          id: `block-quote-${startLine}`,
          type: 'quote',
          rawText: quoteRaw,
          startLine,
          endLine: i,
        });
        i++;
        continue;
      }

      // 6. Checkbox Task
      if (/^\s*[-*]\s+\[[ xX]\]/.test(line)) {
        blocks.push({
          id: `block-task-${i}`,
          type: 'task',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }

      // 7. Indented Bullet / Numbered / Lettered List (e.g. 1., 1), a), -, *, +)
      const listMatch = line.match(/^(\s*)(?:([-*+])|(\d+[.)])|([a-zA-Z][.)]))\s+(.+)$/);
      if (listMatch) {
        const leadingWhitespace = listMatch[1] || '';
        const marker = listMatch[2] || listMatch[3] || listMatch[4];
        const spacesCount = leadingWhitespace.replace(/\t/g, '    ').length;
        const indentLevel = Math.max(0, Math.floor(spacesCount / 2));
        blocks.push({
          id: `block-list-${i}`,
          type: 'list',
          rawText: line,
          startLine: i,
          endLine: i,
          indentLevel,
          listMarker: marker,
        });
        i++;
        continue;
      }

      // 8. Horizontal Rule
      if (trimmed === '---' || trimmed === '***') {
        blocks.push({
          id: `block-hr-${i}`,
          type: 'hr',
          rawText: line,
          startLine: i,
          endLine: i,
        });
        i++;
        continue;
      }

      // 9. Standard Paragraph
      const startLine = i;
      let paraRaw = line;
      while (
        i + 1 < lines.length &&
        lines[i + 1].trim() &&
        !lines[i + 1].startsWith('#') &&
        !lines[i + 1].startsWith('```') &&
        !lines[i + 1].startsWith('$$') &&
        !lines[i + 1].startsWith('|') &&
        !lines[i + 1].startsWith('> ') &&
        !/^\s*(?:[-*+]|\d+[.)]|[a-zA-Z][.)])\s+/.test(lines[i + 1])
      ) {
        i++;
        paraRaw += '\n' + lines[i];
      }

      blocks.push({
        id: `block-p-${startLine}`,
        type: 'paragraph',
        rawText: paraRaw,
        startLine,
        endLine: i,
      });
      i++;
    }

    return blocks;
  }, [activeNoteContent]);

  // Start in-place editing of a block
  const handleStartEditBlock = (block: BlockItem) => {
    setActiveBlockId(block.id);
    setActiveBlockDraft(block.rawText);
  };

  // Add new paragraph block at end of note
  const handleAddNewParagraph = () => {
    const newContent = activeNoteContent.trim() ? `${activeNoteContent.trim()}\n\n` : '';
    const lines = newContent.split('\n');
    const newBlockId = `block-p-${lines.length - 1}`;
    updateActiveContent(`${newContent}Nuovo paragrafo`);
    setActiveBlockId(newBlockId);
    setActiveBlockDraft('Nuovo paragrafo');
  };

  if (!activeNote) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-8 bg-[#0E1116] select-none">
        <div className="w-12 h-12 rounded-xl bg-[#171B22] border border-[#272C36] flex items-center justify-center text-[#6B7280] mb-3">
          <FileCode2 size={24} strokeWidth={1.5} />
        </div>
        <h3 className="text-sm font-semibold text-[#F3F4F6]">
          Nessuna Nota Selezionata
        </h3>
        <p className="text-xs text-[#9CA3AF] mt-1 max-w-sm leading-relaxed">
          Seleziona un appunto dalla barra laterale o usa Quick Capture in alto per iniziare a scrivere.
        </p>
      </div>
    );
  }

  let taskItemCounter = 0;

  return (
    <div className="flex-1 h-full flex flex-col bg-[#0E1116] select-text relative">
      {/* Editor Sub-Toolbar: Mode Switcher, Typography & Width */}
      <div className="h-10 px-4 border-b border-[#272C36] flex items-center justify-between select-none bg-[#0E1116] z-20 text-xs shrink-0">
        {/* Left: Mode Switcher (Live / Split / Source) & Typography */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#171B22] p-0.5 rounded-xl border border-[#272C36]">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveBlockId(null);
                setMode('live');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                mode === 'live'
                  ? 'bg-[#131720] text-[#F3F4F6] font-medium border border-[#3A4150]'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
              title="Modalità Live Preview"
            >
              <Sparkles size={13} strokeWidth={1.5} className={mode === 'live' ? 'text-[#E5484D]' : ''} />
              <span>Live Preview</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveBlockId(null);
                setMode('split');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                mode === 'split'
                  ? 'bg-[#131720] text-[#F3F4F6] font-medium border border-[#3A4150]'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
              title="Modalità Split (Editor + Anteprima)"
            >
              <Columns size={13} strokeWidth={1.5} className={mode === 'split' ? 'text-[#E5484D]' : ''} />
              <span>Split</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveBlockId(null);
                setMode('source');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                mode === 'source'
                  ? 'bg-[#131720] text-[#F3F4F6] font-medium border border-[#3A4150]'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
              title="Modalità Codice Sorgente"
            >
              <Code size={13} strokeWidth={1.5} className={mode === 'source' ? 'text-[#E5484D]' : ''} />
              <span>Sorgente</span>
            </button>
          </div>

          {/* Typography Font Settings Modal Toggle */}
          <button
            onClick={toggleFontModal}
            className="p-1.5 rounded-xl border border-[#272C36] bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#3A4150] transition-colors"
            title="Personalizza Font & Tipografia"
          >
            <Type size={13} strokeWidth={1.5} />
          </button>

          {/* Auto-Save Toggle */}
          <button
            onClick={() => setAutoSaveMode(autoSaveMode === 'manual' ? '2s' : 'manual')}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-mono transition-colors border ${
              autoSaveMode === 'manual'
                ? 'bg-[#171B22] text-[#E5484D] border-[#E5484D]/40'
                : 'bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] border-[#272C36]'
            }`}
            title={
              autoSaveMode === 'manual'
                ? 'Salvataggio MANUALE (Ctrl+S). Clicca per attivare auto-save (2s).'
                : 'Salvataggio AUTOMATICO (2s). Clicca per passare al salvataggio manuale.'
            }
          >
            <span>{autoSaveMode === 'manual' ? 'Salva: Manuale' : 'Salva: Auto 2s'}</span>
          </button>
        </div>

        {/* Right: Width Selector & Study Note Button */}
        <div className="flex items-center gap-2">
          {/* Width Control Selector */}
          <div className="relative" ref={widthMenuRef}>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowWidthMenu(!showWidthMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[#272C36] bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] hover:border-[#3A4150] transition-colors text-xs"
              title="Regola larghezza foglio"
            >
              <MoveHorizontal size={13} strokeWidth={1.5} />
              <span className="text-[11px] font-mono hidden sm:inline">
                {isFullWidth ? '100%' : `${editorWidth}px`}
              </span>
            </button>

            {showWidthMenu && (
              <div className="absolute top-9 right-0 w-64 rounded-xl bg-[#171B22] border border-[#272C36] shadow-popover p-3 z-50 space-y-2 text-xs">
                <div className="flex items-center justify-between font-semibold text-[#F3F4F6]">
                  <span>Larghezza Foglio</span>
                  <span className="font-mono text-[#E5484D] text-[11px]">
                    {isFullWidth ? '100%' : `${editorWidth}px`}
                  </span>
                </div>

                <input
                  type="range"
                  min="640"
                  max="1600"
                  step="20"
                  value={editorWidth === -1 ? 1600 : editorWidth}
                  onChange={(e) => setEditorWidth(Number(e.target.value))}
                  className="w-full accent-[#E5484D] cursor-pointer"
                />

                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#272C36]">
                  <button
                    onClick={() => {
                      setEditorWidth(768);
                      setShowWidthMenu(false);
                    }}
                    className="p-1.5 rounded-lg border border-[#272C36] hover:border-[#E5484D] text-left text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  >
                    Compatta (768px)
                  </button>
                  <button
                    onClick={() => {
                      setEditorWidth(960);
                      setShowWidthMenu(false);
                    }}
                    className="p-1.5 rounded-lg border border-[#272C36] hover:border-[#E5484D] text-left text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  >
                    Standard (960px)
                  </button>
                  <button
                    onClick={() => {
                      setEditorWidth(1250);
                      setShowWidthMenu(false);
                    }}
                    className="p-1.5 rounded-lg border border-[#272C36] hover:border-[#E5484D] text-left text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  >
                    Ampia (1250px)
                  </button>
                  <button
                    onClick={() => {
                      setEditorWidth(-1);
                      setShowWidthMenu(false);
                    }}
                    className="p-1.5 rounded-lg border border-[#272C36] hover:border-[#E5484D] text-left text-[11px] text-[#9CA3AF] hover:text-[#F3F4F6]"
                  >
                    100% Piena
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Flashcard Quick Actions: Study & Auto-Generate */}
          <div className="flex items-center gap-1.5">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const sel = window.getSelection()?.toString() || '';
                openAutoFlashcardModal(sel || activeNoteContent, activeNote?.title, activeNote?.folder);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-all shadow-apple-sm"
              title="Genera flashcard automaticamente da questa nota (AI & Regole)"
            >
              <Sparkles size={13} className="text-amber-500" />
              <span className="hidden sm:inline">Genera Flashcard</span>
            </button>

            {noteFlashcardsCount > 0 && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => openFlashcardSession(null, activeNotePath)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium text-[#F3F4F6] bg-[#171B22] border border-[#272C36] hover:border-[#E5484D] transition-colors"
                title={`Ripassa ${noteFlashcardsCount} flashcards collegate a questa nota`}
              >
                <Brain size={13} strokeWidth={1.5} className="text-[#E5484D]" />
                <span className="hidden sm:inline">Ripassa</span>
                <span className="font-mono text-[10px] text-[#E5484D] font-bold">
                  {noteFlashcardsCount}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Word-Style Rich Formatting Toolbar (macOS Sonoma Floating Blur) */}
      <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] flex items-center flex-wrap gap-1 bg-[var(--bg-app)]/65 backdrop-blur-xl select-none text-[var(--text-secondary)] text-xs z-10">
        {/* Undo / Redo */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={undo}
            disabled={!canUndo}
            className={`p-1 rounded-md transition-colors macos-clickable ${
              canUndo
                ? 'hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] cursor-pointer'
                : 'opacity-30 cursor-not-allowed text-[var(--text-muted)]'
            }`}
            title="Annulla operazione (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={redo}
            disabled={!canRedo}
            className={`p-1 rounded-md transition-colors macos-clickable ${
              canRedo
                ? 'hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] cursor-pointer'
                : 'opacity-30 cursor-not-allowed text-[var(--text-muted)]'
            }`}
            title="Ripristina operazione (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-[var(--border-subtle)] mx-0.5" />

        {/* Headings */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(1)}
            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-semibold macos-clickable"
            title="Titolo 1 (H1)"
          >
            <Heading1 size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(2)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors font-semibold"
            title="Titolo 2 (H2)"
          >
            <Heading2 size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(3)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors font-semibold"
            title="Titolo 3 (H3)"
          >
            <Heading3 size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(4)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors font-semibold"
            title="Titolo 4 (H4)"
          >
            <Heading4 size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Inline Styles */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleToggleBold}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors font-bold"
            title="Grassetto Toggle (Ctrl+B)"
          >
            <Bold size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('*', '*', 'corsivo')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors italic"
            title="Corsivo (*I*)"
          >
            <Italic size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleHighlight}
            className="p-1 rounded hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
            title="Evidenziatore (seleziona prima almeno una parola da evidenziare)"
          >
            <Highlighter size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('~~', '~~', 'testo barrato')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Barrato (~~S~~)"
          >
            <Strikethrough size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('`', '`', 'codice')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors font-mono"
            title="Codice Inline (`code`)"
          >
            <Code size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Lists & Quotes */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertList('bullet')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Elenco Puntato (-)"
          >
            <List size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertList('number')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Elenco Numerato (1.)"
          >
            <ListOrdered size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertList('task')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Lista di Controllo (- [ ])"
          >
            <CheckSquare size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('\n> ', '', 'Citazione o callout')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Citazione / Callout (>)"
          >
            <Quote size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Insert Elements: Table, Image, Link, WikiLink, LaTeX, HR */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertTableTemplate}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Inserisci Tabella Markdown"
          >
            <Table size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertImageTemplate}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Inserisci Immagine (![alt](url))"
          >
            <ImageIcon size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertLinkTemplate}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Inserisci Link Web ([testo](url))"
          >
            <LinkIcon size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertWikiLink('Concetto')}
            className="p-1 rounded hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors flex items-center space-x-0.5"
            title="Collega Nota ([[WikiLink]])"
          >
            <Link2 size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertInlineMath}
            className="px-1.5 py-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 text-amber-600 dark:text-amber-400 transition-colors font-mono font-bold text-xs"
            title="Formula Matematica Inline ($...$) [Ctrl+M]"
          >
            $
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('\n$$\n', '\n$$\n', '\\int f(x) dx')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-amber-600 dark:text-amber-400 transition-colors font-mono font-bold"
            title="Inserisci Formula Matematica LaTeX ($$)"
          >
            <Sigma size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyFormat('\n---\n', '', '')}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title="Separatore Orizzontale (---)"
          >
            <Minus size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Diagrams & Charts Dropdown */}
        <div className="relative" ref={diagramMenuRef}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setShowDiagramMenu(!showDiagramMenu);
              setShowCodeSnippetMenu(false);
            }}
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-purple-600 dark:text-purple-400 font-medium transition-colors"
            title="Inserisci Grafico o Diagramma Mermaid"
          >
            <Workflow size={14} />
            <span>Grafici</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>

          {showDiagramMenu && (
            <div className="absolute top-7 left-0 w-64 rounded-2xl apple-card-item shadow-apple-popover p-2 border border-black/10 dark:border-white/15 z-50 space-y-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Diagrammi & Grafici Mermaid
              </div>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
graph TD
    Start([Inizio]) --> Init[Inizializzazione Variabili]
    Init --> Cond{Condizione valida?}
    Cond -- Sì --> Exec[Elaborazione Dati]
    Exec --> Loop[Aggiorna Indice]
    Loop --> Cond
    Cond -- No --> Result[Stampa Risultato]
    Result --> End([Fine])
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Diagramma di Flusso (Flowchart)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Algoritmi, rami decisionali e cicli</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
sequenceDiagram
    autonumber
    actor Utente
    participant App as NoteRip Client
    participant Core as Rust Backend
    participant FS as File System
    Utente->>App: Clicca "Esegui Codice"
    App->>Core: invoke("run_code", { lang, code })
    Core->>FS: Salva sorgente temporaneo
    Core->>Core: Compilazione con GCC / Javac
    Core-->>App: CodeRunResult (stdout, stderr)
    App-->>Utente: Mostra output in tempo reale
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Diagramma di Sequenza (Sequence)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Flussi di chiamata e interazione tra componenti</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
classDiagram
    class StrutturaDati {
        <<interface>>
        +inserisci(int val) void
        +rimuovi(int val) boolean
        +dimensione() int
    }
    class ListaConcatenata {
        -Nodo testa
        -int size
        +inserisci(int val) void
        +rimuovi(int val) boolean
        +dimensione() int
    }
    class AlberoBinario {
        -NodoAlbero radice
        +visitaInOrder() List
        +ricerca(int val) boolean
    }
    StrutturaDati <|.. ListaConcatenata : implements
    StrutturaDati <|.. AlberoBinario : implements
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Diagramma delle Classi OOP (UML)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Ereditarietà, interfacce e metodi Java</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
mindmap
  root((Programmazione))
    Linguaggio C
      Puntatori & Indirizzi
      Allocazione Dinamica malloc
      Gestione Stack e Heap
      Struct & Liste Collegate
    Linguaggio Java
      OOP & Incapsulamento
      Ereditarietà & Interfacce
      Collections Framework
      Stream API & Lambdas
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Mappa Mentale (Mindmap)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Panoramica e alberi concettuali</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
erDiagram
    STUDENTE ||--o{ ISCRIZIONE : effettua
    CORSO ||--o{ ISCRIZIONE : include
    DOCENTE ||--o{ CORSO : insegna
    STUDENTE {
        int matricola PK
        string nome
        string email
    }
    CORSO {
        string codice PK
        string titolo
        int cfu
    }
    ISCRIZIONE {
        date data_appello
        int voto
    }
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Diagramma ER (Database)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Modellazione entità e relazioni dati</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
stateDiagram-v2
    [*] --> Inattivo
    Inattivo --> InEsecuzione : Avvio Processo
    InEsecuzione --> AttesaIO : Syscall Bloccante
    AttesaIO --> Pronto : Interrupt Completato
    Pronto --> InEsecuzione : Assegnazione CPU
    InEsecuzione --> Terminato : exit(0)
    Terminato --> [*]
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Macchina a Stati (State Diagram)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Transizioni di stato e automi</span>
              </button>
            </div>
          )}
        </div>

        {/* Circuiti & Architettura Dropdown */}
        <div className="relative" ref={circuitMenuRef}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setShowCircuitMenu(!showCircuitMenu);
              setShowDiagramMenu(false);
              setShowCodeSnippetMenu(false);
            }}
            className={`flex items-center space-x-1 px-2 py-1 rounded font-medium transition-colors ${
              showCircuitMenu
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
            title="Inserisci Circuiti Logici, Datapath Architettura e Diagrammi Temporali"
          >
            <CircuitBoard size={14} />
            <span>Circuiti</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>

          {showCircuitMenu && (
            <div className="absolute top-7 left-0 w-80 rounded-2xl apple-card-item shadow-apple-popover p-2.5 border border-black/10 dark:border-white/15 z-50 space-y-1.5 text-xs max-h-96 overflow-y-auto">
              <div className="px-2 py-0.5 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">
                Circuiti Logici & Architettura
              </div>

              <button
                onClick={() =>
                  insertSnippet(`\`\`\`circuit
# Sommatore Completo (Full Adder a 1-Bit)
IN A = 1, B = 0, Cin = 1

XOR xor1 = A, B
XOR Sum = xor1, Cin

AND and1 = A, B
AND and2 = xor1, Cin
OR Cout = and1, and2

OUT Sum, Cout
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Full Adder (Sommatore con Carry)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Circuiti con ingressi interattivi e tabella di verità</span>
              </button>

              <button
                onClick={() =>
                  insertSnippet(`\`\`\`circuit
# Multiplexer 2-a-1
IN D0 = 1, D1 = 0, SEL = 0

NOT not_sel = SEL
AND path0 = D0, not_sel
AND path1 = D1, SEL
OR Out = path0, path1

OUT Out
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Multiplexer 2:1 (MUX)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Selezione di canale con porte logiche</span>
              </button>

              <button
                onClick={() =>
                  insertSnippet(`\`\`\`circuit
# Porte Logiche Fondamentali
IN A = 1, B = 0

AND and_gate = A, B
OR or_gate = A, B
XOR xor_gate = A, B
NAND nand_gate = A, B
NOR nor_gate = A, B
NOT not_a = A

OUT and_gate, or_gate, xor_gate, nand_gate, nor_gate, not_a
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Porte Logiche di Base</span>
                <span className="text-[10px] text-[var(--text-muted)]">AND, OR, NOT, XOR, NAND, NOR</span>
              </button>

              <button
                onClick={() =>
                  insertSnippet(`\`\`\`circuit
# Schema Datapath CPU (Fetch - Decode - Execute)
IN CLK = 1, RST = 0

REG PC [Program Counter 32b] [CLK: CLK, RST: RST] -> [OUT: pc_out]
BLOCK IMEM [Instruction Memory] [A: pc_out] -> [INSTR: instr]
REG RF [Register File] [CLK: CLK, RA: instr] -> [RD1: op_a, RD2: op_b]
ALU ALU [Arithmetic Logic Unit] [A: op_a, B: op_b] -> [RES: alu_res, ZERO: z_flag]
BLOCK DMEM [Data Memory] [ADDR: alu_res, CLK: CLK] -> [DATA: d_out]

OUT alu_res, z_flag, d_out
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">CPU Datapath & Moduli Architettura</span>
                <span className="text-[10px] text-[var(--text-muted)]">PC, Register File, ALU, Memorie a blocchi</span>
              </button>

              <button
                onClick={() =>
                  insertSnippet(`\`\`\`circuit
# Flip-Flop D & Registro
IN Data = 1, Clock = 1

D_FF FF0 [Flip-Flop D] [D: Data, CLK: Clock] -> [Q: q0]
OUT q0
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Flip-Flop D & Registri</span>
                <span className="text-[10px] text-[var(--text-muted)]">Elementi di memoria sequenziale</span>
              </button>

              <div className="px-2 pt-1.5 py-0.5 text-[10px] font-bold text-sky-500 uppercase tracking-wider">
                Diagrammi Temporali (Waveform)
              </div>

              <button
                onClick={() =>
                  insertSnippet(`\`\`\`timing
# Diagramma Temporale Segnali Bus & CPU
CLK   : _~_~_~_~_~_~
RESET : ~~__________
WE    : ____~~~~____
ADDR  : ===XXXX=====
DATA  : ===XXXX=====
READY : ________~~__
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Diagramma Temporale di Clock (Waveform)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Onde di clock, bus dati e segnali di sincronizzazione</span>
              </button>
            </div>
          )}
        </div>

        {/* C & Java Snippets Dropdown */}
        <div className="relative" ref={codeSnippetMenuRef}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setShowCodeSnippetMenu(!showCodeSnippetMenu);
              setShowDiagramMenu(false);
              setShowCircuitMenu(false);
            }}
            className="flex items-center space-x-1 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-amber-600 dark:text-amber-400 font-medium transition-colors"
            title="Snippet e agevolazioni per linguaggio C e Java"
          >
            <Cpu size={14} />
            <span>C & Java</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>

          {showCodeSnippetMenu && (
            <div className="absolute top-7 left-0 w-72 rounded-2xl apple-card-item shadow-apple-popover p-2.5 border border-black/10 dark:border-white/15 z-50 space-y-1.5 text-xs max-h-96 overflow-y-auto">
              <div className="px-2 py-0.5 text-[10px] font-bold text-sky-500 uppercase tracking-wider">
                Linguaggio C (Eseguibile GCC / Clang)
              </div>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`c
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    printf("Esecuzione programma C su NoteRip!\\n");
    for (int i = 1; i <= 5; i++) {
        printf("Passo %d: valore al quadrato = %d\\n", i, i * i);
    }
    return 0;
}
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">C: Template Main & I/O</span>
                <span className="text-[10px] text-[var(--text-muted)]">Struttura base con printf ed esecuzione rapida</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n = 5;
    int *array = (int *)malloc(n * sizeof(int));
    if (array == NULL) {
        fprintf(stderr, "Errore: fallita allocazione memoria Heap!\\n");
        return 1;
    }

    // Inizializzazione e visualizzazione indirizzi
    for (int i = 0; i < n; i++) {
        array[i] = (i + 1) * 10;
        printf("Indirizzo array[%d] (%p) = %d\\n", i, (void*)&array[i], array[i]);
    }

    // Deallocazione obbligatoria per evitare memory leak
    free(array);
    array = NULL;
    printf("Memoria liberata correttamente.\\n");
    return 0;
}
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">C: Allocazione Dinamica (malloc & free)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Gestione Heap con controllo NULL e deallocazione</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

Node *crea_nodo(int val) {
    Node *n = (Node *)malloc(sizeof(Node));
    if (!n) return NULL;
    n->data = val;
    n->next = NULL;
    return n;
}

int main(void) {
    Node *head = crea_nodo(10);
    head->next = crea_nodo(20);
    head->next->next = crea_nodo(30);

    printf("Lista: ");
    for (Node *curr = head; curr != NULL; curr = curr->next) {
        printf("[%d] -> ", curr->data);
    }
    printf("NULL\\n");

    while (head != NULL) {
        Node *temp = head;
        head = head->next;
        free(temp);
    }
    return 0;
}
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">C: Struct e Lista Puntatori</span>
                <span className="text-[10px] text-[var(--text-muted)]">Lista semplicemente collegata con creazione nodi</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
graph LR
    subgraph STACK ["Stack Frame (main)"]
        HEAD["Node* head<br/>0x7ffe10"]
    end
    subgraph HEAP ["Memoria Heap Dinamica"]
        N1["Nodo 1 (0x100)<br/>data: 10<br/>next: 0x200"]
        N2["Nodo 2 (0x200)<br/>data: 20<br/>next: 0x300"]
        N3["Nodo 3 (0x300)<br/>data: 30<br/>next: NULL"]
    end
    HEAD -->|Punta a| N1
    N1 -->|next| N2
    N2 -->|next| N3
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">C: Layout Memoria Pointer (Mermaid)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Visualizzazione grafica di Stack e Heap</span>
              </button>

              <div className="pt-2 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-wider border-t border-black/5 dark:border-white/10">
                Linguaggio Java (Eseguibile Javac / JDK)
              </div>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`java
public class Main {
    public static void main(String[] args) {
        System.out.println("Esecuzione classe Java su NoteRip!");
        int somma = 0;
        for (int i = 1; i <= 5; i++) {
            somma += i;
            System.out.println("i: " + i + " -> Somma parziale: " + somma);
        }
        System.out.println("Somma totale calcolata = " + somma);
    }
}
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Java: Classe Principale (Main)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Classe standard compilabile ed eseguibile con JDK</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`java
public class RecordDemo {
    // Record moderno: immutabile con costruttore, accessor e toString automatici
    public record Studente(int matricola, String nome, String corso) {
        public Studente {
            if (matricola <= 0) {
                throw new IllegalArgumentException("La matricola deve essere positiva");
            }
        }
    }

    public static void main(String[] args) {
        Studente s = new Studente(123456, "Mario Rossi", "Ingegneria Informatica");
        System.out.println("Record studente creato: " + s);
        System.out.println("Matricola: " + s.matricola() + " | Nome: " + s.nome());
    }
}
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Java: Record Moderno & DTO (Java 16+)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Oggetti dati immutabili senza boilerplate</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`java
import java.util.List;
import java.util.stream.Collectors;

public class StreamDemo {
    public static void main(String[] args) {
        List<String> linguaggi = List.of("C", "Java", "Rust", "Python", "TypeScript", "Go");

        System.out.println("Linguaggi con lunghezza > 3 in maiuscolo ordinati:");
        List<String> filtrati = linguaggi.stream()
            .filter(lang -> lang.length() > 3)
            .map(String::toUpperCase)
            .sorted()
            .collect(Collectors.toList());

        filtrati.forEach(l -> System.out.println(" -> " + l));
    }
}
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Java: Stream API & Lambda</span>
                <span className="text-[10px] text-[var(--text-muted)]">Pipeline funzionale con filter, map e collect</span>
              </button>
              <button
                onClick={() =>
                  insertSnippet(`\`\`\`mermaid
classDiagram
    class EntitaUniversitaria {
        <<abstract>>
        #String id
        #String nome
        +getDettagli()* String
    }
    class Studente {
        -int matricola
        -double mediaVoti
        +iscriviEsame(String corso) void
        +getDettagli() String
    }
    class Professore {
        -String dipartimento
        -List~String~ corsi
        +assegnaVoto(Studente s, int voto) void
        +getDettagli() String
    }
    EntitaUniversitaria <|-- Studente : extends
    EntitaUniversitaria <|-- Professore : extends
\`\`\``)
                }
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Java: Gerarchia OOP Ereditarietà (UML)</span>
                <span className="text-[10px] text-[var(--text-muted)]">Diagramma di ereditarietà di classi e interfacce</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-0.5" />

        {/* Flashcards & Cloze Insertion Menu */}
        <div className="relative" ref={flashcardMenuRef}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setShowFlashcardMenu(!showFlashcardMenu);
              setShowDiagramMenu(false);
              setShowCodeSnippetMenu(false);
            }}
            className={`flex items-center space-x-1 px-2 py-1 rounded text-amber-600 dark:text-amber-400 font-medium transition-colors ${
              showFlashcardMenu ? 'bg-amber-500/20' : 'hover:bg-amber-500/10'
            }`}
            title="Inserisci Flashcard o Cloze Deletion"
          >
            <Brain size={14} />
            <span>Flashcard</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>

          {showFlashcardMenu && (
            <div className="absolute top-7 left-0 w-72 rounded-2xl apple-card-item shadow-apple-popover p-2 border border-black/10 dark:border-white/15 z-50 space-y-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Flashcards & Studio Separato
              </div>
                <button
                  onClick={() => {
                    const sel = window.getSelection()?.toString() || '';
                    openAutoFlashcardModal(sel || activeNoteContent, activeNote?.title, activeNote?.folder);
                    setShowFlashcardMenu(false);
                  }}
                  className="w-full text-left p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex flex-col transition-colors border border-amber-500/20"
                >
                  <div className="flex items-center space-x-1.5 font-semibold">
                    <Sparkles size={13} />
                    <span>Genera Flashcards Automatiche</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)]">Crea con AI o estrai da formule e definizioni</span>
                </button>
              <button
                onClick={() => {
                  openNewFlashcardModal(activeNotePath || undefined);
                  setShowFlashcardMenu(false);
                }}
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <div className="flex items-center space-x-1.5 font-semibold text-[var(--text-primary)]">
                  <Plus size={13} className="text-amber-500" />
                  <span>Nuova Flashcard Standalone</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">Crea una carta separata (non sporca il testo della nota)</span>
              </button>
              <button
                onClick={() => {
                  setActiveView('flashcards');
                  setShowFlashcardMenu(false);
                }}
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <div className="flex items-center space-x-1.5 font-semibold text-[var(--text-primary)]">
                  <Brain size={13} className="text-amber-500" />
                  <span>Sezione Flashcards & Mazzi</span>
                </div>
                <span className="text-[10px] text-[var(--text-muted)]">Visualizza, cerca e gestisci tutte le carte del Vault</span>
              </button>
              <button
                onClick={() => {
                  openFlashcardSession(null, activeNotePath);
                  setShowFlashcardMenu(false);
                }}
                className="w-full text-left p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-between transition-colors border border-amber-500/20 mt-1"
              >
                <div className="flex items-center space-x-1.5">
                  <Brain size={13} />
                  <span className="font-semibold">Ripassa Carte di questa Nota</span>
                </div>
                <span className="text-[10px] font-mono bg-amber-500/20 px-1.5 py-0.5 rounded-md">
                  {noteFlashcardsCount} carte
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Document & Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* 1. Mode 'live': Obsidian-Style Live Preview with in-place block editing */}
        {mode === 'live' && (
          <div ref={liveContainerRef} className="w-full h-full flex flex-col overflow-y-auto relative editor-content-area bg-[#0E1116]">
            <div
              style={contentContainerStyle}
              className={`w-full mx-auto px-10 py-10 md:px-16 md:py-12 select-text space-y-3 relative transition-[max-width] ${
                isDraggingWidth ? 'duration-0 select-none' : 'duration-150 ease-out'
              }`}
            >
              {/* Left interactive resize handle */}
              {!isFullWidth && (
                <div
                  onMouseDown={(e) => handleStartDragWidth(e, 'left')}
                  onDoubleClick={() => setEditorWidth(editorWidth === -1 ? 960 : -1)}
                  className="absolute top-0 bottom-0 -left-3 w-6 cursor-col-resize group flex items-center justify-center select-none z-20"
                  title="Trascina verso sinistra per allargare (Doppio click per 100%)"
                >
                  <div className="w-1 h-16 rounded-full bg-[#272C36] group-hover:bg-[#E5484D] group-hover:h-24 transition-all opacity-0 group-hover:opacity-100" />
                </div>
              )}

              {/* Right interactive resize handle */}
              {!isFullWidth && (
                <div
                  onMouseDown={(e) => handleStartDragWidth(e, 'right')}
                  onDoubleClick={() => setEditorWidth(editorWidth === -1 ? 960 : -1)}
                  className="absolute top-0 bottom-0 -right-3 w-6 cursor-col-resize group flex items-center justify-center select-none z-20"
                  title="Trascina verso destra per allargare (Doppio click per 100%)"
                >
                  <div className="w-1 h-16 rounded-full bg-[#272C36] group-hover:bg-[#E5484D] group-hover:h-24 transition-all opacity-0 group-hover:opacity-100" />
                </div>
              )}

              {/* Live width feedback badge during drag */}
              {isDraggingWidth && (
                <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-xl bg-[#171B22] border border-[#E5484D] text-[#F3F4F6] text-xs font-mono font-medium shadow-popover pointer-events-none animate-in fade-in duration-100">
                  Larghezza: {editorWidth}px
                </div>
              )}
              {/* Note Header Title if not starting with an H1 */}
              {(parsedBlocks.length === 0 || parsedBlocks[0].type !== 'h1') && (
                <div className="pt-2 pb-6 border-b border-[#272C36] mb-6 select-none">
                  <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mb-2 font-mono">
                    <span className="px-2 py-0.5 rounded-lg bg-[#171B22] border border-[#272C36] text-[#9CA3AF]">
                      {activeNote.folder || 'Vault'}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(activeNote.updated_at * 1000).toLocaleDateString('it-IT', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-[#F3F4F6]">
                    {activeNote.title}
                  </h1>
                </div>
              )}
              {parsedBlocks.map((block) => {
                const isEditing = activeBlockId === block.id;

                const renderLiveBlock = () => {
                  // If currently editing this block in place
                  if (isEditing) {
                  return (
                    <div
                      key={block.id}
                      className="my-2 p-3.5 rounded-xl bg-[#171B22] border border-[#E5484D] transition-all"
                    >
                      <textarea
                        ref={blockInputRef}
                        autoFocus
                        value={activeBlockDraft}
                        onChange={(e) => setActiveBlockDraft(e.target.value)}
                        onBlur={() => commitBlockEdit(block.id, activeBlockDraft)}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B') && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleBold();
                            return;
                          }
                          if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.altKey) {
                            if (e.shiftKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveBlockId(null);
                              redo();
                              return;
                            } else if (activeBlockDraft === block.rawText) {
                              e.preventDefault();
                              e.stopPropagation();
                              setActiveBlockId(null);
                              undo();
                              return;
                            }
                          }
                          if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y') && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveBlockId(null);
                            redo();
                            return;
                          }
                          if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M') && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            handleInsertInlineMath();
                            return;
                          }
                          if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S') && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            commitBlockEdit(block.id, activeBlockDraft);
                            saveActiveNote();
                            return;
                          }
                          if (e.key === '$' && blockInputRef.current) {
                            const start = blockInputRef.current.selectionStart;
                            const end = blockInputRef.current.selectionEnd;
                            if (start !== end) {
                              e.preventDefault();
                              const selectedText = activeBlockDraft.slice(start, end);
                              const wrapped = `$${selectedText}$`;
                              const newVal = activeBlockDraft.slice(0, start) + wrapped + activeBlockDraft.slice(end);
                              setActiveBlockDraft(newVal);
                              requestAnimationFrame(() => {
                                if (blockInputRef.current) {
                                  blockInputRef.current.focus();
                                  blockInputRef.current.setSelectionRange(start + 1, end + 1);
                                }
                              });
                              return;
                            }
                          }
                          if (e.key === 'Escape') {
                            setActiveBlockId(null);
                          } else if (
                            e.key === 'Enter' &&
                            !e.shiftKey &&
                            (block.type === 'h1' ||
                              block.type === 'h2' ||
                              block.type === 'h3' ||
                              block.type === 'h4' ||
                              block.type === 'h5' ||
                              block.type === 'h6')
                          ) {
                            e.preventDefault();
                            commitBlockEdit(block.id, activeBlockDraft);
                          }
                        }}
                        className={`w-full bg-transparent focus:outline-none resize-none font-sans text-[var(--text-primary)] ${
                          block.type === 'h1'
                            ? 'text-2xl md:text-3xl font-bold tracking-tight'
                            : block.type === 'h2'
                            ? 'text-xl md:text-2xl font-semibold tracking-tight'
                            : block.type === 'h3'
                            ? 'text-base md:text-lg font-semibold'
                            : block.type === 'h4'
                            ? 'text-sm md:text-base font-semibold'
                            : block.type === 'h5' || block.type === 'h6'
                            ? 'text-xs md:text-sm font-semibold'
                            : 'text-xs md:text-sm leading-relaxed'
                        }`}
                        spellCheck={false}
                      />
                      <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)] pt-1.5 border-t border-[var(--border-subtle)] select-none">
                        <span>Invio per confermare • Esc per annullare</span>
                        <button
                          onClick={() => commitBlockEdit(block.id, activeBlockDraft)}
                          className="px-3 py-1 rounded-xl bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent-hover)] transition-colors macos-clickable shadow-xs"
                        >
                          Salva
                        </button>
                      </div>
                    </div>
                  );
                }

                // Render block in visual format
                switch (block.type) {
                  case 'h1':
                    return (
                      <h1
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="text-2xl md:text-3xl font-bold text-[var(--text-primary)] mt-6 mb-3 pb-2 border-b border-[var(--border-subtle)] tracking-tight cursor-text hover:bg-white/[0.03] rounded-lg px-1 transition-colors"
                        title="Clicca per modificare il titolo"
                      >
                        {renderInlineFormatted(block.rawText.replace(/^#\s*/, ''))}
                      </h1>
                    );

                  case 'h2':
                    return (
                      <h2
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="text-xl md:text-2xl font-semibold text-[var(--text-primary)] mt-5 mb-2 tracking-tight cursor-text hover:bg-white/[0.03] rounded-lg px-1 transition-colors"
                        title="Clicca per modificare"
                      >
                        {renderInlineFormatted(block.rawText.replace(/^##\s*/, ''))}
                      </h2>
                    );

                  case 'h3':
                    return (
                      <h3
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="text-base md:text-lg font-semibold text-[var(--text-primary)] mt-4 mb-1.5 cursor-text hover:bg-white/[0.03] rounded-lg px-1 transition-colors"
                        title="Clicca per modificare"
                      >
                        {renderInlineFormatted(block.rawText.replace(/^###\s*/, ''))}
                      </h3>
                    );

                  case 'h4':
                    return (
                      <h4
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="text-sm md:text-base font-semibold text-[var(--text-primary)] mt-3 mb-1 cursor-text hover:bg-white/[0.03] rounded-lg px-1 transition-colors"
                        title="Clicca per modificare"
                      >
                        {renderInlineFormatted(block.rawText.replace(/^####\s*/, ''))}
                      </h4>
                    );

                  case 'h5':
                    return (
                      <h5
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="text-xs md:text-sm font-semibold text-[var(--text-secondary)] mt-2.5 mb-1 cursor-text hover:bg-white/[0.03] rounded-lg px-1 transition-colors uppercase tracking-wider"
                        title="Clicca per modificare"
                      >
                        {renderInlineFormatted(block.rawText.replace(/^#####\s*/, ''))}
                      </h5>
                    );

                  case 'h6':
                    return (
                      <h6
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="text-xs font-semibold text-[var(--text-muted)] mt-2 mb-1 cursor-text hover:bg-white/[0.03] rounded-lg px-1 transition-colors uppercase tracking-wider"
                        title="Clicca per modificare"
                      >
                        {renderInlineFormatted(block.rawText.replace(/^######\s*/, ''))}
                      </h6>
                    );

                  case 'math':
                    return (
                      <div
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="cursor-pointer group relative"
                        title="Clicca per modificare la formula matematica"
                      >
                        {renderMathBlock(block.rawText, block.id)}
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-[10px] bg-black/40 text-white px-1.5 py-0.5 rounded">
                          Modifica LaTeX
                        </span>
                      </div>
                    );

                  case 'dataview':
                    return (
                      <div key={block.id} className="relative group">
                        <DataviewRenderer
                          queryText={block.rawText.replace(/^```dataview\s*/i, '').replace(/```$/, '').trim()}
                        />
                        <button
                          onClick={() => handleStartEditBlock(block)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-[10px] bg-black/40 text-white px-2 py-0.5 rounded shadow-apple-sm"
                        >
                          Modifica Query
                        </button>
                      </div>
                    );

                  case 'code': {
                    const lines = block.rawText.split('\n');
                    const lang = lines[0].replace('```', '').trim().toLowerCase();
                    const codeBody = lines.length > 2
                      ? lines.slice(1, lines[lines.length - 1].trim().startsWith('```') ? -1 : undefined).join('\n')
                      : lines.slice(1).join('\n');

                    if (lang === 'mermaid') {
                      return (
                        <div key={block.id} className="relative group my-3">
                          <MermaidRenderer code={codeBody} />
                          <button
                            onClick={() => handleStartEditBlock(block)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-24 text-[10px] bg-[var(--panel-bg)]/90 hover:bg-[var(--panel-bg)] border border-black/10 dark:border-white/10 text-[var(--text-primary)] px-2 py-0.5 rounded shadow-sm flex items-center gap-1 z-10"
                            title="Modifica diagramma Mermaid"
                          >
                            <span>Modifica Diagramma</span>
                          </button>
                        </div>
                      );
                    }

                    if (['circuit', 'logic', 'digital', 'arch', 'timing', 'wave'].includes(lang)) {
                      return (
                        <div key={block.id} className="relative group my-3">
                          <CircuitRenderer
                            code={codeBody}
                            lang={lang}
                            onEdit={() => handleStartEditBlock(block)}
                          />
                        </div>
                      );
                    }

                    return (
                      <CodeBlockView
                        key={block.id}
                        lang={lang}
                        code={codeBody}
                        onEdit={() => handleStartEditBlock(block)}
                      />
                    );
                  }

                  case 'table': {
                    const tableLines = block.rawText.split('\n').filter((l) => l.trim().length > 0);
                    if (tableLines.length < 2) {
                      return <div key={block.id} className="p-2 font-mono text-xs">{block.rawText}</div>;
                    }
                    const headers = parseTableRow(tableLines[0]);
                    const rows = tableLines.slice(2).map((r) => parseTableRow(r));
                    return (
                      <div
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="my-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--card-bg)]/40 backdrop-blur-md overflow-x-auto shadow-2xs cursor-text hover:border-[var(--accent)]/30 transition-colors"
                        title="Clicca per modificare la tabella"
                      >
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 text-[var(--text-secondary)]">
                              {headers.map((h, colIdx) => (
                                <th
                                  key={colIdx}
                                  className="py-2.5 px-4 font-semibold text-[11px] uppercase tracking-wider text-[var(--text-secondary)]"
                                >
                                  {renderInlineFormatted(h)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--border-subtle)]">
                            {rows.map((row, rowIdx) => (
                              <tr
                                key={rowIdx}
                                className="hover:bg-white/[0.04] transition-colors"
                              >
                                {headers.map((_, colIdx) => (
                                  <td key={colIdx} className="py-2.5 px-4 text-[var(--text-primary)]">
                                    {renderInlineFormatted(row[colIdx] || '')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  case 'quote': {
                    const isNoteAlert = block.rawText.includes('[!NOTE]');
                    const isTipAlert = block.rawText.includes('[!TIP]');
                    const isWarnAlert = block.rawText.includes('[!WARNING]');
                    const cleanQuote = block.rawText
                      .split('\n')
                      .map((l) => l.replace(/^>\s*(\[!NOTE\]|\[!TIP\]|\[!WARNING\])?\s*/, ''))
                      .join(' ');
                    return (
                      <blockquote
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className={`my-3 p-4 rounded-2xl border text-xs md:text-sm leading-relaxed cursor-text transition-all ${
                          isNoteAlert
                            ? 'bg-[#0A84FF]/10 border-[#0A84FF]/25 text-[#0A84FF] dark:text-[#5DE6FF]'
                            : isTipAlert
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                            : isWarnAlert
                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400'
                            : 'bg-[var(--card-bg)]/50 border-[var(--border-subtle)] text-[var(--text-primary)] backdrop-blur-md'
                        }`}
                        title="Clicca per modificare la citazione"
                      >
                        {renderInlineFormatted(cleanQuote)}
                      </blockquote>
                    );
                  }

                  case 'task': {
                    const match = block.rawText.match(/^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/);
                    const isChecked = match ? match[2].toLowerCase() === 'x' : false;
                    const taskText = match ? match[3] : block.rawText.replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '');
                    const currentIdx = taskItemCounter++;
                    return (
                      <div
                        key={block.id}
                        className="ml-2 flex items-center space-x-2.5 my-1.5 text-xs md:text-sm group"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTask(currentIdx)}
                          className="rounded text-amber-500 focus:ring-amber-500 cursor-pointer h-4 w-4"
                        />
                        <span
                          onClick={() => handleStartEditBlock(block)}
                          className={`cursor-text ${
                            isChecked
                              ? 'line-through text-neutral-400 dark:text-neutral-500'
                              : 'text-neutral-800 dark:text-neutral-200 group-hover:text-amber-600 transition-colors'
                          }`}
                          title="Clicca per modificare il testo del task"
                        >
                          {renderInlineFormatted(taskText || ' ')}
                        </span>
                      </div>
                    );
                  }

                  case 'list': {
                    const cleanList = block.rawText.replace(/^\s*(?:[-*+]|\d+[.)]|[a-zA-Z][.)])\s+/, '');
                    const isNumberedOrLettered = block.listMarker && !/^[-*+]$/.test(block.listMarker);
                    return (
                      <div
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        style={{ paddingLeft: `${(block.indentLevel ?? 0) * 1.5 + 0.5}rem` }}
                        className="flex items-start text-xs md:text-sm text-neutral-700 dark:text-neutral-300 my-1 leading-relaxed cursor-text hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded px-1 transition-colors"
                        title="Clicca per modificare"
                      >
                        {isNumberedOrLettered ? (
                          <span className="font-mono text-neutral-500 dark:text-neutral-400 font-semibold mr-2 shrink-0 select-none">
                            {block.listMarker}
                          </span>
                        ) : (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 mr-2.5 shrink-0" />
                        )}
                        <span className="flex-1 min-w-0">{renderInlineFormatted(cleanList)}</span>
                      </div>
                    );
                  }

                  case 'hr':
                    return <hr key={block.id} className="my-5 border-t border-black/10 dark:border-white/10" />;

                  case 'paragraph':
                  default:
                    return (
                      <p
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="text-xs md:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed my-1.5 cursor-text hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg p-1 transition-colors"
                        title="Clicca per modificare il paragrafo"
                      >
                        {renderInlineFormatted(block.rawText)}
                      </p>
                    );
                }
              };

              return (
                <ErrorBoundary key={block.id} rawFallbackContent={block.rawText}>
                  {renderLiveBlock()}
                </ErrorBoundary>
              );
            })}

              {/* Add paragraph button at bottom of note */}
              <div className="pt-4 pb-12 flex justify-start">
                <button
                  onClick={handleAddNewParagraph}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-xs text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/40 transition-colors"
                >
                  <Plus size={13} />
                  <span>Aggiungi nuovo paragrafo...</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Mode 'split': Source editor on left, formatted preview on right */}
        {mode === 'split' && (
          <>
            <div className="w-1/2 h-full flex flex-col p-6 overflow-y-auto border-r border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01] editor-content-area">
              <textarea
                ref={textareaRef}
                value={activeNoteContent}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Scrivi qui i tuoi appunti... Usa i tool della barra in alto per evidenziare, inserire formule LaTeX ($$) o tabelle!"
                className="w-full h-full resize-none bg-transparent font-sans text-sm text-neutral-800 dark:text-neutral-200 focus:outline-none leading-relaxed tracking-normal"
                spellCheck={false}
              />
            </div>
            <div className="w-1/2 h-full p-6 overflow-y-auto editor-content-area">
              <div className="max-w-xl mx-auto space-y-2">
                {parsedBlocks.map((b) => {
                  const renderSplitBlock = () => {
                    if (b.type === 'code') {
                      const lines = b.rawText.split('\n');
                      const lang = lines[0].replace('```', '').trim().toLowerCase();
                      const codeBody = lines.length > 2
                        ? lines.slice(1, lines[lines.length - 1].trim().startsWith('```') ? -1 : undefined).join('\n')
                        : lines.slice(1).join('\n');

                      if (lang === 'mermaid') {
                        return <MermaidRenderer key={b.id} code={codeBody} />;
                      }

                      if (['circuit', 'logic', 'digital', 'arch', 'timing', 'wave'].includes(lang)) {
                        return <CircuitRenderer key={b.id} code={codeBody} lang={lang} />;
                      }

                      return <CodeBlockView key={b.id} lang={lang} code={codeBody} />;
                    }
                    if (b.type === 'math') {
                      return renderMathBlock(b.rawText, b.id);
                    }
                    if (b.type === 'dataview') {
                      return (
                        <DataviewRenderer
                          key={b.id}
                          queryText={b.rawText.replace(/^```dataview\s*/i, '').replace(/```$/, '').trim()}
                        />
                      );
                    }
                    if (b.type === 'h1') {
                      return (
                        <h1 key={b.id} className="text-2xl font-bold mt-4 mb-2 pb-1 border-b border-black/5 dark:border-white/10 tracking-tight">
                          {renderInlineFormatted(b.rawText.replace(/^#\s*/, ''))}
                        </h1>
                      );
                    }
                    if (b.type === 'h2') {
                      return (
                        <h2 key={b.id} className="text-xl font-semibold mt-3 mb-1.5 tracking-tight">
                          {renderInlineFormatted(b.rawText.replace(/^##\s*/, ''))}
                        </h2>
                      );
                    }
                    if (b.type === 'h3') {
                      return (
                        <h3 key={b.id} className="text-base font-semibold mt-2.5 mb-1">
                          {renderInlineFormatted(b.rawText.replace(/^###\s*/, ''))}
                        </h3>
                      );
                    }
                    if (b.type === 'h4') {
                      return (
                        <h4 key={b.id} className="text-sm md:text-base font-semibold mt-2 mb-1">
                          {renderInlineFormatted(b.rawText.replace(/^####\s*/, ''))}
                        </h4>
                      );
                    }
                    if (b.type === 'h5') {
                      return (
                        <h5 key={b.id} className="text-xs md:text-sm font-semibold mt-1.5 mb-1 uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                          {renderInlineFormatted(b.rawText.replace(/^#####\s*/, ''))}
                        </h5>
                      );
                    }
                    if (b.type === 'h6') {
                      return (
                        <h6 key={b.id} className="text-xs font-semibold mt-1.5 mb-1 uppercase tracking-wider text-neutral-500">
                          {renderInlineFormatted(b.rawText.replace(/^######\s*/, ''))}
                        </h6>
                      );
                    }
                    if (b.type === 'list') {
                      const cleanList = b.rawText.replace(/^\s*(?:[-*+]|\d+[.)]|[a-zA-Z][.)])\s+/, '');
                      const isNumberedOrLettered = b.listMarker && !/^[-*+]$/.test(b.listMarker);
                      return (
                        <div
                          key={b.id}
                          style={{ paddingLeft: `${(b.indentLevel ?? 0) * 1.5 + 0.5}rem` }}
                          className="flex items-start text-xs md:text-sm text-neutral-700 dark:text-neutral-300 my-1 leading-relaxed"
                        >
                          {isNumberedOrLettered ? (
                            <span className="font-mono text-neutral-500 font-semibold mr-2 shrink-0 select-none">
                              {b.listMarker}
                            </span>
                          ) : (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] mt-2 mr-2.5 shrink-0" />
                          )}
                          <span className="flex-1 min-w-0">{renderInlineFormatted(cleanList)}</span>
                        </div>
                      );
                    }
                    if (b.type === 'table') {
                      const tableLines = b.rawText.split('\n').filter((l) => l.trim().length > 0);
                      if (tableLines.length < 2) {
                        return <div key={b.id} className="p-2 font-mono text-xs">{b.rawText}</div>;
                      }
                      const headers = parseTableRow(tableLines[0]);
                      const rows = tableLines.slice(2).map((r) => parseTableRow(r));
                      return (
                        <div key={b.id} className="my-3 rounded-xl border border-black/10 dark:border-white/10 overflow-x-auto shadow-apple-sm">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03]">
                                {headers.map((h, colIdx) => (
                                  <th key={colIdx} className="py-2 px-3 font-semibold text-[11px] uppercase tracking-wider">
                                    {renderInlineFormatted(h)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5 dark:divide-white/5">
                              {rows.map((row, rowIdx) => (
                                <tr key={rowIdx}>
                                  {headers.map((_, colIdx) => (
                                    <td key={colIdx} className="py-1.5 px-3 text-neutral-700 dark:text-neutral-300">
                                      {renderInlineFormatted(row[colIdx] || '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }
                    if (b.type === 'quote') {
                      const cleanQuote = b.rawText.split('\n').map((l) => l.replace(/^>\s*/, '')).join(' ');
                      return (
                        <blockquote key={b.id} className="my-2 p-3 rounded-xl border-l-4 border-amber-500 bg-amber-500/10 text-xs md:text-sm">
                          {renderInlineFormatted(cleanQuote)}
                        </blockquote>
                      );
                    }
                    if (b.type === 'task') {
                      const match = b.rawText.match(/^(\s*)[-*]\s+\[([ xX])\]\s*(.*)$/);
                      const isChecked = match ? match[2].toLowerCase() === 'x' : false;
                      const taskText = match ? match[3] : b.rawText.replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '');
                      return (
                        <div key={b.id} className="flex items-center space-x-2 my-1 text-xs md:text-sm">
                          <input type="checkbox" checked={isChecked} readOnly className="rounded text-amber-500 h-3.5 w-3.5" />
                          <span className={isChecked ? 'line-through text-neutral-400' : ''}>
                            {renderInlineFormatted(taskText || ' ')}
                          </span>
                        </div>
                      );
                    }
                    if (b.type === 'hr') {
                      return <hr key={b.id} className="my-4 border-t border-black/10 dark:border-white/10" />;
                    }
                    return (
                      <p key={b.id} className="text-xs md:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed my-1">
                        {renderInlineFormatted(b.rawText)}
                      </p>
                    );
                  };

                  return (
                    <ErrorBoundary key={b.id} rawFallbackContent={b.rawText}>
                      {renderSplitBlock()}
                    </ErrorBoundary>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 3. Mode 'source': Pure markdown source with proportional readable typography */}
        {mode === 'source' && (
          <div className="w-full h-full p-8 overflow-y-auto relative editor-content-area">
            <div
              style={contentContainerStyle}
              className={`w-full h-full mx-auto relative transition-[max-width] ${
                isDraggingWidth ? 'duration-0 select-none' : 'duration-150 ease-out'
              }`}
            >
              {/* Left/Right handles in source mode as well */}
              {!isFullWidth && (
                <>
                  <div
                    onMouseDown={(e) => handleStartDragWidth(e, 'left')}
                    onDoubleClick={() => setEditorWidth(editorWidth === -1 ? 960 : -1)}
                    className="absolute top-0 bottom-0 -left-3 w-6 cursor-col-resize group flex items-center justify-center select-none z-20"
                    title="Trascina verso sinistra per allargare (Doppio click per 100%)"
                  >
                    <div className="w-1 h-16 rounded-full bg-black/10 dark:bg-white/10 group-hover:bg-[var(--accent)] group-hover:h-24 transition-all opacity-0 group-hover:opacity-100 shadow-sm" />
                  </div>
                  <div
                    onMouseDown={(e) => handleStartDragWidth(e, 'right')}
                    onDoubleClick={() => setEditorWidth(editorWidth === -1 ? 960 : -1)}
                    className="absolute top-0 bottom-0 -right-3 w-6 cursor-col-resize group flex items-center justify-center select-none z-20"
                    title="Trascina verso destra per allargare (Doppio click per 100%)"
                  >
                    <div className="w-1 h-16 rounded-full bg-black/10 dark:bg-white/10 group-hover:bg-[var(--accent)] group-hover:h-24 transition-all opacity-0 group-hover:opacity-100 shadow-sm" />
                  </div>
                </>
              )}
              <textarea
                ref={textareaRef}
                value={activeNoteContent}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Scrivi qui i tuoi appunti Markdown..."
                className="w-full h-full resize-none bg-transparent font-sans text-sm md:text-base text-neutral-800 dark:text-neutral-200 focus:outline-none leading-relaxed"
                spellCheck={false}
              />
            </div>
          </div>
        )}
      </div>

      {/* Autocomplete Popup for [[WikiLinks]] */}
      {showAutocomplete && (
        <div
          className="absolute z-50 w-64 rounded-xl apple-card-item shadow-apple-popover dark:shadow-apple-dark-popover p-1 border border-black/10 dark:border-white/15"
          style={{ top: autocompletePos.top, left: autocompletePos.left }}
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            Collega Nota (WikiLink)
          </div>

          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {matchingNotes.length === 0 ? (
              <div
                onClick={() => insertWikiLink(autocompleteQuery)}
                className="p-2 rounded-lg text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 cursor-pointer"
              >
                Crea nuova nota: "<strong>{autocompleteQuery}</strong>"
              </div>
            ) : (
              matchingNotes.map((note) => (
                <div
                  key={note.path}
                  onClick={() => insertWikiLink(note.title)}
                  className="flex items-center justify-between p-1.5 rounded-lg text-xs text-neutral-800 dark:text-neutral-200 hover:bg-amber-500/15 hover:text-amber-900 dark:hover:text-amber-200 cursor-pointer transition-colors"
                >
                  <span className="font-medium truncate">{note.title}</span>
                  <span className="text-[10px] text-neutral-400 truncate max-w-[80px]">
                    {note.folder}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
