import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import type { AppTheme } from '../store/useVaultStore';
import {
  Search,
  FileText,
  Folder,
  Tag,
  Brain,
  Network,
  Cloud,
  PanelLeft,
  PanelRight,
  Palette,
  Sparkles,
  MoveHorizontal,
  Table,
  Sigma,
  Workflow,
  FileCode2,
  FilePlus,
  FolderPlus,
  ArrowRight,
  CornerDownLeft,
  X,
  Bot,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  category: 'Note' | 'Comandi' | 'Tag' | 'Cartelle';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    commandPaletteInitialQuery,
    closeCommandPalette,
    toggleCommandPalette,
    notes,
    selectNote,
    activeNotePath,
    activeView,
    setActiveView,
    toggleSidebar,
    toggleInspector,
    openVaultDialog,
    createNewNote,
    createFolder,
    setTheme,
    setEditorWidth,
    toggleSyncModal,
    openFlashcardSession,
    updateActiveContent,
    activeNoteContent,
    dueFlashcardsCount,
    openSmartQAModal,
  } = useVaultStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync initial query when opened
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery(commandPaletteInitialQuery || '');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isCommandPaletteOpen, commandPaletteInitialQuery]);

  // Global Keyboard shortcut: Ctrl+K / Cmd+K / Ctrl+P / Cmd+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && (e.key === 'k' || e.key === 'K' || e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        e.stopPropagation();
        toggleCommandPalette();
      }

      if (e.key === 'Escape' && isCommandPaletteOpen) {
        e.preventDefault();
        closeCommandPalette();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isCommandPaletteOpen, toggleCommandPalette, closeCommandPalette]);

  // Helper to insert snippet into active note
  const insertIntoCurrentNote = (snippet: string) => {
    if (!activeNotePath) {
      alert('Apri prima una nota per inserire questo elemento!');
      return;
    }
    const newContent = activeNoteContent ? `${activeNoteContent}\n\n${snippet.trim()}\n` : `${snippet.trim()}\n`;
    updateActiveContent(newContent);
  };

  // Build static commands list
  const commandsList = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      // Ricerca Semantica & Smart Q&A
      {
        id: 'cmd-smart-qa',
        category: 'Comandi',
        title: 'Chiedi al Vault: Ricerca Semantica & Smart Q&A',
        subtitle: 'Interroga i tuoi appunti in linguaggio naturale con comprensione semantica offline',
        badge: 'AI Locale',
        icon: <Bot size={16} className="text-purple-500" />,
        action: () => openSmartQAModal(),
        keywords: ['chiedi', 'domanda', 'ai', 'semantica', 'ollama', 'smart', 'qa', 'ricerca', 'spiega'],
      },

      // Studio & Flashcards
      {
        id: 'cmd-flashcards-all',
        category: 'Comandi',
        title: 'Ripassa Flashcards (SM-2): Tutte le Note',
        subtitle: `Avvia sessione di studio spaziato (${dueFlashcardsCount} carte da ripassare)`,
        badge: 'Studio',
        icon: <Brain size={16} className="text-amber-500" />,
        action: () => openFlashcardSession(),
        keywords: ['anki', 'ripasso', 'flashcard', 'studio', 'memoria', 'supermemo', 'esame'],
      },
      {
        id: 'cmd-flashcards-active',
        category: 'Comandi',
        title: 'Ripassa Flashcards della Nota Corrente',
        subtitle: 'Filtra la sessione solo sulle domande della nota attiva',
        badge: 'Nota',
        icon: <Brain size={16} className="text-amber-500" />,
        action: () => openFlashcardSession(null, activeNotePath),
        keywords: ['anki', 'ripasso', 'flashcard', 'questa nota'],
      },

      // Viste e Navigazione
      {
        id: 'cmd-toggle-graph',
        category: 'Comandi',
        title: activeView === 'graph' ? 'Torna all\'Editor delle Note' : 'Visualizza Grafo 2D delle Connessioni',
        subtitle: 'Mappa interattiva delle relazioni, WikiLinks e tag',
        badge: 'Grafo',
        icon: <Network size={16} className="text-cyan-500" />,
        action: () => setActiveView(activeView === 'graph' ? 'notes' : 'graph'),
        keywords: ['grafo', 'graph', 'rete', 'mappa', 'relazioni', 'visuale'],
      },
      {
        id: 'cmd-toggle-sidebar',
        category: 'Comandi',
        title: 'Mostra / Nascondi Barra Laterale',
        subtitle: 'Espandi o comprimi la barra con l\'albero dei file',
        badge: 'Layout',
        icon: <PanelLeft size={16} className="text-blue-500" />,
        action: () => toggleSidebar(),
        keywords: ['sidebar', 'barra', 'pannello', 'nascondi', 'espandi'],
      },
      {
        id: 'cmd-toggle-inspector',
        category: 'Comandi',
        title: 'Mostra / Nascondi Pannello Backlinks & Proprietà',
        subtitle: 'Floating Card con connessioni in entrata, menzioni e tag',
        badge: 'Layout',
        icon: <PanelRight size={16} className="text-indigo-500" />,
        action: () => toggleInspector(),
        keywords: ['inspector', 'backlinks', 'menzioni', 'card', 'floating'],
      },

      // File & Vault
      {
        id: 'cmd-new-note',
        category: 'Comandi',
        title: 'Crea Nuova Nota',
        subtitle: 'Crea un nuovo file Markdown (.md) nel Vault',
        badge: 'File',
        icon: <FilePlus size={16} className="text-emerald-500" />,
        action: async () => {
          const title = prompt('Titolo della nuova nota:');
          if (title && title.trim()) {
            await createNewNote(title.trim());
          }
        },
        keywords: ['nuova nota', 'new note', 'file', 'crea', 'markdown'],
      },
      {
        id: 'cmd-new-folder',
        category: 'Comandi',
        title: 'Crea Nuova Cartella',
        subtitle: 'Crea una cartella all\'interno del Vault',
        badge: 'Cartella',
        icon: <FolderPlus size={16} className="text-amber-500" />,
        action: async () => {
          const folderName = prompt('Nome della nuova cartella:');
          if (folderName && folderName.trim()) {
            await createFolder(folderName.trim());
          }
        },
        keywords: ['nuova cartella', 'new folder', 'directory'],
      },
      {
        id: 'cmd-sync-vault',
        category: 'Comandi',
        title: 'Sincronizza Vault (Git & Cloud)',
        subtitle: 'Gestisci il backup automatico, commit e cartella cloud',
        badge: 'Sync',
        icon: <Cloud size={16} className="text-sky-500" />,
        action: () => toggleSyncModal(),
        keywords: ['sync', 'sincronizzazione', 'git', 'cloud', 'backup', 'drive'],
      },
      {
        id: 'cmd-open-vault',
        category: 'Comandi',
        title: 'Apri o Cambia Cartella Vault...',
        subtitle: 'Seleziona una cartella diversa sul disco',
        badge: 'Vault',
        icon: <Folder size={16} className="text-amber-600" />,
        action: () => openVaultDialog(),
        keywords: ['apri vault', 'cambia vault', 'cartella', 'disco'],
      },

      // Temi
      {
        id: 'cmd-theme-catppuccin-mocha',
        category: 'Comandi',
        title: 'Tema: Catppuccin Mocha (Eye Comfort Dark)',
        subtitle: 'Palette scura calibrata contro l\'affaticamento visivo',
        badge: 'Tema',
        icon: <Palette size={16} className="text-purple-400" />,
        action: () => setTheme('catppuccin-mocha' as AppTheme),
        keywords: ['tema', 'theme', 'dark', 'scuro', 'catppuccin', 'mocha'],
      },
      {
        id: 'cmd-theme-catppuccin-latte',
        category: 'Comandi',
        title: 'Tema: Catppuccin Latte (Eye Comfort Light)',
        subtitle: 'Palette chiara morbida senza contrasti accecanti',
        badge: 'Tema',
        icon: <Palette size={16} className="text-amber-600" />,
        action: () => setTheme('catppuccin-latte' as AppTheme),
        keywords: ['tema', 'theme', 'light', 'chiaro', 'catppuccin', 'latte'],
      },
      {
        id: 'cmd-theme-apple-dark',
        category: 'Comandi',
        title: 'Tema: Apple Dark (Nero Assoluto Minimal)',
        subtitle: 'Stile scuro macOS moderno con accento ambra',
        badge: 'Tema',
        icon: <Palette size={16} className="text-neutral-400" />,
        action: () => setTheme('apple-dark' as AppTheme),
        keywords: ['tema', 'theme', 'apple', 'dark', 'nero'],
      },
      {
        id: 'cmd-theme-apple-light',
        category: 'Comandi',
        title: 'Tema: Apple Light (Bianco Elegante)',
        subtitle: 'Stile chiaro nativo Apple con tipografia pulita',
        badge: 'Tema',
        icon: <Palette size={16} className="text-amber-500" />,
        action: () => setTheme('apple-light' as AppTheme),
        keywords: ['tema', 'theme', 'apple', 'light', 'bianco'],
      },

      // Larghezza Editor
      {
        id: 'cmd-width-compact',
        category: 'Comandi',
        title: 'Larghezza Foglio Editor: Compatta (768px)',
        subtitle: 'Ideale per lettura concentrata stile libro',
        badge: 'Editor',
        icon: <MoveHorizontal size={16} className="text-neutral-500" />,
        action: () => setEditorWidth(768),
        keywords: ['larghezza', 'width', 'compatta', 'foglio', 'margini'],
      },
      {
        id: 'cmd-width-standard',
        category: 'Comandi',
        title: 'Larghezza Foglio Editor: Standard (960px)',
        subtitle: 'Bilanciata per scrittura e codice',
        badge: 'Editor',
        icon: <MoveHorizontal size={16} className="text-neutral-500" />,
        action: () => setEditorWidth(960),
        keywords: ['larghezza', 'width', 'standard', 'foglio'],
      },
      {
        id: 'cmd-width-wide',
        category: 'Comandi',
        title: 'Larghezza Foglio Editor: Ampia (1250px)',
        subtitle: 'Ottimale per tabelle e diagrammi estesi',
        badge: 'Editor',
        icon: <MoveHorizontal size={16} className="text-neutral-500" />,
        action: () => setEditorWidth(1250),
        keywords: ['larghezza', 'width', 'ampia', 'desktop'],
      },
      {
        id: 'cmd-width-full',
        category: 'Comandi',
        title: 'Larghezza Foglio Editor: 100% Piena (Full Screen)',
        subtitle: 'Occupa l\'intera larghezza della finestra',
        badge: 'Editor',
        icon: <MoveHorizontal size={16} className="text-neutral-500" />,
        action: () => setEditorWidth(-1),
        keywords: ['larghezza', 'width', '100%', 'full', 'massima'],
      },

      // Inserimenti Rapidi
      {
        id: 'cmd-insert-flashcard-qa',
        category: 'Comandi',
        title: 'Inserisci Flashcard: Domanda / Risposta',
        subtitle: 'Sintassi istantanea: Domanda?::Risposta corretta',
        badge: 'Flashcard',
        icon: <Brain size={16} className="text-amber-500" />,
        action: () => insertIntoCurrentNote('\nDomanda qui?::Risposta corretta qui.\n'),
        keywords: ['flashcard', 'domanda', 'risposta', 'anki', 'inserisci'],
      },
      {
        id: 'cmd-insert-cloze',
        category: 'Comandi',
        title: 'Inserisci Cloze Deletion (Testo Nascosto)',
        subtitle: 'Sintassi con cloze: {c1::testo da ricordare}',
        badge: 'Flashcard',
        icon: <Sparkles size={16} className="text-amber-500" />,
        action: () => insertIntoCurrentNote('{c1::testo da ricordare}'),
        keywords: ['cloze', 'deletion', 'testo nascosto', 'flashcard', 'anki'],
      },
      {
        id: 'cmd-insert-latex-inline',
        category: 'Comandi',
        title: 'Inserisci Formula Matematica Inline ($...$)',
        subtitle: 'Espressione matematica nel testo con KaTeX (Ctrl+M)',
        badge: 'Ctrl+M',
        icon: <Sigma size={16} className="text-amber-500" />,
        action: () => insertIntoCurrentNote('$x^2 + y^2 = r^2$'),
        keywords: ['inline', 'latex', 'formula', 'matematica', 'dollaro', 'equazione', 'ctrl+m', 'm'],
      },
      {
        id: 'cmd-insert-latex',
        category: 'Comandi',
        title: 'Inserisci Formula Matematica LaTeX ($$)',
        subtitle: 'Equazione visuale renderizzata con KaTeX',
        badge: 'LaTeX',
        icon: <Sigma size={16} className="text-rose-500" />,
        action: () => insertIntoCurrentNote('\n$$\n\\int_{a}^{b} f(x) \\, dx = F(b) - F(a)\n$$\n'),
        keywords: ['latex', 'formula', 'matematica', 'integrale', 'equazione', 'katex'],
      },
      {
        id: 'cmd-insert-table',
        category: 'Comandi',
        title: 'Inserisci Tabella Markdown',
        subtitle: 'Griglia strutturata a colonne per appunti',
        badge: 'Tabella',
        icon: <Table size={16} className="text-emerald-500" />,
        action: () =>
          insertIntoCurrentNote(
            '\n| Parametro | Descrizione | Note |\n| :--- | :--- | :--- |\n| Valore 1 | Dettaglio 1 | Info |\n| Valore 2 | Dettaglio 2 | Info |\n'
          ),
        keywords: ['tabella', 'table', 'colonne', 'griglia'],
      },
      {
        id: 'cmd-insert-mermaid-flow',
        category: 'Comandi',
        title: 'Inserisci Diagramma di Flusso Mermaid (Flowchart)',
        subtitle: 'Rami decisionali, cicli e sequenze algoritmiche',
        badge: 'Mermaid',
        icon: <Workflow size={16} className="text-purple-500" />,
        action: () =>
          insertIntoCurrentNote(`\`\`\`mermaid
graph TD
    Start([Inizio]) --> Init[Inizializzazione Variabili]
    Init --> Cond{Condizione valida?}
    Cond -- Sì --> Exec[Elaborazione Dati]
    Exec --> Loop[Aggiorna Indice]
    Loop --> Cond
    Cond -- No --> Result[Stampa Risultato]
    Result --> End([Fine])
\`\`\``),
        keywords: ['mermaid', 'grafico', 'flowchart', 'flusso', 'algoritmo', 'diagramma'],
      },
      {
        id: 'cmd-insert-mermaid-mindmap',
        category: 'Comandi',
        title: 'Inserisci Mappa Mentale Mermaid (Mindmap)',
        subtitle: 'Albero concettuale per ripasso e schemi esame',
        badge: 'Mermaid',
        icon: <Workflow size={16} className="text-purple-500" />,
        action: () =>
          insertIntoCurrentNote(`\`\`\`mermaid
mindmap
  root((Argomento Esame))
    Fondamenti
      Definizioni
      Teoremi
    Applicazioni
      Algoritmi
      Casi di Studio
    Approfondimenti
      Limiti e Trade-off
\`\`\``),
        keywords: ['mindmap', 'mappa', 'mentale', 'albero', 'schema', 'mermaid'],
      },
      {
        id: 'cmd-insert-c-snippet',
        category: 'Comandi',
        title: 'Inserisci Snippet C: Gestione Memoria (malloc & free)',
        subtitle: 'Codice C con allocazione Heap e controllo puntatore NULL',
        badge: 'Codice C',
        icon: <FileCode2 size={16} className="text-blue-500" />,
        action: () =>
          insertIntoCurrentNote(`\`\`\`c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n = 5;
    int *array = (int *)malloc(n * sizeof(int));
    if (array == NULL) {
        fprintf(stderr, "Errore: fallita allocazione memoria!\\n");
        return 1;
    }
    for (int i = 0; i < n; i++) {
        array[i] = (i + 1) * 10;
        printf("array[%d] = %d\\n", i, array[i]);
    }
    free(array);
    array = NULL;
    return 0;
}
\`\`\``),
        keywords: ['c', 'linguaggio c', 'malloc', 'free', 'puntatori', 'heap'],
      },
      {
        id: 'cmd-insert-java-record',
        category: 'Comandi',
        title: 'Inserisci Snippet Java: Record Moderno & DTO',
        subtitle: 'Dati immutabili senza boilerplate per Java 16+',
        badge: 'Java',
        icon: <FileCode2 size={16} className="text-amber-500" />,
        action: () =>
          insertIntoCurrentNote(`\`\`\`java
public record Studente(int matricola, String nome, String corso) {
    public Studente {
        if (matricola <= 0) {
            throw new IllegalArgumentException("Matricola non valida");
        }
    }
}
\`\`\``),
        keywords: ['java', 'record', 'dto', 'oop', 'classi'],
      },
    ];

    return items;
  }, [
    dueFlashcardsCount,
    activeView,
    activeNotePath,
    activeNoteContent,
    openFlashcardSession,
    setActiveView,
    toggleSidebar,
    toggleInspector,
    createNewNote,
    createFolder,
    toggleSyncModal,
    openVaultDialog,
    setTheme,
    setEditorWidth,
    insertIntoCurrentNote,
  ]);

  // Extract unique tags and folders from vault notes
  const vaultTags = useMemo(() => {
    const tagMap = new Map<string, number>();
    for (const note of notes) {
      for (const t of note.tags || []) {
        const clean = t.replace(/^#/, '');
        tagMap.set(clean, (tagMap.get(clean) || 0) + 1);
      }
    }
    return Array.from(tagMap.entries()).map(([tag, count]) => ({
      tag,
      count,
    }));
  }, [notes]);

  const vaultFolders = useMemo(() => {
    const set = new Set<string>();
    for (const note of notes) {
      if (note.folder && note.folder.trim()) {
        set.add(note.folder.trim());
      }
    }
    return Array.from(set);
  }, [notes]);

  // Filter items according to search query
  const filteredItems = useMemo<PaletteItem[]>(() => {
    const raw = query.trim();
    const isCommandMode = raw.startsWith('>');
    const isTagMode = raw.startsWith('#');
    const isFolderMode = raw.startsWith('/');

    const cleanQuery = raw.replace(/^[>#/]/, '').trim().toLowerCase();

    // 1. Tag Mode
    if (isTagMode) {
      return vaultTags
        .filter((item) => !cleanQuery || item.tag.toLowerCase().includes(cleanQuery))
        .map((item) => ({
          id: `tag-${item.tag}`,
          category: 'Tag',
          title: `#${item.tag}`,
          subtitle: `${item.count} note collegate con questo tag`,
          badge: 'Tag',
          icon: <Tag size={15} className="text-amber-500" />,
          action: () => {
            closeCommandPalette();
            // Filter or search for this tag
            useVaultStore.getState().setSearchQuery(`#${item.tag}`);
          },
        }));
    }

    // 2. Folder Mode
    if (isFolderMode) {
      return vaultFolders
        .filter((folder) => !cleanQuery || folder.toLowerCase().includes(cleanQuery))
        .map((folder) => ({
          id: `folder-${folder}`,
          category: 'Cartelle',
          title: folder,
          subtitle: `Cartella del Vault`,
          badge: 'Cartella',
          icon: <Folder size={15} className="text-amber-500" />,
          action: () => {
            closeCommandPalette();
            useVaultStore.getState().setSelectedFolder(folder);
          },
        }));
    }

    // 3. Command Mode
    if (isCommandMode) {
      return commandsList.filter((cmd) => {
        if (!cleanQuery) return true;
        const text = `${cmd.title} ${cmd.subtitle || ''} ${cmd.keywords?.join(' ') || ''}`.toLowerCase();
        return text.includes(cleanQuery);
      });
    }

    // 4. Unified Global Search (Notes first, then Commands, then Tags)
    const result: PaletteItem[] = [];

    // Note items
    const matchedNotes = notes
      .filter((note) => {
        if (!cleanQuery) return true;
        const inTitle = note.title.toLowerCase().includes(cleanQuery);
        const inFolder = note.folder.toLowerCase().includes(cleanQuery);
        const inTags = (note.tags || []).some((t) => t.toLowerCase().includes(cleanQuery));
        const inContent = note.content.toLowerCase().includes(cleanQuery);
        return inTitle || inFolder || inTags || inContent;
      })
      .slice(0, 15)
      .map((note) => {
        let snippet = note.folder ? `${note.folder} / ` : '';
        const tagsStr = (note.tags || []).map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
        if (tagsStr) snippet += ` ${tagsStr}`;

        return {
          id: `note-${note.path}`,
          category: 'Note' as const,
          title: note.title,
          subtitle: snippet || 'Nota Markdown',
          badge: note.folder || 'Vault',
          icon: <FileText size={15} className="text-[var(--accent)]" />,
          action: () => {
            selectNote(note.path);
            closeCommandPalette();
          },
        };
      });

    result.push(...matchedNotes);

    // Matching Commands
    const matchedCommands = commandsList.filter((cmd) => {
      if (!cleanQuery) return false; // In empty query, show notes first
      const text = `${cmd.title} ${cmd.subtitle || ''} ${cmd.keywords?.join(' ') || ''}`.toLowerCase();
      return text.includes(cleanQuery);
    });

    result.push(...matchedCommands);

    // If query is empty and no notes, show commands
    if (!cleanQuery && result.length === 0) {
      result.push(...commandsList.slice(0, 10));
    }

    return result;
  }, [query, commandsList, notes, vaultTags, vaultFolders, selectNote, closeCommandPalette]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredItems[selectedIndex];
      if (target) {
        target.action();
        closeCommandPalette();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeCommandPalette();
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      onClick={closeCommandPalette}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl apple-card-item shadow-2xl border border-black/15 dark:border-white/15 overflow-hidden flex flex-col bg-[var(--card-bg)] text-[var(--text-primary)] transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Search Bar Input */}
        <div className="flex items-center px-4 py-3.5 border-b border-black/10 dark:border-white/10 gap-3">
          <Search size={18} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cerca note, scrivi > per comandi, # per tag, / per cartelle..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
            autoFocus
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)]"
            >
              <X size={14} />
            </button>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--text-muted)] bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-black/[0.03] dark:divide-white/[0.03]"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-[var(--text-muted)] space-y-2">
              <p className="text-xs">Nessun risultato trovato per &quot;{query}&quot;</p>
              <p className="text-[11px] opacity-75">
                Premi <kbd className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10">&gt;</kbd> per visualizzare tutti i comandi dell&apos;app
              </p>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={() => {
                    item.action();
                    closeCommandPalette();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white shadow-xs'
                      : 'hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]'
                      }`}
                    >
                      {item.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate leading-tight flex items-center gap-1.5">
                        <span>{item.title}</span>
                        {item.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                              isSelected
                                ? 'bg-white/20 text-white'
                                : 'bg-black/5 dark:bg-white/10 text-[var(--text-muted)]'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div
                          className={`text-[10px] truncate mt-0.5 ${
                            isSelected ? 'text-white/80' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    {isSelected ? (
                      <span className="flex items-center space-x-1 text-[10px] font-medium bg-white/20 text-white px-2 py-0.5 rounded-md">
                        <span>Esegui</span>
                        <CornerDownLeft size={10} />
                      </span>
                    ) : (
                      <ArrowRight size={12} className="opacity-30" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints (Raycast style) */}
        <div className="px-4 py-2 border-t border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <kbd className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-mono">
                ↑↓
              </kbd>
              <span>Naviga</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-mono">
                ↵
              </kbd>
              <span>Seleziona</span>
            </span>
            <span className="flex items-center space-x-1">
              <kbd className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 font-mono">
                ESC
              </kbd>
              <span>Chiudi</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-2">
            <button
              onClick={() => setQuery('>')}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              <kbd className="px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">&gt;</kbd> Comandi
            </button>
            <button
              onClick={() => setQuery('#')}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              <kbd className="px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">#</kbd> Tag
            </button>
            <button
              onClick={() => setQuery('/')}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              <kbd className="px-1 py-0.2 rounded bg-black/5 dark:bg-white/10">/</kbd> Cartelle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
