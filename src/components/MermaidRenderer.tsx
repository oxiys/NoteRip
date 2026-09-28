import React, { useEffect, useState, useRef, memo } from 'react';
import { AlertCircle, Check, Copy, Maximize2 } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';

export interface MermaidRendererProps {
  code: string;
}

// Dynamic import of mermaid to avoid loading 10MB+ of AST parsers and ELK/Cytoscape into memory on boot
let mermaidInstance: typeof import('mermaid').default | null = null;
let mermaidLoadingPromise: Promise<typeof import('mermaid').default> | null = null;

async function getMermaidInstance(): Promise<typeof import('mermaid').default> {
  if (mermaidInstance) return mermaidInstance;
  if (!mermaidLoadingPromise) {
    mermaidLoadingPromise = import('mermaid').then((m) => {
      mermaidInstance = m.default;
      return mermaidInstance;
    });
  }
  return mermaidLoadingPromise;
}

// Module-level SVG cache to eliminate flickering between re-renders and view changes
const svgCache = new Map<string, string>();
let containerCounter = 0;

let isMermaidConfiguredForTheme = '';

async function configureMermaid(isDark: boolean) {
  const currentKey = isDark ? 'dark' : 'light';
  if (isMermaidConfiguredForTheme === currentKey) return;
  isMermaidConfiguredForTheme = currentKey;

  const mermaid = await getMermaidInstance();

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    suppressErrorRendering: true,
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    theme: isDark ? 'dark' : 'default',
    themeVariables: isDark
      ? {
          darkMode: true,
          background: 'transparent',
          primaryColor: '#cba6f7',
          primaryTextColor: '#cdd6f4',
          primaryBorderColor: '#89b4fa',
          lineColor: '#b4befe',
          secondaryColor: '#313244',
          tertiaryColor: '#181825',
          nodeBorder: '#cba6f7',
          mainBkg: '#1e1e2e',
          clusterBkg: '#181825',
          titleColor: '#f5e0dc',
          edgeLabelBackground: '#313244',
          actorBkg: '#1e1e2e',
          actorBorder: '#cba6f7',
          actorTextColor: '#cdd6f4',
          actorLineColor: '#89b4fa',
          signalColor: '#89b4fa',
          signalTextColor: '#cdd6f4',
          labelBoxBkgColor: '#181825',
          labelTextColor: '#cdd6f4',
          loopTextColor: '#cdd6f4',
          noteBkgColor: '#313244',
          noteTextColor: '#cdd6f4',
        }
      : {
          darkMode: false,
          background: 'transparent',
          primaryColor: '#8839ef',
          primaryTextColor: '#4c4f69',
          primaryBorderColor: '#1e66f5',
          lineColor: '#7287fd',
          secondaryColor: '#e6e9ef',
          tertiaryColor: '#eff1f5',
          nodeBorder: '#8839ef',
          mainBkg: '#ffffff',
          clusterBkg: '#f4f5f9',
          titleColor: '#202022',
          edgeLabelBackground: '#ffffff',
        },
  });
}

/**
 * Sanitizes common Mermaid markdown syntax quirks (e.g. unquoted colons, apostrophes, and ampersands
 * in subgraph titles and node labels) so diagrams render cleanly without parse errors.
 */
export function sanitizeMermaidCode(raw: string): string {
  if (!raw) return '';
  let str = raw.trim();

  // 1. Quote unquoted subgraph titles containing special characters:
  // e.g. subgraph FrontEnd [Front-End: Indipendente dall'Architettura]
  // -> subgraph FrontEnd ["Front-End: Indipendente dall'Architettura"]
  str = str.replace(/subgraph\s+([a-zA-Z0-9_-]+)\s*\[\s*(?!")([^\]\n]+?)\s*\]/g, (_match, id, label) => {
    return `subgraph ${id} ["${label.replace(/"/g, "'")}"]`;
  });

  // 2. Quote unquoted node labels with special chars like & or : or '
  // e.g. Parse[Analisi Sintattica & Semantica - Parser]
  // -> Parse["Analisi Sintattica & Semantica - Parser"]
  str = str.replace(/([a-zA-Z0-9_-]+)\[\s*(?!")([^\]\n]*[&:'"][^\]\n]*?)\s*\]/g, (_match, id, label) => {
    return `${id}["${label.replace(/"/g, "'")}"]`;
  });

  return str;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = memo(({ code }) => {
  const theme = useVaultStore((state) => state.theme);
  const isDark = theme.includes('mocha') || theme.includes('dark');
  const safeCode = sanitizeMermaidCode(code || '');
  const cacheKey = `${safeCode}__${isDark ? 'dark' : 'light'}`;

  const [svgHtml, setSvgHtml] = useState<string>(() => svgCache.get(cacheKey) || '');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  // Stable container ID per component instance
  const containerIdRef = useRef<string>('');
  if (!containerIdRef.current) {
    containerCounter += 1;
    containerIdRef.current = `mermaid_diag_${Date.now()}_${containerCounter}`;
  }
  const containerId = containerIdRef.current;

  useEffect(() => {
    let isMounted = true;

    if (!safeCode) {
      setSvgHtml('');
      setError(null);
      return;
    }

    // Check cache first to avoid re-rendering flicker
    const cached = svgCache.get(cacheKey);
    if (cached) {
      setSvgHtml(cached);
      setError(null);
      return;
    }

    const renderDiagram = async () => {
      try {
        await configureMermaid(isDark);
        const mermaid = await getMermaidInstance();
        await mermaid.parse(safeCode);
        const { svg } = await mermaid.render(containerId, safeCode);
        if (isMounted) {
          svgCache.set(cacheKey, svg);
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errMsg = err instanceof Error ? err.message : String(err);
          document.querySelectorAll(`[id*="${containerId}"]`).forEach((el) => el.remove());
          setError(errMsg);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
      document.querySelectorAll(`[id*="${containerId}"]`).forEach((el) => el.remove());
    };
  }, [safeCode, isDark, cacheKey, containerId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative group my-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] backdrop-blur-sm overflow-hidden shadow-apple-sm transition-all duration-200">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] text-xs text-[var(--text-muted)] font-mono select-none">
        <span className="flex items-center gap-1.5 font-medium text-[var(--accent)]">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Mermaid Diagram
        </span>
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            title={isZoomed ? 'Riduci dimensione' : 'Espandi visualizzazione'}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            title="Copia sorgente Mermaid"
            className="flex items-center gap-1 px-2 py-0.5 hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="text-[10px]">{copied ? 'Copiato' : 'Copia'}</span>
          </button>
        </div>
      </div>

      {/* Render Area */}
      <div
        className={`p-4 flex justify-center items-center overflow-x-auto transition-all duration-300 ${
          isZoomed ? 'min-h-[480px] p-8' : 'min-h-[140px]'
        }`}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center p-4 max-w-lg text-center text-xs text-amber-500/90 dark:text-amber-400/90 bg-amber-500/5 rounded-lg border border-amber-500/20">
            <AlertCircle className="w-5 h-5 mb-1.5 opacity-80" />
            <span className="font-semibold mb-1">Diagramma Mermaid in elaborazione o errore di sintassi:</span>
            <span className="font-mono text-[11px] opacity-80 break-words line-clamp-3">
              {error.split('\n')[0]}
            </span>
          </div>
        ) : svgHtml ? (
          <div
            className="mermaid-svg-container w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:drop-shadow-sm select-none"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="text-xs text-[var(--text-muted)] italic">Caricamento diagramma...</div>
        )}
      </div>
    </div>
  );
});
