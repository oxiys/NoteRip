import React, { useEffect, useState, useId } from 'react';
import mermaid from 'mermaid';
import { AlertCircle, Check, Copy, Maximize2 } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';

interface MermaidRendererProps {
  code: string;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ code }) => {
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const theme = useVaultStore((state) => state.theme);
  const reactId = useId().replace(/:/g, '_');
  const containerId = `mermaid_${reactId}_${Math.random().toString(36).substring(2, 7)}`;

  useEffect(() => {
    let isMounted = true;
    const isDark = theme.includes('mocha') || theme.includes('dark');

    // Initialize mermaid configuration tailored for current theme
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
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

    const renderDiagram = async () => {
      const trimmedCode = code.trim();
      if (!trimmedCode) {
        if (isMounted) {
          setSvgHtml('');
          setError(null);
        }
        return;
      }

      try {
        // Pre-validate diagram syntax
        await mermaid.parse(trimmedCode);
        const { svg } = await mermaid.render(containerId, trimmedCode);
        if (isMounted) {
          setSvgHtml(svg);
          setError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const errMsg = err instanceof Error ? err.message : String(err);
          // Clean up any mermaid generated error elements left behind in DOM
          const errorElem = document.getElementById(containerId);
          if (errorElem) errorElem.remove();
          setError(errMsg);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
      const leftover = document.getElementById(containerId);
      if (leftover) leftover.remove();
    };
  }, [code, theme, containerId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="relative group my-4 rounded-xl border border-theme-border/60 bg-theme-sidebar/40 backdrop-blur-sm overflow-hidden shadow-sm transition-all duration-200">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-theme-border/40 bg-theme-bg/60 text-xs text-theme-muted font-mono select-none">
        <span className="flex items-center gap-1.5 font-medium text-theme-accent">
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
            className="p-1 hover:bg-theme-border/50 text-theme-muted hover:text-theme-text rounded transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleCopy}
            title="Copia sorgente Mermaid"
            className="flex items-center gap-1 px-2 py-0.5 hover:bg-theme-border/50 text-theme-muted hover:text-theme-text rounded transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
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
            className="mermaid-svg-container w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto [&>svg]:drop-shadow-sm"
            dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        ) : (
          <div className="text-xs text-theme-muted italic animate-pulse">Rendering diagramma...</div>
        )}
      </div>
    </div>
  );
};
