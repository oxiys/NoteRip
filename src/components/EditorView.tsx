import React, { useState, useRef, useEffect } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { DataviewRenderer } from './DataviewRenderer';
import { renderLatexSafe } from '../services/latexSanitizer';
import { CodeBlockView } from './CodeBlockView';
import {
  Check,
  RotateCw,
  PanelRight,
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
  PanelLeftOpen,
  MoveHorizontal,
  Brain,
  Bot,
  Undo2,
  Redo2,
} from 'lucide-react';

type EditorMode = 'live' | 'split' | 'source';

interface BlockItem {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'math' | 'code' | 'dataview' | 'table' | 'quote' | 'task' | 'list' | 'hr' | 'paragraph';
  rawText: string;
  startLine: number;
  endLine: number;
}

export const EditorView: React.FC = () => {
  const {
    activeNotePath,
    activeNoteContent,
    notes,
    isDirty,
    isInspectorOpen,
    isSidebarOpen,
    toggleSidebar,
    updateActiveContent,
    navigateToWikiLink,
    toggleInspector,
    editorWidth,
    setEditorWidth,
    openFlashcardSession,
    flashcards,
    openSmartQAModal,
    undo,
    redo,
    canUndo,
    canRedo,
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

  // Dropdown menus for Mermaid Diagrams, C/Java Snippets, Width Control and Flashcards
  const [showDiagramMenu, setShowDiagramMenu] = useState(false);
  const [showCodeSnippetMenu, setShowCodeSnippetMenu] = useState(false);
  const [showWidthMenu, setShowWidthMenu] = useState(false);
  const [showFlashcardMenu, setShowFlashcardMenu] = useState(false);
  const diagramMenuRef = useRef<HTMLDivElement>(null);
  const codeSnippetMenuRef = useRef<HTMLDivElement>(null);
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
  };

  const activeNote = React.useMemo(() => {
    return notes.find((n) => n.path === activeNotePath) || null;
  }, [notes, activeNotePath]);

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
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activeNotePath, activeBlockId, activeBlockDraft, activeNoteContent, mode, canUndo, canRedo]);

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
        className="my-3 py-3 px-4 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-subtle)] overflow-x-auto text-center shadow-apple-sm transition-all hover:border-[var(--accent)]"
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
    );
  };

  // Inline formatting parser: handles display math, inline math, highlights, WikiLinks, and markdown
  const renderInlineFormatted = (text: string): React.ReactNode[] => {
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

      // 4. Headings
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

      // 7. Bullet / Numbered list
      if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
        blocks.push({
          id: `block-list-${i}`,
          type: 'list',
          rawText: line,
          startLine: i,
          endLine: i,
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
        !/^\s*(?:[-*]|\d+\.)\s+/.test(lines[i + 1])
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
      <div className="flex-1 h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400 dark:text-neutral-500 bg-white/40 dark:bg-black/20 relative">
        {!isSidebarOpen && (
          <button
            onClick={toggleSidebar}
            title="Mostra barra laterale (Esplora File)"
            className="absolute top-3 left-3 p-1.5 rounded-md border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5 text-xs font-medium"
          >
            <PanelLeftOpen size={16} />
            <span>Mostra File</span>
          </button>
        )}
        <FileCode2 size={48} className="stroke-[1.2] mb-3 text-amber-500/40" />
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Nessuna Nota Selezionata
        </h3>
        <p className="text-xs text-neutral-400 mt-1 max-w-sm">
          Seleziona un appunto dalla barra laterale o creane uno nuovo per iniziare a scrivere.
        </p>
      </div>
    );
  }

  let taskItemCounter = 0;

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--panel-bg)] apple-vibrant select-text relative">
      {/* Editor Top Navigation Bar */}
      <div className="h-10 px-4 border-b border-black/5 dark:border-white/10 flex items-center justify-between select-none bg-black/[0.01] dark:bg-white/[0.01]">
        {/* Breadcrumb & Save Status */}
        <div className="flex items-center space-x-2 min-w-0">
          {!isSidebarOpen && (
            <button
              onClick={toggleSidebar}
              title="Mostra barra laterale (Esplora File)"
              className="p-1 -ml-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mr-1"
            >
              <PanelLeftOpen size={15} />
            </button>
          )}
          <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
            {activeNote.title}
          </span>
          <span className="text-neutral-300 dark:text-neutral-600">/</span>
          <span className="text-[11px] text-[var(--text-secondary)] truncate">{activeNote.folder}</span>

          <span className="inline-flex items-center ml-2 text-[10px] text-[var(--text-muted)]">
            {isDirty ? (
              <span className="flex items-center text-[var(--accent)] space-x-1">
                <RotateCw size={11} className="animate-spin" />
                <span>Salvataggio...</span>
              </span>
            ) : (
              <span className="flex items-center text-emerald-600 dark:text-emerald-400 space-x-1">
                <Check size={11} />
                <span>Salvato</span>
              </span>
            )}
          </span>
        </div>

        {/* View Mode Controls (Live Preview / Split / Source) & Inspector Toggle */}
        <div className="flex items-center space-x-1">
          {/* Mode Switcher */}
          <div className="flex items-center bg-black/5 dark:bg-white/5 p-0.5 rounded-lg">
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveBlockId(null);
                setMode('live');
              }}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                mode === 'live'
                  ? 'bg-[var(--card-bg)] text-[var(--accent)] font-semibold shadow-apple-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Modalità Live Preview (Stile Obsidian: documento visivo formattato con modifica in-place)"
            >
              <Sparkles size={13} />
              <span>Live Preview</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveBlockId(null);
                setMode('split');
              }}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                mode === 'split'
                  ? 'bg-[var(--card-bg)] text-[var(--text-primary)] font-semibold shadow-apple-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Modalità Split (Editor a sinistra + Anteprima a destra)"
            >
              <Columns size={13} />
              <span>Split</span>
            </button>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setActiveBlockId(null);
                setMode('source');
              }}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs transition-colors ${
                mode === 'source'
                  ? 'bg-[var(--card-bg)] text-[var(--accent)] font-semibold shadow-apple-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Modalità Codice Sorgente (Markdown puro)"
            >
              <Code size={13} />
              <span>Sorgente</span>
            </button>
          </div>

          <div className="h-4 w-px bg-black/10 dark:bg-white/10 mx-1" />

          {/* Width Control Selector */}
          <div className="relative" ref={widthMenuRef}>
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowWidthMenu(!showWidthMenu)}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs transition-colors ${
                showWidthMenu
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
              }`}
              title="Regola larghezza area di scrittura (oppure trascina i bordi laterali)"
            >
              <MoveHorizontal size={14} />
              <span className="text-[11px] font-medium hidden sm:inline">
                {isFullWidth ? '100%' : `${editorWidth}px`}
              </span>
            </button>

            {showWidthMenu && (
              <div className="absolute top-8 right-0 w-64 rounded-2xl apple-card-item shadow-apple-popover p-3 border border-black/10 dark:border-white/15 z-50 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
                  <span>Larghezza Foglio</span>
                  <span className="font-mono text-[11px] text-[var(--accent)] font-bold">
                    {isFullWidth ? '100% (Piena)' : `${editorWidth}px`}
                  </span>
                </div>

                {/* Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                    <span>Compatta (640px)</span>
                    <span>Ampia (1600px)</span>
                  </div>
                  <input
                    type="range"
                    min="640"
                    max="1600"
                    step="20"
                    value={editorWidth === -1 ? 1600 : editorWidth}
                    onChange={(e) => setEditorWidth(Number(e.target.value))}
                    className="w-full accent-[var(--accent)] cursor-pointer"
                  />
                </div>

                {/* Presets Grid */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-black/5 dark:border-white/10">
                  <button
                    onClick={() => {
                      setEditorWidth(768);
                      setShowWidthMenu(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                      editorWidth === 768
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
                        : 'border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">Compatta</div>
                    <div className="text-[9px] text-[var(--text-muted)]">768px (Lettura)</div>
                  </button>

                  <button
                    onClick={() => {
                      setEditorWidth(960);
                      setShowWidthMenu(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                      editorWidth === 960
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
                        : 'border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">Standard</div>
                    <div className="text-[9px] text-[var(--text-muted)]">960px (Bilanciata)</div>
                  </button>

                  <button
                    onClick={() => {
                      setEditorWidth(1250);
                      setShowWidthMenu(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                      editorWidth === 1250
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
                        : 'border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">Ampia</div>
                    <div className="text-[9px] text-[var(--text-muted)]">1250px (Desktop)</div>
                  </button>

                  <button
                    onClick={() => {
                      setEditorWidth(-1);
                      setShowWidthMenu(false);
                    }}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                      isFullWidth
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
                        : 'border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-secondary)]'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">100% Piena</div>
                    <div className="text-[9px] text-[var(--text-muted)]">Tutto lo schermo</div>
                  </button>
                </div>

                <div className="text-[10px] text-[var(--text-muted)] text-center pt-1 border-t border-black/5 dark:border-white/5">
                  💡 Puoi anche trascinare i bordi laterali del foglio con il mouse
                </div>
              </div>
            )}
          </div>

          {/* Smart Q&A & Semantic Search Button */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openSmartQAModal()}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 transition-colors shadow-xs"
            title="Chiedi al Vault: Ricerca Semantica & AI Locale"
          >
            <Bot size={13} className="text-purple-500" />
            <span className="hidden sm:inline">Chiedi al Vault</span>
          </button>

          {/* Flashcard Study Note Button */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => openFlashcardSession(null, activeNotePath)}
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 transition-colors shadow-xs"
            title={`Avvia sessione Flashcards SM-2 per questa nota (${noteFlashcardsCount} carte)`}
          >
            <Brain size={13} className="text-amber-500" />
            <span className="hidden sm:inline">Ripassa Nota</span>
            <span className="text-[10px] font-bold px-1 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
              {noteFlashcardsCount}
            </span>
          </button>

          {/* Inspector Panel Toggle */}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggleInspector}
            className={`p-1.5 rounded-md transition-colors ${
              isInspectorOpen
                ? 'bg-[var(--accent-subtle)] text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
            }`}
            title="Mostra / Nascondi pannello Backlinks"
          >
            <PanelRight size={15} />
          </button>
        </div>
      </div>

      {/* Word-Style Rich Formatting Toolbar (Non-blurring onMouseDown) */}
      <div className="px-3 py-1.5 border-b border-black/5 dark:border-white/10 flex items-center flex-wrap gap-1 bg-black/[0.02] dark:bg-white/[0.02] select-none text-neutral-600 dark:text-neutral-300 text-xs">
        {/* Undo / Redo */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={undo}
            disabled={!canUndo}
            className={`p-1 rounded transition-colors ${
              canUndo
                ? 'hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 cursor-pointer'
                : 'opacity-30 cursor-not-allowed text-neutral-400'
            }`}
            title="Annulla operazione (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={redo}
            disabled={!canRedo}
            className={`p-1 rounded transition-colors ${
              canRedo
                ? 'hover:bg-black/5 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200 cursor-pointer'
                : 'opacity-30 cursor-not-allowed text-neutral-400'
            }`}
            title="Ripristina operazione (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 size={15} />
          </button>
        </div>

        <div className="h-4 w-px bg-black/10 dark:border-white/10 mx-0.5" />

        {/* Headings */}
        <div className="flex items-center space-x-0.5">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertHeading(1)}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors font-semibold"
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

        {/* C & Java Snippets Dropdown */}
        <div className="relative" ref={codeSnippetMenuRef}>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setShowCodeSnippetMenu(!showCodeSnippetMenu);
              setShowDiagramMenu(false);
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
            <div className="absolute top-7 left-0 w-68 rounded-2xl apple-card-item shadow-apple-popover p-2 border border-black/10 dark:border-white/15 z-50 space-y-1 text-xs">
              <div className="px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Flashcards & Ripetizione Spaziata
              </div>
              <button
                onClick={() => {
                  applyFormat('\nDomanda qui?::Risposta corretta qui.\n', '', '');
                  setShowFlashcardMenu(false);
                }}
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Domanda / Risposta (Q::A)</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">Domanda?::Risposta</span>
              </button>
              <button
                onClick={() => {
                  applyFormat('{c1::', '}', 'testo nascosto');
                  setShowFlashcardMenu(false);
                }}
                className="w-full text-left p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex flex-col transition-colors"
              >
                <span className="font-semibold text-[var(--text-primary)]">Cloze Deletion (Testo Nascosto)</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">{'{c1::testo da memorizzare}'}</span>
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
                  <span className="font-semibold">Avvia Sessione Studio</span>
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
          <div ref={liveContainerRef} className="w-full h-full flex flex-col overflow-y-auto relative">
            <div
              style={contentContainerStyle}
              className={`w-full mx-auto px-8 py-7 select-text space-y-2 relative transition-[max-width] ${
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
                  <div className="w-1 h-16 rounded-full bg-black/10 dark:bg-white/10 group-hover:bg-[var(--accent)] group-hover:h-24 transition-all opacity-0 group-hover:opacity-100 shadow-sm" />
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
                  <div className="w-1 h-16 rounded-full bg-black/10 dark:bg-white/10 group-hover:bg-[var(--accent)] group-hover:h-24 transition-all opacity-0 group-hover:opacity-100 shadow-sm" />
                </div>
              )}

              {/* Live width feedback badge during drag */}
              {isDraggingWidth && (
                <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 px-3 py-1 rounded-full bg-[var(--accent)] text-white text-xs font-mono font-medium shadow-apple-md pointer-events-none animate-in fade-in duration-100">
                  Larghezza: {editorWidth}px
                </div>
              )}
              {parsedBlocks.map((block) => {
                const isEditing = activeBlockId === block.id;

                // If currently editing this block in place
                if (isEditing) {
                  return (
                    <div
                      key={block.id}
                      className="my-2 p-2 rounded-xl bg-amber-500/5 dark:bg-amber-400/5 border border-amber-500/30 ring-1 ring-amber-500/20 transition-all shadow-apple-sm"
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
                          } else if (e.key === 'Enter' && !e.shiftKey && (block.type === 'h1' || block.type === 'h2' || block.type === 'h3')) {
                            e.preventDefault();
                            commitBlockEdit(block.id, activeBlockDraft);
                          }
                        }}
                        className={`w-full bg-transparent focus:outline-none resize-none font-sans text-neutral-800 dark:text-neutral-200 ${
                          block.type === 'h1'
                            ? 'text-2xl md:text-3xl font-bold tracking-tight'
                            : block.type === 'h2'
                            ? 'text-xl md:text-2xl font-semibold tracking-tight'
                            : block.type === 'h3'
                            ? 'text-base md:text-lg font-semibold'
                            : 'text-xs md:text-sm leading-relaxed'
                        }`}
                        spellCheck={false}
                      />
                      <div className="flex justify-between items-center text-[10px] text-neutral-400 pt-1 border-t border-black/5 dark:border-white/5 select-none">
                        <span>Invio per confermare • Esc per annullare</span>
                        <button
                          onClick={() => commitBlockEdit(block.id, activeBlockDraft)}
                          className="px-2 py-0.5 rounded bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors shadow-apple-sm"
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
                        className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-6 mb-2.5 pb-1.5 border-b border-black/5 dark:border-white/10 tracking-tight cursor-text hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg px-1 transition-colors"
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
                        className="text-xl md:text-2xl font-semibold text-neutral-800 dark:text-neutral-200 mt-5 mb-2 tracking-tight cursor-text hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg px-1 transition-colors"
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
                        className="text-base md:text-lg font-semibold text-neutral-800 dark:text-neutral-200 mt-4 mb-1.5 cursor-text hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded-lg px-1 transition-colors"
                        title="Clicca per modificare"
                      >
                        {renderInlineFormatted(block.rawText.replace(/^###\s*/, ''))}
                      </h3>
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
                    const lang = lines[0].replace('```', '').trim();
                    const codeBody = lines.slice(1, -1).join('\n');
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
                    const tableLines = block.rawText.split('\n');
                    const headers = tableLines[0]
                      .split('|')
                      .slice(1, -1)
                      .map((h) => h.trim());
                    const rows = tableLines.slice(2).map((r) =>
                      r
                        .split('|')
                        .slice(1, -1)
                        .map((c) => c.trim())
                    );
                    return (
                      <div
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="my-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] overflow-x-auto shadow-apple-sm cursor-text hover:border-amber-500/30 transition-colors"
                        title="Clicca per modificare la tabella"
                      >
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] text-neutral-800 dark:text-neutral-200">
                              {headers.map((h, colIdx) => (
                                <th
                                  key={colIdx}
                                  className="py-2.5 px-3 font-semibold text-[11px] uppercase tracking-wider"
                                >
                                  {renderInlineFormatted(h)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/5 dark:divide-white/5">
                            {rows.map((row, rowIdx) => (
                              <tr
                                key={rowIdx}
                                className="hover:bg-amber-500/5 dark:hover:bg-amber-400/5 transition-colors"
                              >
                                {headers.map((_, colIdx) => (
                                  <td key={colIdx} className="py-2 px-3 text-neutral-700 dark:text-neutral-300">
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
                        className={`my-3 p-3.5 rounded-2xl border-l-4 text-xs md:text-sm leading-relaxed cursor-text ${
                          isNoteAlert
                            ? 'bg-blue-500/10 border-blue-500 text-blue-900 dark:text-blue-200'
                            : isTipAlert
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                            : isWarnAlert
                            ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200'
                            : 'bg-black/5 dark:bg-white/5 border-neutral-400 text-neutral-700 dark:text-neutral-300'
                        }`}
                        title="Clicca per modificare la citazione"
                      >
                        {renderInlineFormatted(cleanQuote)}
                      </blockquote>
                    );
                  }

                  case 'task': {
                    const match = block.rawText.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/);
                    if (!match) return null;
                    const isChecked = match[2].toLowerCase() === 'x';
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
                          {renderInlineFormatted(match[3])}
                        </span>
                      </div>
                    );
                  }

                  case 'list': {
                    const cleanList = block.rawText.replace(/^\s*(?:[-*]|\d+\.)\s+/, '');
                    return (
                      <li
                        key={block.id}
                        onClick={() => handleStartEditBlock(block)}
                        className="ml-5 list-disc text-xs md:text-sm text-neutral-700 dark:text-neutral-300 my-1 leading-relaxed cursor-text hover:bg-black/[0.02] dark:hover:bg-white/[0.02] rounded px-1 transition-colors"
                        title="Clicca per modificare"
                      >
                        {renderInlineFormatted(cleanList)}
                      </li>
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
            <div className="w-1/2 h-full flex flex-col p-6 overflow-y-auto border-r border-black/5 dark:border-white/10 bg-black/[0.01] dark:bg-white/[0.01]">
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
            <div className="w-1/2 h-full p-6 overflow-y-auto">
              <div className="max-w-xl mx-auto space-y-2">
                {parsedBlocks.map((b) => {
                  if (b.type === 'code') {
                    const lines = b.rawText.split('\n');
                    const lang = lines[0].replace('```', '').trim();
                    const codeBody = lines.slice(1, -1).join('\n');
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
                  return <div key={b.id}>{renderInlineFormatted(b.rawText)}</div>;
                })}
              </div>
            </div>
          </>
        )}

        {/* 3. Mode 'source': Pure markdown source with proportional readable typography */}
        {mode === 'source' && (
          <div className="w-full h-full p-8 overflow-y-auto relative">
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
