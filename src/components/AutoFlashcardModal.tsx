import React, { useState, useEffect, useMemo } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import {
  generateFlashcardsSmart,
  extractFlashcardsHeuristic,
  type GeneratedFlashcardDraft,
  type FlashcardGenerationStyle,
} from '../services/flashcardGeneratorService';
import { loadAISettings, saveAISettings, type GenAIProvider } from '../services/aiSettingsService';
import { renderLatexSafe } from '../services/latexSanitizer';
import {
  Sparkles,
  Brain,
  X,
  Check,
  Folder,
  Layers,
  Settings,
  RefreshCw,
  Trash2,
  Cpu,
  Zap,
  Code,
  CheckSquare,
  Square,
  Play,
  FileText,
  AlertCircle,
  Plus,
  BookOpen,
  HelpCircle,
  Hash,
  Table as TableIcon,
} from 'lucide-react';

function renderMathSnippet(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      const math = part.slice(2, -2);
      const res = renderLatexSafe(math, true);
      return (
        <div
          key={idx}
          className="my-1.5 py-1 px-2 rounded-lg bg-black/20 text-center font-mono text-xs overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: res.html }}
        />
      );
    }
    if (part.startsWith('$') && part.endsWith('$')) {
      const math = part.slice(1, -1);
      const res = renderLatexSafe(math, false);
      return (
        <span
          key={idx}
          className="mx-0.5 inline-block align-baseline font-mono text-xs text-amber-400"
          dangerouslySetInnerHTML={{ __html: res.html }}
        />
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

const STYLE_OPTIONS: Array<{ id: FlashcardGenerationStyle; label: string; icon: string; desc: string }> = [
  { id: 'exam', label: 'Esame Universitario', icon: '🎓', desc: 'Active Recall profondo, ragionamento e trabocchetti' },
  { id: 'concepts', label: 'Concetti & Logica', icon: '💡', desc: 'Spiegazioni intuitive e relazioni causa-effetto' },
  { id: 'definitions', label: 'Definizioni Esatte', icon: '📖', desc: 'Terminologia rigorosa e acronimi' },
  { id: 'formulas', label: 'Formule & Teoremi', icon: '📐', desc: 'LaTeX KaTeX, passaggi algebrici e ipotesi' },
  { id: 'cloze', label: 'Cloze Deletion', icon: '🧩', desc: 'Completamento rapido di parole chiave' },
];

export const AutoFlashcardModal: React.FC = () => {
  const {
    isAutoFlashcardModalOpen,
    autoFlashcardInitialText,
    autoFlashcardInitialTitle,
    autoFlashcardInitialDeck,
    closeAutoFlashcardModal,
    addFlashcardsBatch,
    openFlashcardSession,
    showToast,
    flashcards,
    activeNotePath,
    activeNoteContent,
    notes,
  } = useVaultStore();

  const activeNote = useMemo(() => {
    return notes.find((n) => n.path === activeNotePath);
  }, [notes, activeNotePath]);

  // Source text state
  const [sourceType, setSourceType] = useState<'note' | 'selection' | 'custom'>('note');
  const [customText, setCustomText] = useState('');
  const [targetDeck, setTargetDeck] = useState('Generale');

  // Generation options
  const [engineMode, setEngineMode] = useState<'smart' | 'heuristic'>('smart');
  const [generationStyle, setGenerationStyle] = useState<FlashcardGenerationStyle>('exam');
  const [cardTargetCount, setCardTargetCount] = useState<number>(8);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Results state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [draftCards, setDraftCards] = useState<GeneratedFlashcardDraft[]>([]);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'ai' | 'cloze' | 'definitions' | 'questions' | 'tables'>('all');

  // AI Settings Mini Drawer
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [aiSettings, setAiSettings] = useState(loadAISettings);

  // Available decks list
  const existingDecks = useMemo(() => {
    const set = new Set<string>();
    flashcards.forEach((c) => {
      const d = c.deck || c.folder || 'Generale';
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [flashcards]);

  // Effective content to analyze
  const effectiveContent = useMemo(() => {
    if (sourceType === 'selection' && autoFlashcardInitialText) {
      return autoFlashcardInitialText;
    }
    if (sourceType === 'custom') {
      return customText;
    }
    return activeNoteContent || autoFlashcardInitialText || '';
  }, [sourceType, autoFlashcardInitialText, customText, activeNoteContent]);

  // Reset and auto-run upon opening
  useEffect(() => {
    if (isAutoFlashcardModalOpen) {
      const fallbackDeck =
        autoFlashcardInitialDeck ||
        (activeNote?.folder && activeNote.folder !== 'Root' ? activeNote.folder : activeNote?.title || 'Generale');
      setTargetDeck(fallbackDeck);

      if (autoFlashcardInitialText && autoFlashcardInitialText.trim().length > 0) {
        setSourceType('selection');
      } else {
        setSourceType('note');
      }

      setGenerationError(null);
      setAiSettings(loadAISettings());

      // Trigger initial scan
      const textToScan = (autoFlashcardInitialText || activeNoteContent || '').trim();
      if (textToScan) {
        handleRunGeneration(textToScan, fallbackDeck);
      } else {
        setDraftCards([]);
      }
    }
  }, [isAutoFlashcardModalOpen, autoFlashcardInitialText, autoFlashcardInitialDeck, activeNoteContent, activeNote]);

  const handleRunGeneration = async (text: string, deck: string) => {
    if (!text.trim()) {
      setGenerationError('Nessun testo disponibile per la generazione.');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      if (engineMode === 'heuristic') {
        const extracted = extractFlashcardsHeuristic(
          text,
          activeNotePath || undefined,
          autoFlashcardInitialTitle || activeNote?.title,
          deck
        );
        setDraftCards(extracted);
        if (extracted.length === 0) {
          setGenerationError('Nessun pattern di flashcard rilevato. Prova la modalità Smart AI o aggiungi Cloze {c1::...}, ==evidenziazioni== o Q::A.');
        }
      } else {
        const result = await generateFlashcardsSmart(text, {
          deck,
          notePath: activeNotePath || undefined,
          noteTitle: autoFlashcardInitialTitle || activeNote?.title,
          targetCount: cardTargetCount,
          style: generationStyle,
          customPrompt: customPrompt.trim() || undefined,
        });

        setDraftCards(result.cards);

        if (result.error) {
          setGenerationError(`Nota: ${result.error} (utilizzata estrazione euristica avanzata).`);
        } else if (result.cards.length === 0) {
          setGenerationError('Nessuna flashcard generata dal testo fornito.');
        }
      }
    } catch (err) {
      setGenerationError((err as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleCard = (id: string) => {
    setDraftCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleUpdateFront = (id: string, front: string) => {
    setDraftCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, front } : c))
    );
  };

  const handleUpdateBack = (id: string, back: string) => {
    setDraftCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, back } : c))
    );
  };

  const handleDeleteDraft = (id: string) => {
    setDraftCards((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSelectAll = (select: boolean) => {
    setDraftCards((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  const handleAddManualCard = () => {
    const newCard: GeneratedFlashcardDraft = {
      id: `manual_${Date.now()}`,
      front: '',
      back: '',
      deck: targetDeck,
      tags: ['manuale'],
      sourceType: 'qa_inline',
      selected: true,
      notePath: activeNotePath || undefined,
      noteTitle: activeNote?.title,
    };
    setDraftCards((prev) => [newCard, ...prev]);
  };

  const filteredCards = useMemo(() => {
    if (activeFilterTab === 'all') return draftCards;
    if (activeFilterTab === 'ai') return draftCards.filter((c) => c.sourceType === 'ai');
    if (activeFilterTab === 'cloze') return draftCards.filter((c) => c.sourceType === 'cloze' || c.sourceType === 'highlight');
    if (activeFilterTab === 'definitions') return draftCards.filter((c) => c.sourceType === 'definition' || c.sourceType === 'callout');
    if (activeFilterTab === 'questions') return draftCards.filter((c) => c.sourceType === 'qa_inline' || c.sourceType === 'multiline' || c.sourceType === 'question_heading');
    if (activeFilterTab === 'tables') return draftCards.filter((c) => c.sourceType === 'table' || c.sourceType === 'formula' || c.sourceType === 'enumeration');
    return draftCards;
  }, [draftCards, activeFilterTab]);

  const selectedCards = useMemo(() => {
    return draftCards.filter((c) => c.selected && c.front.trim() && c.back.trim());
  }, [draftCards]);

  const handleSaveBatch = async (startStudyNow = false) => {
    if (selectedCards.length === 0) return;

    const cardsToSave = selectedCards.map((c) => ({
      front: c.front.trim(),
      back: c.back.trim(),
      deck: targetDeck.trim() || 'Generale',
      tags: c.tags,
      notePath: c.notePath,
      noteTitle: c.noteTitle,
    }));

    await addFlashcardsBatch(cardsToSave);

    showToast(
      `${cardsToSave.length} ${cardsToSave.length === 1 ? 'flashcard aggiunta' : 'flashcard aggiunte'} al mazzo "${targetDeck}"!`,
      'success'
    );

    closeAutoFlashcardModal();

    if (startStudyNow) {
      openFlashcardSession(targetDeck);
    }
  };

  const handleSaveAISettings = (updated: typeof aiSettings) => {
    setAiSettings(updated);
    saveAISettings(updated);
    showToast('Impostazioni AI salvate.', 'info');
  };

  if (!isAutoFlashcardModalOpen) return null;

  return (
    <div
      onClick={closeAutoFlashcardModal}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-[#171B22] border border-[#272C36] shadow-2xl overflow-hidden flex flex-col text-[#F3F4F6] transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Top Header */}
        <header className="px-6 py-4 border-b border-[#272C36] flex items-center justify-between bg-[#131720]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30 shadow-subtle">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold tracking-tight">
                  Creazione Automatica Flashcards
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#E5484D]/10 text-[#E5484D] border border-[#E5484D]/20">
                  Active Recall SM-2
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                Genera flashcard universitarie ad alta resa con AI o estrazione euristica istantanea da formule, definizioni e schemi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
              className={`p-1.5 rounded-lg border transition-colors ${
                showSettingsDrawer
                  ? 'bg-[#E5484D]/20 text-[#E5484D] border-[#E5484D]/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] border-transparent'
              }`}
              title="Configura Provider AI (Ollama locale, Gemini, Groq, OpenAI)"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={closeAutoFlashcardModal}
              className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* AI Provider Config Drawer (Collapsible) */}
        {showSettingsDrawer && (
          <div className="px-6 py-3.5 bg-[#10141C] border-b border-[#272C36] text-xs space-y-3 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#F3F4F6] flex items-center gap-1.5">
                <Cpu size={14} className="text-[#E5484D]" />
                Provider AI per la generazione automatica:
              </span>
              <span className="text-[11px] text-[#9CA3AF]">Zero costi con Ollama locale o chiavi API personali</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider block mb-1">
                  Provider
                </label>
                <select
                  value={aiSettings.provider}
                  onChange={(e) => {
                    const updated = { ...aiSettings, provider: e.target.value as GenAIProvider };
                    handleSaveAISettings(updated);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#171B22] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none"
                >
                  <option value="none">Nessuno (Solo Euristica Offline)</option>
                  <option value="ollama">Ollama (Locale, 100% Privato)</option>
                  <option value="gemini">Google Gemini (Flash)</option>
                  <option value="groq">Groq (Llama-3.3 70B Veloce)</option>
                  <option value="openai">OpenAI (GPT-4o Mini)</option>
                </select>
              </div>

              {aiSettings.provider === 'ollama' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider block mb-1">
                    Modello Ollama
                  </label>
                  <input
                    type="text"
                    value={aiSettings.ollamaModel}
                    onChange={(e) => {
                      const updated = { ...aiSettings, ollamaModel: e.target.value };
                      handleSaveAISettings(updated);
                    }}
                    placeholder="es. llama3, mistral, deepseek-r1"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#171B22] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none font-mono"
                  />
                </div>
              )}

              {aiSettings.provider === 'gemini' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider block mb-1">
                    Gemini API Key
                  </label>
                  <input
                    type="password"
                    value={aiSettings.geminiKey}
                    onChange={(e) => {
                      const updated = { ...aiSettings, geminiKey: e.target.value };
                      handleSaveAISettings(updated);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#171B22] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none font-mono"
                  />
                </div>
              )}

              {aiSettings.provider === 'groq' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider block mb-1">
                    Groq API Key
                  </label>
                  <input
                    type="password"
                    value={aiSettings.groqKey}
                    onChange={(e) => {
                      const updated = { ...aiSettings, groqKey: e.target.value };
                      handleSaveAISettings(updated);
                    }}
                    placeholder="gsk_..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#171B22] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none font-mono"
                  />
                </div>
              )}

              {aiSettings.provider === 'openai' && (
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-[#9CA3AF] uppercase font-bold tracking-wider block mb-1">
                    OpenAI API Key
                  </label>
                  <input
                    type="password"
                    value={aiSettings.openaiKey}
                    onChange={(e) => {
                      const updated = { ...aiSettings, openaiKey: e.target.value };
                      handleSaveAISettings(updated);
                    }}
                    placeholder="sk-..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#171B22] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Control Toolbar */}
        <div className="p-4 border-b border-[#272C36] bg-[#141822] space-y-3 text-xs">
          {/* Top Row: Source, Mode & Deck */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Source Tabs */}
              <div className="flex items-center rounded-xl bg-[#171B22] border border-[#272C36] p-0.5">
                <button
                  onClick={() => setSourceType('note')}
                  className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 font-medium ${
                    sourceType === 'note'
                      ? 'bg-[#E5484D] text-white shadow-2xs'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  <FileText size={12} />
                  <span>Nota Attiva</span>
                </button>
                {autoFlashcardInitialText && (
                  <button
                    onClick={() => setSourceType('selection')}
                    className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 font-medium ${
                      sourceType === 'selection'
                        ? 'bg-[#E5484D] text-white shadow-2xs'
                        : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                    }`}
                  >
                    <Zap size={12} />
                    <span>Testo Selezionato</span>
                  </button>
                )}
                <button
                  onClick={() => setSourceType('custom')}
                  className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 font-medium ${
                    sourceType === 'custom'
                      ? 'bg-[#E5484D] text-white shadow-2xs'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  <Code size={12} />
                  <span>Incolla Testo</span>
                </button>
              </div>

              {/* Engine Mode */}
              <div className="flex items-center rounded-xl bg-[#171B22] border border-[#272C36] p-0.5">
                <button
                  onClick={() => setEngineMode('smart')}
                  className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium ${
                    engineMode === 'smart'
                      ? 'bg-[#1C212B] text-white border border-[#272C36]'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                  title="Genera domande concettuali avanzate con AI + euristica"
                >
                  <Brain size={12} className="text-[#E5484D]" />
                  <span>Smart AI</span>
                </button>
                <button
                  onClick={() => setEngineMode('heuristic')}
                  className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 font-medium ${
                    engineMode === 'heuristic'
                      ? 'bg-[#1C212B] text-white border border-[#272C36]'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                  title="Estrae solo pattern espliciti (Q::A, Cloze {c1::...}, formule, tabelle, definizioni) offline"
                >
                  <Zap size={12} className="text-amber-400" />
                  <span>Euristica Offline</span>
                </button>
              </div>
            </div>

            {/* Deck Destination and Re-scan */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Folder size={13} className="text-[#E5484D]" />
                <input
                  type="text"
                  value={targetDeck}
                  onChange={(e) => setTargetDeck(e.target.value)}
                  placeholder="Mazzo di destinazione..."
                  list="auto-deck-suggestions"
                  className="w-40 px-2.5 py-1 rounded-lg bg-[#171B22] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none"
                />
                <datalist id="auto-deck-suggestions">
                  {existingDecks.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </div>

              <button
                onClick={() => handleRunGeneration(effectiveContent, targetDeck)}
                disabled={isGenerating}
                className="px-3 py-1 rounded-lg bg-[#1C212B] hover:bg-[#252B38] border border-[#272C36] text-xs font-medium text-[#F3F4F6] flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={isGenerating ? 'animate-spin text-[#E5484D]' : ''} />
                <span>{isGenerating ? 'Generazione...' : 'Rigenera'}</span>
              </button>
            </div>
          </div>

          {/* AI Style & Target Count Bar (Only shown in Smart AI mode) */}
          {engineMode === 'smart' && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#272C36]/50">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-[#9CA3AF] mr-1 font-semibold">Stile di Studio:</span>
                {STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setGenerationStyle(style.id)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 border ${
                      generationStyle === style.id
                        ? 'bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/35'
                        : 'bg-[#171B22] text-[#9CA3AF] border-[#272C36] hover:text-[#F3F4F6]'
                    }`}
                    title={style.desc}
                  >
                    <span>{style.icon}</span>
                    <span>{style.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#9CA3AF]">N° Carte:</span>
                <div className="flex items-center bg-[#171B22] border border-[#272C36] rounded-lg p-0.5 text-[11px]">
                  {[5, 8, 12, 16, 20].map((num) => (
                    <button
                      key={num}
                      onClick={() => setCardTargetCount(num)}
                      className={`px-2 py-0.5 rounded-md font-mono ${
                        cardTargetCount === num
                          ? 'bg-[#E5484D] text-white font-bold'
                          : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors ${
                    showAdvancedOptions || customPrompt.trim()
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      : 'text-[#9CA3AF] border-transparent hover:text-[#F3F4F6]'
                  }`}
                  title="Aggiungi istruzioni personalizzate per l'AI"
                >
                  Prompt Extra
                </button>
              </div>
            </div>
          )}

          {/* Advanced Prompt Input */}
          {showAdvancedOptions && engineMode === 'smart' && (
            <div className="pt-2 animate-in fade-in duration-150">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Istruzioni opzionali per l'AI (es. 'Focalizzati su dimostrazioni e passaggi matematici', 'Scrivi in inglese')..."
                className="w-full px-3 py-1.5 rounded-xl bg-[#11141C] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none"
              />
            </div>
          )}
        </div>

        {/* Custom Textarea if Custom Source is selected */}
        {sourceType === 'custom' && (
          <div className="p-4 bg-[#11141C] border-b border-[#272C36]">
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Incolla qui gli appunti, paragrafi o definizioni da trasformare in flashcards..."
              rows={4}
              className="w-full p-2.5 rounded-xl bg-[#171B22] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none resize-none font-mono"
            />
          </div>
        )}

        {/* Notice/Error Bar if any */}
        {generationError && (
          <div className="px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1">{generationError}</span>
          </div>
        )}

        {/* Filter Tabs & Quick Actions Bar */}
        <div className="px-6 py-2 border-b border-[#272C36]/70 bg-[#131720] flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveFilterTab('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeFilterTab === 'all'
                  ? 'bg-black/30 text-[#F3F4F6] border border-[#272C36]'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              Tutte ({draftCards.length})
            </button>
            <button
              onClick={() => setActiveFilterTab('ai')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeFilterTab === 'ai'
                  ? 'bg-[#E5484D]/15 text-[#E5484D] border border-[#E5484D]/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              ✨ AI ({draftCards.filter((c) => c.sourceType === 'ai').length})
            </button>
            <button
              onClick={() => setActiveFilterTab('cloze')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeFilterTab === 'cloze'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              🧩 Cloze ({draftCards.filter((c) => c.sourceType === 'cloze' || c.sourceType === 'highlight').length})
            </button>
            <button
              onClick={() => setActiveFilterTab('definitions')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeFilterTab === 'definitions'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              📖 Definizioni ({draftCards.filter((c) => c.sourceType === 'definition' || c.sourceType === 'callout').length})
            </button>
            <button
              onClick={() => setActiveFilterTab('questions')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeFilterTab === 'questions'
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              ❓ Domande ({draftCards.filter((c) => c.sourceType === 'qa_inline' || c.sourceType === 'multiline' || c.sourceType === 'question_heading').length})
            </button>
            <button
              onClick={() => setActiveFilterTab('tables')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeFilterTab === 'tables'
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              📐 Formule & Schemi ({draftCards.filter((c) => c.sourceType === 'table' || c.sourceType === 'formula' || c.sourceType === 'enumeration').length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddManualCard}
              className="px-2.5 py-1 rounded-lg bg-[#1C212B] hover:bg-[#252B38] border border-[#272C36] text-[11px] text-[#F3F4F6] font-medium flex items-center gap-1 transition-colors"
              title="Aggiungi una nuova carta manuale all'elenco"
            >
              <Plus size={12} className="text-[#E5484D]" />
              <span>+ Aggiungi Carta</span>
            </button>
          </div>
        </div>

        {/* Cards Preview Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#272C36]/60 text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSelectAll(selectedCards.length !== draftCards.length)}
                className="flex items-center gap-1.5 text-[#9CA3AF] hover:text-[#F3F4F6] font-medium transition-colors"
              >
                {selectedCards.length === draftCards.length && draftCards.length > 0 ? (
                  <CheckSquare size={14} className="text-[#E5484D]" />
                ) : (
                  <Square size={14} />
                )}
                <span>
                  Selezionate {selectedCards.length} di {draftCards.length}
                </span>
              </button>
            </div>

            <div className="text-[11px] text-[#9CA3AF]">
              Tutte le carte sono modificabili in-place. LaTeX renderizzato in tempo reale.
            </div>
          </div>

          {isGenerating ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-[#9CA3AF]">
              <div className="w-10 h-10 rounded-2xl bg-[#E5484D]/15 text-[#E5484D] flex items-center justify-center animate-pulse">
                <Brain size={22} className="animate-spin" />
              </div>
              <p className="text-xs font-medium text-[#F3F4F6]">
                Analisi del testo e generazione flashcards in corso...
              </p>
              <p className="text-[11px] text-[#9CA3AF]">
                Estrazione concetti, sintesi rigorosa, formule matematiche e Active Recall
              </p>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#131720] border border-[#272C36] text-[#6B7280] flex items-center justify-center">
                <Layers size={20} />
              </div>
              <h3 className="text-xs font-semibold text-[#9CA3AF]">Nessuna flashcard in questa categoria</h3>
              <p className="text-[11px] text-[#6B7280] max-w-sm mx-auto">
                Clicca su <strong className="text-[#9CA3AF]">Tutte ({draftCards.length})</strong> oppure premi <strong className="text-[#9CA3AF]">+ Aggiungi Carta</strong> per inserirne una manualmente.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredCards.map((card, idx) => {
                const hasMath = card.front.includes('$') || card.back.includes('$');

                const badgeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
                  ai: { label: '✨ AI Smart', color: 'text-purple-400 bg-purple-500/10 border-purple-500/25', icon: <Sparkles size={11} /> },
                  cloze: { label: '🧩 Cloze', color: 'text-amber-400 bg-amber-500/10 border-amber-500/25', icon: <Hash size={11} /> },
                  highlight: { label: '🖍️ Evidenziato', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25', icon: <Zap size={11} /> },
                  qa_inline: { label: '⚡ Q :: A', color: 'text-blue-400 bg-blue-500/10 border-blue-500/25', icon: <Zap size={11} /> },
                  question_heading: { label: '❓ Domanda Sezione', color: 'text-sky-400 bg-sky-500/10 border-sky-500/25', icon: <HelpCircle size={11} /> },
                  definition: { label: '📖 Definizione', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', icon: <BookOpen size={11} /> },
                  callout: { label: '📌 Callout', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/25', icon: <AlertCircle size={11} /> },
                  table: { label: '📊 Tabella', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/25', icon: <TableIcon size={11} /> },
                  formula: { label: '📐 Formula', color: 'text-rose-400 bg-rose-500/10 border-rose-500/25', icon: <Sparkles size={11} /> },
                  enumeration: { label: '📝 Elenco', color: 'text-teal-400 bg-teal-500/10 border-teal-500/25', icon: <FileText size={11} /> },
                  multiline: { label: '📝 Multilinea', color: 'text-gray-400 bg-gray-500/10 border-gray-500/25', icon: <FileText size={11} /> },
                };

                const currentBadge = badgeConfig[card.sourceType] || badgeConfig.multiline;

                return (
                  <div
                    key={card.id}
                    className={`rounded-xl border p-4 transition-all duration-150 ${
                      card.selected
                        ? 'bg-[#171B22] border-[#272C36] hover:border-[#383F4D]'
                        : 'bg-[#131720]/60 border-[#272C36]/40 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#272C36]/50">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleCard(card.id)}
                          className="text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
                        >
                          {card.selected ? (
                            <CheckSquare size={16} className="text-[#E5484D]" />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <span className="text-xs font-bold text-[#9CA3AF]">#{idx + 1}</span>

                        {/* Source Type Badge */}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${currentBadge.color}`}
                        >
                          {currentBadge.icon}
                          <span>{currentBadge.label}</span>
                        </span>

                        {card.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-[#9CA3AF]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => handleDeleteDraft(card.id)}
                        className="p-1 rounded text-[#6B7280] hover:text-[#E5484D] hover:bg-[#E5484D]/15 transition-colors"
                        title="Elimina questa proposta"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* Front (Domanda) */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-[#9CA3AF] tracking-wider flex items-center justify-between">
                          <span>Fronte (Domanda / Prompt):</span>
                        </label>
                        <textarea
                          rows={2}
                          value={card.front}
                          onChange={(e) => handleUpdateFront(card.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#11141C] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none resize-none leading-relaxed"
                        />
                        {hasMath && card.front.includes('$') && (
                          <div className="text-[11px] text-[#9CA3AF] p-1.5 rounded bg-black/25">
                            {renderMathSnippet(card.front)}
                          </div>
                        )}
                      </div>

                      {/* Back (Risposta) */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-[#9CA3AF] tracking-wider flex items-center justify-between">
                          <span>Retro (Risposta):</span>
                        </label>
                        <textarea
                          rows={2}
                          value={card.back}
                          onChange={(e) => handleUpdateBack(card.id, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#11141C] border border-[#272C36] text-xs text-[#F3F4F6] focus:border-[#E5484D] outline-none resize-none leading-relaxed"
                        />
                        {hasMath && card.back.includes('$') && (
                          <div className="text-[11px] text-[#9CA3AF] p-1.5 rounded bg-black/25">
                            {renderMathSnippet(card.back)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="px-6 py-4 border-t border-[#272C36] bg-[#131720] flex items-center justify-between gap-3 text-xs">
          <div className="text-[11px] text-[#9CA3AF]">
            Mazzo selezionato: <strong className="text-[#F3F4F6]">{targetDeck}</strong>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={closeAutoFlashcardModal}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-[#1C212B] transition-colors"
            >
              Annulla
            </button>
            <button
              onClick={() => handleSaveBatch(false)}
              disabled={selectedCards.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#E5484D] hover:bg-[#F05D62] transition-all shadow-subtle disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>Salva {selectedCards.length} Flashcard</span>
            </button>
            <button
              onClick={() => handleSaveBatch(true)}
              disabled={selectedCards.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 transition-all shadow-subtle disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              title="Salva e avvia immediatamente la sessione di studio SM-2"
            >
              <Play size={13} fill="currentColor" />
              <span>Salva e Ripassa Subito</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
