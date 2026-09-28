import React from 'react';
import { useVaultStore } from '../store/useVaultStore';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Hash,
  Clock,
  FileText,
  ChevronRight,
  ChevronLeft,
  Link2,
} from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { notes, activeNotePath, isInspectorOpen, toggleInspector, navigateToWikiLink } =
    useVaultStore();

  const currentNote = React.useMemo(() => {
    return notes.find((n) => n.path === activeNotePath) || null;
  }, [notes, activeNotePath]);

  if (!currentNote) {
    return null;
  }

  const wordCount = currentNote.content.trim() ? currentNote.content.trim().split(/\s+/).length : 0;
  const charCount = currentNote.content.length;

  return (
    <>
      {/* Floating Trigger Pill (Visible when panel is compressed towards the right) */}
      {!isInspectorOpen && (
        <button
          onClick={toggleInspector}
          className="absolute bottom-4 right-4 z-30 flex items-center space-x-2 px-3 py-1.5 rounded-full backdrop-blur-xl bg-[var(--panel-bg)]/90 dark:bg-[var(--panel-bg)]/90 border border-black/10 dark:border-white/15 shadow-apple-md hover:shadow-apple-lg text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-all duration-300 ease-out group hover:scale-[1.03] active:scale-[0.98]"
          title="Espandi Connessioni & Info (Backlinks)"
        >
          <div className="flex items-center space-x-1.5 text-[var(--accent)]">
            <Link2 size={13} />
            <span className="font-semibold text-[11px]">{currentNote.backlinks.length}</span>
          </div>
          <span className="w-px h-3 bg-black/10 dark:bg-white/15" />
          <span className="text-[11px]">Connessioni</span>
          <ChevronLeft
            size={13}
            className="text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-transform group-hover:-translate-x-0.5"
          />
        </button>
      )}

      {/* Floating Card Inspector (Compresses smoothly towards the right edge of the screen) */}
      <div
        className={`absolute bottom-4 right-4 z-40 w-80 h-[460px] max-h-[calc(100vh-100px)] flex flex-col rounded-2xl apple-card-item backdrop-blur-2xl bg-[var(--panel-bg)]/95 dark:bg-[var(--panel-bg)]/92 border border-black/10 dark:border-white/15 shadow-2xl shadow-black/25 dark:shadow-black/60 select-none overflow-hidden transition-all duration-300 cubic-bezier(0.16, 1, 0.3, 1) ${
          isInspectorOpen
            ? 'translate-x-0 opacity-100 scale-100 pointer-events-auto'
            : 'translate-x-[calc(100%+24px)] opacity-0 scale-95 pointer-events-none'
        }`}
      >
        {/* Floating Card Header */}
        <div className="px-3.5 py-2.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-semibold text-[var(--text-primary)]">
              Connessioni & Info
            </h3>
            <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded-full bg-black/5 dark:bg-white/5 font-mono">
              {wordCount} parole
            </span>
          </div>

          {/* Compress / Hide button towards the right */}
          <button
            onClick={toggleInspector}
            className="flex items-center space-x-1 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors group text-[11px]"
            title="Comprimi verso destra"
          >
            <span className="text-[10px] text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
              Comprimi
            </span>
            <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 custom-scrollbar">
          {/* Backlinks Section */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[var(--accent-blue)] mb-2">
              <ArrowDownLeft size={14} />
              <span>Backlinks ({currentNote.backlinks.length})</span>
            </div>

            {currentNote.backlinks.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] italic p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                Nessun'altra nota collega questo appunto. Usa <span className="font-mono text-[var(--accent)]">[[{currentNote.title}]]</span> altrove per collegarlo.
              </p>
            ) : (
              <div className="space-y-1">
                {currentNote.backlinks.map((target) => (
                  <button
                    key={target}
                    onClick={() => navigateToWikiLink(target)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-left text-xs bg-black/5 dark:bg-white/5 hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] transition-colors group"
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <FileText size={13} className="text-[var(--accent-blue)] shrink-0" />
                      <span className="truncate font-medium">{target}</span>
                    </div>
                    <ChevronRight size={12} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Outlinks Section */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-[var(--accent)] mb-2">
              <ArrowUpRight size={14} />
              <span>Collegamenti Uscenti ({currentNote.outlinks.length})</span>
            </div>

            {currentNote.outlinks.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] italic p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
                Nessun link <span className="font-mono text-[var(--accent)]">[[WikiLink]]</span> presente in questa nota.
              </p>
            ) : (
              <div className="space-y-1">
                {currentNote.outlinks.map((link) => (
                  <button
                    key={link}
                    onClick={() => navigateToWikiLink(link)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-left text-xs bg-black/5 dark:bg-white/5 hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] transition-colors group"
                  >
                    <div className="flex items-center space-x-1.5 truncate">
                      <span className="text-[var(--accent)] font-mono text-[11px]">[[</span>
                      <span className="truncate font-medium">{link}</span>
                      <span className="text-[var(--accent)] font-mono text-[11px]">]]</span>
                    </div>
                    <ChevronRight size={12} className="text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tags Section */}
          {currentNote.tags.length > 0 && (
            <div>
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-[var(--text-primary)] mb-2">
                <Hash size={14} className="text-[var(--accent)]" />
                <span>Tag</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentNote.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[11px] bg-black/5 dark:bg-white/10 text-[var(--text-secondary)] font-mono font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Note Metrics & Metadata */}
          <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-1.5 text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Clock size={12} />
                <span>Ultima modifica:</span>
              </span>
              <span className="font-mono text-[var(--text-secondary)]">
                {new Date(currentNote.updated_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span>Caratteri:</span>
              <span className="font-mono text-[var(--text-secondary)]">{charCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <span>Percorso:</span>
              <span className="font-mono text-[var(--text-secondary)] truncate max-w-[140px]" title={currentNote.rel_path}>
                {currentNote.rel_path}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
