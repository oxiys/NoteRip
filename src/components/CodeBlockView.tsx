import React, { useState } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import { Play, Copy, Check, Terminal, Clock, AlertTriangle, Edit3, XCircle } from 'lucide-react';
import { tauriBridge } from '../services/tauriBridge';
import type { CodeRunResult } from '../types';
import { MermaidRenderer } from './MermaidRenderer';

interface CodeBlockViewProps {
  lang: string;
  code: string;
  onEdit?: () => void;
}

export const CodeBlockView: React.FC<CodeBlockViewProps> = ({ lang, code, onEdit }) => {
  const [copied, setCopied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<CodeRunResult | null>(null);
  const [showOutput, setShowOutput] = useState(false);

  const cleanLang = (lang || 'code').trim().toLowerCase();

  // If Mermaid diagram block, delegate to MermaidRenderer
  if (cleanLang === 'mermaid') {
    return (
      <div className="relative group my-3">
        <MermaidRenderer code={code} />
        {onEdit && (
          <button
            onClick={onEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-24 text-[10px] bg-theme-bg/90 hover:bg-theme-bg border border-theme-border text-theme-text px-2 py-0.5 rounded shadow-sm flex items-center gap-1 z-10"
            title="Modifica codice sorgente del diagramma Mermaid"
          >
            <Edit3 size={11} />
            <span>Modifica Diagramma</span>
          </button>
        )}
      </div>
    );
  }

  const isExecutable = cleanLang === 'c' || cleanLang === 'cpp' || cleanLang === 'java';

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setShowOutput(true);
    try {
      const res = await tauriBridge.runCode(cleanLang, code);
      setRunResult(res);
    } catch (err: unknown) {
      setRunResult({
        success: false,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        exit_code: 1,
        execution_time_ms: 0,
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Syntax highlight with Prism
  const highlightedCode = React.useMemo(() => {
    const grammarLang = cleanLang === 'c' ? 'c' : cleanLang === 'java' ? 'java' : cleanLang === 'cpp' ? 'cpp' : cleanLang;
    const grammar = Prism.languages[grammarLang];
    if (grammar) {
      try {
        return Prism.highlight(code, grammar, grammarLang);
      } catch {
        return escapeHtml(code);
      }
    }
    return escapeHtml(code);
  }, [code, cleanLang]);

  const lines = code.split('\n');

  return (
    <div className="my-3 rounded-2xl border border-theme-border/60 bg-[#181825] dark:bg-[#181825] text-[#cdd6f4] overflow-hidden text-xs font-mono shadow-sm group transition-all">
      {/* Code Header Bar */}
      <div className="px-3.5 py-1.5 bg-[#11111b] text-[11px] text-[#a6adc8] flex justify-between items-center border-b border-[#313244] select-none">
        <div className="flex items-center space-x-2">
          {/* Language badge */}
          <span className="flex items-center gap-1.5 font-semibold text-xs text-[#cba6f7] uppercase tracking-wider">
            {cleanLang === 'c' && <span className="text-[#89dceb] font-bold">C</span>}
            {cleanLang === 'java' && <span className="text-[#fab387] font-bold">Java ☕</span>}
            {cleanLang !== 'c' && cleanLang !== 'java' && cleanLang}
          </span>
          <span className="text-[10px] text-[#6c7086]">({lines.length} {lines.length === 1 ? 'linea' : 'linee'})</span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Run button for C and Java */}
          {isExecutable && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
                isRunning
                  ? 'bg-[#fab387]/20 text-[#fab387] cursor-wait'
                  : 'bg-[#a6e3a1]/20 hover:bg-[#a6e3a1]/30 text-[#a6e3a1] active:scale-95'
              }`}
              title={cleanLang === 'c' ? 'Compila ed esegui programma C con GCC / Clang' : 'Compila ed esegui classe Java con Javac'}
            >
              <Play size={11} className={isRunning ? 'animate-spin' : 'fill-current'} />
              <span>{isRunning ? 'Esecuzione...' : 'Esegui'}</span>
            </button>
          )}

          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244] rounded transition-colors"
              title="Modifica codice sorgente"
            >
              <Edit3 size={13} />
            </button>
          )}

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244] rounded transition-colors"
            title="Copia codice negli appunti"
          >
            {copied ? <Check size={13} className="text-[#a6e3a1]" /> : <Copy size={13} />}
            <span className="text-[10px]">{copied ? 'Copiato' : 'Copia'}</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body with Line Numbers */}
      <div className="p-3.5 overflow-x-auto flex text-xs leading-relaxed bg-[#1e1e2e]">
        {/* Line numbers gutter */}
        <div className="select-none text-[#585b70] text-right pr-3.5 border-r border-[#313244] font-mono shrink-0">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        {/* Highlighted code */}
        <pre className="pl-3.5 overflow-x-auto flex-1 font-mono m-0">
          <code
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
            className={`language-${cleanLang}`}
          />
        </pre>
      </div>

      {/* Output Console / Drawer */}
      {showOutput && (
        <div className="border-t border-[#313244] bg-[#11111b] p-3 text-xs font-mono">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#313244]/60 text-[11px] text-[#a6adc8]">
            <div className="flex items-center gap-2">
              <Terminal size={12} className="text-[#cba6f7]" />
              <span className="font-semibold text-[#cdd6f4]">Terminale di Output</span>
              {runResult && (
                <>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                      runResult.success
                        ? 'bg-[#a6e3a1]/20 text-[#a6e3a1]'
                        : 'bg-[#f38ba8]/20 text-[#f38ba8]'
                    }`}
                  >
                    Exit Code: {runResult.exit_code ?? (runResult.success ? 0 : 1)}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[#6c7086]">
                    <Clock size={10} />
                    {runResult.execution_time_ms} ms
                  </span>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setShowOutput(false);
                setRunResult(null);
              }}
              className="text-[#6c7086] hover:text-[#cdd6f4] p-0.5 rounded transition-colors"
              title="Chiudi output"
            >
              <XCircle size={13} />
            </button>
          </div>

          {isRunning && (
            <div className="py-2 flex items-center gap-2 text-[#fab387] animate-pulse">
              <span className="inline-block w-2 h-2 rounded-full bg-[#fab387] animate-ping" />
              <span>Compilazione ed esecuzione in corso con {cleanLang === 'c' ? 'GCC / Clang' : 'JDK'}...</span>
            </div>
          )}

          {runResult && (
            <div className="space-y-2">
              {runResult.stdout && (
                <div>
                  <div className="text-[10px] text-[#a6adc8] mb-0.5 uppercase tracking-wide">Output (stdout):</div>
                  <pre className="p-2 rounded bg-[#181825] border border-[#313244] text-[#a6e3a1] overflow-x-auto whitespace-pre-wrap">
                    {runResult.stdout}
                  </pre>
                </div>
              )}

              {runResult.stderr && (
                <div>
                  <div className="flex items-center gap-1 text-[10px] text-[#f38ba8] mb-0.5 uppercase tracking-wide">
                    <AlertTriangle size={11} />
                    <span>Errori / Avvisi di compilazione (stderr):</span>
                  </div>
                  <pre className="p-2 rounded bg-[#f38ba8]/10 border border-[#f38ba8]/30 text-[#f38ba8] overflow-x-auto whitespace-pre-wrap">
                    {runResult.stderr}
                  </pre>
                </div>
              )}

              {!runResult.stdout && !runResult.stderr && (
                <div className="text-[#6c7086] italic text-[11px]">
                  Programma terminato senza output su stdout/stderr.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
