import katex from 'katex';

/**
 * Normalizes and sanitizes LaTeX math strings to prevent KaTeX parse errors,
 * handle escaped characters, recover from missing delimiters, and decode HTML entities.
 */

// HTML entity decoder map
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
  '&#92;': '\\',
};

function decodeHtmlEntities(str: string): string {
  return str.replace(/&(?:amp|lt|gt|quot|#39|nbsp|#92);/g, (match) => HTML_ENTITIES[match] || match);
}

/**
 * Environments that require displayMode: true in KaTeX
 */
const DISPLAY_ENVIRONMENTS = [
  'aligned',
  'align',
  'align*',
  'matrix',
  'pmatrix',
  'bmatrix',
  'vmatrix',
  'Vmatrix',
  'cases',
  'gathered',
  'gather',
  'gather*',
  'array',
  'equation',
  'equation*',
  'split',
  'multline',
  'multline*',
];

/**
 * Checks if a formula should be rendered with displayMode (even if inlined with $)
 */
export function shouldForceDisplayMode(latex: string): boolean {
  if (!latex) return false;
  // Check if it contains any display environments
  const hasDisplayEnv = DISPLAY_ENVIRONMENTS.some((env) =>
    latex.includes(`\\begin{${env}}`)
  );
  if (hasDisplayEnv) return true;

  // Check if it contains explicit line breaks \\ or multiple lines
  if (latex.includes('\\\\') && (latex.includes('&') || latex.includes('\\begin'))) {
    return true;
  }

  return false;
}

/**
 * Sanitizes LaTeX formula to eliminate stray delimiters, fix escape characters,
 * and handle common markdown/LaTeX formatting issues.
 */
export function sanitizeLatex(raw: string): string {
  if (!raw) return '';
  let str = decodeHtmlEntities(raw.trim());

  // 1. Strip all leading and trailing dollar signs ($ or $$ or $$$) or \[ \] or \( \)
  str = str
    .replace(/^(\$\$|\$|\\\[|\\\()/, '')
    .replace(/(\$\$|\$|\\\]|\\\))$/, '')
    .trim();

  // 2. Decode double-escaped backslashes like \\\\begin to \\begin when pasted from JSON/strings
  // But preserve LaTeX matrix row breaks (\\)
  str = str.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // 3. Fix unescaped % (which in LaTeX is a comment and truncates the rest of the formula)
  // Replace % with \% unless preceded by a backslash
  str = str.replace(/(?<!\\)%/g, '\\%');

  // 4. Fix unescaped # (which in TeX causes "Expected 'EOF', got '#'") unless preceded by backslash
  str = str.replace(/(?<!\\)#/g, '\\#');

  // 5. Remove any internal unescaped $ signs that cause KaTeX errors
  // Preserves escaped '\$' for currency
  str = str.replace(/(?<!\\)\$/g, '');

  // 6. Fix common spacing and non-breaking space issues
  str = str.replace(/\u00A0/g, ' ');

  // 7. Fix broken backslash right at the end of formula (e.g. user typed \ and paused)
  if (str.endsWith('\\') && !str.endsWith('\\\\')) {
    str = str.slice(0, -1);
  }

  return str.trim();
}

export interface LatexRenderResult {
  html: string;
  isError: boolean;
  errorMessage?: string;
  displayMode: boolean;
}

/**
 * Safely renders LaTeX with KaTeX. If an error occurs, returns safe fallback HTML
 * with error details without crashing the component.
 */
export function renderLatexSafe(rawLatex: string, forceDisplay?: boolean): LatexRenderResult {
  const sanitized = sanitizeLatex(rawLatex);
  const displayMode = forceDisplay !== undefined ? forceDisplay : shouldForceDisplayMode(sanitized);

  if (!sanitized) {
    return { html: '', isError: false, displayMode };
  }

  try {
    const html = katex.renderToString(sanitized, {
      displayMode,
      throwOnError: false,
      errorColor: '#f38ba8', // Catppuccin red
      output: 'htmlAndMathml',
      strict: false,
      trust: true,
    });

    // Check if KaTeX generated a katex-error span
    const isError = html.includes('class="katex-error"');

    return {
      html,
      isError,
      errorMessage: isError ? 'Sintassi KaTeX incompleta o non valida' : undefined,
      displayMode,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      html: `<span class="katex-parse-fallback font-mono text-xs text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20" title="${msg}">${sanitized}</span>`,
      isError: true,
      errorMessage: msg,
      displayMode,
    };
  }
}
