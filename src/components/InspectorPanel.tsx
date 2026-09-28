import React from 'react';
import { useVaultStore } from '../store/useVaultStore';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Hash,
  Clock,
  FileText,
  ChevronRight,
  X,
  BookOpen,
  Folder,
} from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const { notes, activeNotePath, isInspectorOpen, toggleInspector, navigateToWikiLink, setSelectedTag } =
    useVaultStore();

  const currentNote = React.useMemo(() => {
    if (!activeNotePath) return null;
    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    const normalizedActive = norm(activeNotePath);
    return notes.find((n) => norm(n.path) === normalizedActive) || null;
  }, [notes, activeNotePath]);

  if (!isInspectorOpen) {
    return null;
  }

  if (!currentNote) {
    return (
      <aside className="w-72 md:w-80 h-full bg-[#131720] border-l border-[#272C36] flex flex-col shrink-0 select-none p-4 text-xs text-[#9CA3AF]">
        <div className="flex items-center justify-between pb-3 border-b border-[#272C36]">
          <span className="font-semibold text-[#F3F4F6]">Proprietà</span>
          <button
            onClick={toggleInspector}
            className="p-1 rounded-lg hover:bg-[#171B22] hover:text-[#F3F4F6] text-[#6B7280] transition-colors"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="py-8 text-center text-[#6B7280]">
          Seleziona una nota per visualizzarne proprietà, backlinks e metadati.
        </div>
      </aside>
    );
  }

  const backlinks = currentNote.backlinks || [];
  const outlinks = currentNote.outlinks || [];
  const tags = currentNote.tags || [];
  const noteContent = currentNote.content || '';
  const wordCount = noteContent.trim() ? noteContent.trim().split(/\s+/).length : 0;
  const charCount = noteContent.length;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <aside className="w-72 md:w-80 h-full bg-[#131720] border-l border-[#272C36] flex flex-col shrink-0 select-none overflow-hidden transition-all duration-200">
      {/* Header */}
      <div className="h-14 px-4 border-b border-[#272C36] flex items-center justify-between shrink-0 bg-[#0E1116]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#F3F4F6]">Proprietà Nota</span>
          <span className="text-[10px] font-mono text-[#9CA3AF] px-1.5 py-0.5 rounded-md bg-[#171B22] border border-[#272C36]">
            {wordCount} parole
          </span>
        </div>

        <button
          onClick={toggleInspector}
          className="p-1.5 rounded-lg border border-transparent hover:border-[#272C36] hover:bg-[#171B22] text-[#9CA3AF] hover:text-[#F3F4F6] transition-colors"
          title="Chiudi pannello proprietà"
        >
          <X size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Metadata Properties */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
            Metadati
          </div>

          <div className="bg-[#171B22] border border-[#272C36] rounded-xl p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="flex items-center gap-1.5">
                <Clock size={13} strokeWidth={1.5} className="text-[#6B7280]" />
                <span>Modificata</span>
              </span>
              <span className="font-mono text-[#F3F4F6] text-[11px]">
                {new Date(currentNote.updated_at * 1000).toLocaleString('it-IT', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="flex items-center gap-1.5">
                <BookOpen size={13} strokeWidth={1.5} className="text-[#6B7280]" />
                <span>Tempo lettura</span>
              </span>
              <span className="font-mono text-[#F3F4F6] text-[11px]">~{readingTimeMin} min</span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="flex items-center gap-1.5">
                <FileText size={13} strokeWidth={1.5} className="text-[#6B7280]" />
                <span>Caratteri</span>
              </span>
              <span className="font-mono text-[#F3F4F6] text-[11px]">{charCount}</span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF] pt-1 border-t border-[#272C36]">
              <span className="flex items-center gap-1.5">
                <Folder size={13} strokeWidth={1.5} className="text-[#6B7280]" />
                <span>Cartella</span>
              </span>
              <span className="font-mono text-[#F3F4F6] text-[11px] truncate max-w-[140px]" title={currentNote.folder}>
                {currentNote.folder || 'Vault Root'}
              </span>
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
            <span className="flex items-center gap-1">
              <Hash size={12} strokeWidth={1.5} />
              <span>Tag ({tags.length})</span>
            </span>
          </div>

          {tags.length === 0 ? (
            <div className="bg-[#171B22] border border-[#272C36] rounded-xl p-3 text-xs text-[#6B7280] italic">
              Nessun tag inserito. Digita <span className="font-mono text-[#E5484D]">#nome_tag</span> nella nota.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className="px-2.5 py-1 rounded-xl bg-[#171B22] hover:bg-[#1C212B] border border-[#272C36] hover:border-[#E5484D] text-[#9CA3AF] hover:text-[#F3F4F6] text-xs font-mono transition-colors flex items-center gap-1 group"
                  title={`Filtra note con #${tag}`}
                >
                  <span className="text-[#E5484D]">#</span>
                  <span>{tag}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Backlinks Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
            <span className="flex items-center gap-1">
              <ArrowDownLeft size={12} strokeWidth={1.5} />
              <span>Backlinks ({backlinks.length})</span>
            </span>
          </div>

          {backlinks.length === 0 ? (
            <div className="bg-[#171B22] border border-[#272C36] rounded-xl p-3 text-xs text-[#6B7280] italic">
              Nessun'altra nota fa riferimento a questo appunto. Usa <span className="font-mono text-[#E5484D]">[[{currentNote.title}]]</span> altrove per collegarlo.
            </div>
          ) : (
            <div className="space-y-1">
              {backlinks.map((target) => (
                <button
                  key={target}
                  onClick={() => navigateToWikiLink(target)}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-left text-xs bg-[#171B22] hover:bg-[#1C212B] border border-[#272C36] hover:border-[#3A4150] text-[#F3F4F6] transition-colors group"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={13} strokeWidth={1.5} className="text-[#9CA3AF] group-hover:text-[#E5484D] shrink-0" />
                    <span className="truncate font-medium">{target}</span>
                  </div>
                  <ChevronRight size={13} strokeWidth={1.5} className="text-[#6B7280] group-hover:text-[#F3F4F6] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Outlinks Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase">
            <span className="flex items-center gap-1">
              <ArrowUpRight size={12} strokeWidth={1.5} />
              <span>Collegamenti Uscenti ({outlinks.length})</span>
            </span>
          </div>

          {outlinks.length === 0 ? (
            <div className="bg-[#171B22] border border-[#272C36] rounded-xl p-3 text-xs text-[#6B7280] italic">
              Nessun collegamento <span className="font-mono text-[#E5484D]">[[WikiLink]]</span> presente.
            </div>
          ) : (
            <div className="space-y-1">
              {outlinks.map((link) => (
                <button
                  key={link}
                  onClick={() => navigateToWikiLink(link)}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-left text-xs bg-[#171B22] hover:bg-[#1C212B] border border-[#272C36] hover:border-[#3A4150] text-[#F3F4F6] transition-colors group"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[#E5484D] font-mono text-[11px]">[[</span>
                    <span className="truncate font-medium">{link}</span>
                    <span className="text-[#E5484D] font-mono text-[11px]">]]</span>
                  </div>
                  <ChevronRight size={13} strokeWidth={1.5} className="text-[#6B7280] group-hover:text-[#F3F4F6] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
