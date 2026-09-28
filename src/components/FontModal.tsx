import React, { useState, useEffect } from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { Type, X, Check, RefreshCw, Sliders } from 'lucide-react';

const COMMON_FONTS = [
  { group: 'Predefiniti Sistema', fonts: ['', 'Segoe UI', 'Aptos', 'Inter', 'SF Pro Text', 'Arial', 'Calibri', 'Roboto'] },
  { group: 'Monospazio / Codice', fonts: ['Consolas', 'Cascadia Code', 'Courier New', 'Fira Code', 'JetBrains Mono', 'Menlo'] },
  { group: 'Con Grazie (Serif)', fonts: ['Georgia', 'Times New Roman', 'Cambria', 'Garamond', 'Palatino Linotype'] },
];

export const FontModal: React.FC = () => {
  const {
    isFontModalOpen,
    toggleFontModal,
    appFont,
    editorFont,
    fontSize,
    setAppFont,
    setEditorFont,
    setFontSize,
  } = useVaultStore();

  const [activeTab, setActiveTab] = useState<'app' | 'editor'>('editor');
  const [customInput, setCustomInput] = useState('');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Attempt to query locally installed fonts via window.queryLocalFonts() if available (Chromium / WebView2)
  const handleQueryLocalFonts = async () => {
    if ('queryLocalFonts' in window) {
      try {
        setIsQuerying(true);
        setQueryError(null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const availableFonts = await (window as any).queryLocalFonts();
        const set = new Set<string>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        availableFonts.forEach((f: any) => {
          if (f && f.family) set.add(f.family);
        });
        const list = Array.from(set).sort((a, b) => a.localeCompare(b));
        setSystemFonts(list);
      } catch (err) {
        setQueryError('Permesso non concesso o API non disponibile per leggere tutti i font.');
      } finally {
        setIsQuerying(false);
      }
    } else {
      setQueryError('API queryLocalFonts non supportata in questo ambiente WebView.');
    }
  };

  useEffect(() => {
    if (isFontModalOpen) {
      setCustomInput(activeTab === 'app' ? appFont : editorFont);
      if ('queryLocalFonts' in window && systemFonts.length === 0) {
        handleQueryLocalFonts();
      }
    }
  }, [isFontModalOpen, activeTab, appFont, editorFont]);

  if (!isFontModalOpen) return null;

  const currentSelection = activeTab === 'app' ? appFont : editorFont;

  const handleApplyFont = (fontName: string) => {
    if (activeTab === 'app') {
      setAppFont(fontName);
    } else {
      setEditorFont(fontName);
    }
  };

  return (
    <div
      onClick={toggleFontModal}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl apple-card-item shadow-2xl border border-black/15 dark:border-white/15 overflow-hidden flex flex-col bg-[var(--card-bg)] text-[var(--text-primary)] transition-all animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Type size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Tipografia & Font di Sistema</h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Personalizza i caratteri installati sul tuo PC per l&apos;interfaccia e per le note
              </p>
            </div>
          </div>
          <button
            onClick={toggleFontModal}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher: Editor vs UI */}
        <div className="flex border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-5 pt-3">
          <button
            onClick={() => setActiveTab('editor')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'editor'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders size={13} />
            <span>Font Editor di Scrittura</span>
          </button>
          <button
            onClick={() => setActiveTab('app')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center space-x-1.5 ${
              activeTab === 'app'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Type size={13} />
            <span>Font Interfaccia App</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 max-h-[460px] overflow-y-auto">
          {/* Custom Font Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between">
              <span>Inserisci nome font installato:</span>
              <span className="text-[10px] text-[var(--text-muted)] font-normal">
                es. Aptos, Fira Code, Comic Sans MS
              </span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="Nome font..."
                className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <button
                onClick={() => handleApplyFont(customInput)}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white text-xs font-medium transition-all shadow-apple-sm"
              >
                Applica
              </button>
              <button
                onClick={() => {
                  setCustomInput('');
                  handleApplyFont('');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-black/5 dark:bg-white/10 hover:bg-black/10 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="Ripristina predefinito"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Font Size Selector (for editor) */}
          {activeTab === 'editor' && (
            <div className="flex items-center justify-between py-2 border-y border-black/5 dark:border-white/5">
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                Dimensione Testo Editor:
              </span>
              <div className="flex items-center space-x-1">
                {[12, 13, 14, 15, 16, 18].map((size) => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-all ${
                      fontSize === size
                        ? 'bg-[var(--accent)] text-white font-bold'
                        : 'bg-black/5 dark:bg-white/5 text-[var(--text-secondary)] hover:bg-black/10'
                    }`}
                  >
                    {size}px
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Choice Common Fonts */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Font Consigliati
            </span>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_FONTS.flatMap((group) => group.fonts).map((font) => {
                const label = font === '' ? 'Default di Sistema' : font;
                const isSelected = currentSelection === font;
                return (
                  <button
                    key={font || '__default'}
                    onClick={() => {
                      setCustomInput(font);
                      handleApplyFont(font);
                    }}
                    style={{ fontFamily: font || 'inherit' }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] shadow-apple-sm'
                        : 'border-black/5 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-black/[0.02] dark:bg-white/[0.02]'
                    }`}
                  >
                    <span className="text-xs font-medium truncate">{label}</span>
                    {isSelected && <Check size={14} className="shrink-0 text-[var(--accent)] ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* System Detected Fonts List if queryLocalFonts worked */}
          {systemFonts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-black/5 dark:border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                  Font Rilevati nel Sistema ({systemFonts.length})
                </span>
                <button
                  onClick={handleQueryLocalFonts}
                  disabled={isQuerying}
                  className="text-[10px] text-[var(--accent)] flex items-center gap-1 hover:underline"
                >
                  <RefreshCw size={10} className={isQuerying ? 'animate-spin' : ''} />
                  <span>Riscansiona</span>
                </button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/10">
                {systemFonts.slice(0, 100).map((sf) => (
                  <button
                    key={sf}
                    onClick={() => {
                      setCustomInput(sf);
                      handleApplyFont(sf);
                    }}
                    style={{ fontFamily: sf }}
                    className={`w-full text-left px-2 py-1 rounded text-xs truncate flex items-center justify-between hover:bg-black/10 dark:hover:bg-white/10 ${
                      currentSelection === sf ? 'text-[var(--accent)] font-bold' : ''
                    }`}
                  >
                    <span className="truncate">{sf}</span>
                    {currentSelection === sf && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {queryError && (
            <p className="text-[11px] text-[var(--text-muted)] italic">{queryError}</p>
          )}

          {/* Live Preview Box */}
          <div className="p-3.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.03] space-y-1 select-text">
            <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider block">
              Anteprima Live del Font ({currentSelection || 'Predefinito'})
            </span>
            <p
              style={{
                fontFamily: currentSelection || 'inherit',
                fontSize: activeTab === 'editor' ? `${fontSize}px` : '13px',
              }}
              className="text-neutral-800 dark:text-neutral-200 leading-relaxed"
            >
              NoteRip: studio universitario con formule $E = mc^2$, diagrammi e gestione della memoria in C.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs">
          <span className="text-[11px] text-[var(--text-muted)]">
            I font selezionati vengono salvati permanentemente nel tuo profilo.
          </span>
          <button
            onClick={toggleFontModal}
            className="px-4 py-1.5 rounded-lg bg-[var(--accent)] hover:opacity-90 text-white font-medium shadow-apple-sm transition-all"
          >
            Fatto
          </button>
        </div>
      </div>
    </div>
  );
};
