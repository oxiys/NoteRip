import React, { useMemo } from 'react';
import { parseDataviewQuery, executeDataview } from '../services/dataview';
import { useVaultStore } from '../store/useVaultStore';
import { Database, FileText, CheckSquare, Square } from 'lucide-react';

interface DataviewRendererProps {
  queryText: string;
}

export const DataviewRenderer: React.FC<DataviewRendererProps> = ({ queryText }) => {
  const { notes, selectNote } = useVaultStore();

  const { query, rows, error } = useMemo(() => {
    try {
      const q = parseDataviewQuery(queryText);
      const r = executeDataview(q, notes);
      return { query: q, rows: r, error: null };
    } catch (e: unknown) {
      return { query: null, rows: [], error: String(e) };
    }
  }, [queryText, notes]);

  const taskItems = useMemo(() => {
    if (!query || query.type !== 'TASK') return [];
    const list: Array<{ notePath: string; noteTitle: string; text: string; completed: boolean }> = [];
    rows.forEach(({ note }) => {
      const lines = note.content.split('\n');
      lines.forEach((line) => {
        const unchecked = line.match(/^[-*]\s+\[\s\]\s+(.+)$/);
        const checked = line.match(/^[-*]\s+\[[xX]\]\s+(.+)$/);
        if (unchecked) {
          list.push({ notePath: note.path, noteTitle: note.title, text: unchecked[1], completed: false });
        } else if (checked) {
          list.push({ notePath: note.path, noteTitle: note.title, text: checked[1], completed: true });
        }
      });
    });
    return list;
  }, [query, rows]);

  if (error || !query) {
    return (
      <div className="my-3 p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs font-mono">
        <p className="font-semibold">Errore Dataview Query:</p>
        <p className="text-[11px] mt-1">{error || 'Sintassi non riconosciuta'}</p>
      </div>
    );
  }

  return (
    <div className="my-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden shadow-apple-sm">
      {/* Dataview Header Badge */}
      <div className="px-3 py-1.5 border-b border-black/5 dark:border-white/10 flex items-center justify-between bg-black/[0.03] dark:bg-white/[0.03]">
        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
          <Database size={13} className="text-amber-500" />
          <span>DATAVIEW {query.type}</span>
        </div>
        <span className="text-[10px] text-neutral-400 font-mono">
          {query.type === 'TASK' ? taskItems.length : rows.length} risultati
        </span>
      </div>

      {/* Render Table */}
      {query.type === 'TABLE' && (
        <div className="overflow-x-auto">
          {rows.length === 0 ? (
            <div className="p-4 text-center text-xs text-neutral-400">
              Nessun appunto corrisponde alla query Dataview.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-neutral-500 dark:text-neutral-400 text-[11px]">
                  <th className="py-2 px-3 font-semibold">Nota</th>
                  {query.columns.map((col) => (
                    <th key={col.key} className="py-2 px-3 font-semibold">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {rows.map(({ note, values }) => (
                  <tr
                    key={note.path}
                    className="hover:bg-amber-500/5 dark:hover:bg-amber-400/5 transition-colors group"
                  >
                    <td className="py-2 px-3 font-medium">
                      <button
                        onClick={() => selectNote(note.path)}
                        className="flex items-center space-x-1.5 text-neutral-800 dark:text-neutral-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
                      >
                        <FileText size={13} className="text-amber-500/70 shrink-0" />
                        <span className="truncate">{note.title}</span>
                      </button>
                    </td>
                    {query.columns.map((col) => {
                      const val = values[col.key];
                      return (
                        <td key={col.key} className="py-2 px-3 text-neutral-600 dark:text-neutral-300">
                          {Array.isArray(val) ? (
                            <div className="flex flex-wrap gap-1">
                              {val.map((t) => (
                                <span
                                  key={t}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-black/5 dark:bg-white/10"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          ) : (
                            String(val ?? '-')
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Render List */}
      {query.type === 'LIST' && (
        <div className="p-3 space-y-1.5">
          {rows.length === 0 ? (
            <div className="text-center text-xs text-neutral-400">Nessun appunto trovato.</div>
          ) : (
            rows.map(({ note }) => (
              <div key={note.path} className="flex items-center space-x-2 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <button
                  onClick={() => selectNote(note.path)}
                  className="font-medium text-neutral-800 dark:text-neutral-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors truncate"
                >
                  {note.title}
                </button>
                {note.folder && (
                  <span className="text-[10px] text-neutral-400 font-mono">({note.folder})</span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Render Tasks */}
      {query.type === 'TASK' && (
        <div className="p-3 space-y-2">
          {taskItems.length === 0 ? (
            <div className="text-center text-xs text-neutral-400">Nessun task attivo.</div>
          ) : (
            taskItems.map((task, idx) => (
              <div key={idx} className="flex items-start space-x-2 text-xs">
                {task.completed ? (
                  <CheckSquare size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Square size={14} className="text-neutral-400 shrink-0 mt-0.5" />
                )}
                <span
                  className={task.completed ? 'line-through text-neutral-400' : 'text-neutral-800 dark:text-neutral-200'}
                >
                  {task.text}
                </span>
                <button
                  onClick={() => selectNote(task.notePath)}
                  className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline shrink-0 ml-auto"
                >
                  [{task.noteTitle}]
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
