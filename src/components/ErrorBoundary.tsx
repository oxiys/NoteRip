import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  rawFallbackContent?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('NoteRip Render Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackMessage, rawFallbackContent } = this.props;

      // If a simple raw fallback string was provided (e.g. for individual blocks)
      if (rawFallbackContent !== undefined) {
        return (
          <div className="my-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs font-mono">
            <div className="flex items-center justify-between gap-2 font-semibold text-[11px] mb-1.5 text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={13} />
                <span>Errore visualizzazione blocco</span>
              </span>
              {this.state.error && (
                <span className="text-[10px] text-rose-500 dark:text-rose-400 font-mono px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 truncate max-w-xs">
                  {this.state.error.message}
                </span>
              )}
            </div>
            <pre className="whitespace-pre-wrap break-all text-[11px] opacity-90">{rawFallbackContent}</pre>
          </div>
        );
      }

      return (
        <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-black/[0.02] dark:bg-white/[0.02]">
          <div className="max-w-md p-6 rounded-2xl apple-card-item border border-black/10 dark:border-white/10 shadow-apple-lg space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                {fallbackTitle || 'Impossibile visualizzare la nota'}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {fallbackMessage ||
                  'Si è verificato un errore durante il rendering della nota. Puoi ricaricare o visualizzare il testo sorgente.'}
              </p>
              {this.state.error && (
                <div className="mt-3 p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 font-mono text-[11px] text-rose-500 dark:text-rose-400 text-left overflow-x-auto max-h-24">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs shadow-apple-sm transition-all"
              >
                <RefreshCw size={13} />
                <span>Riprova</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
