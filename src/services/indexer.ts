import type { NoteItem } from '../types';


/**
 * Regex for WikiLinks [[Note Name]] or [[Note Name|Alias]]
 */
const WIKILINK_REGEX = /\[\[([^[\]|]+)(?:\|[^[\]]+)?\]\]/g;


/**
 * Extract WikiLinks from note markdown content
 */
export function extractWikiLinks(content: string): string[] {
  const links = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(WIKILINK_REGEX);

  while ((match = regex.exec(content)) !== null) {
    const rawLink = match[1].trim();
    if (rawLink) {
      links.add(normalizeNoteName(rawLink));
    }
  }

  return Array.from(links);
}

// Reserved programming / C preprocessor directives and syntax words that should never be treated as tags
const RESERVED_TAG_KEYWORDS = new Set([
  'include',
  'define',
  'undef',
  'ifdef',
  'ifndef',
  'endif',
  'if',
  'elif',
  'else',
  'error',
  'warning',
  'pragma',
  'line',
  'import',
  'using',
  'region',
  'endregion',
]);

/**
 * Extract tags like #university #distributed-systems
 * Safely strips code blocks, inline code and ignores C/C++ preprocessor directives (#include, #define)
 */
export function extractTags(content: string): string[] {
  if (!content) return [];
  const tags = new Set<string>();

  // 1. Strip fenced code blocks
  let cleanContent = content.replace(/```[\s\S]*?```/g, '');

  // 2. Strip inline code
  cleanContent = cleanContent.replace(/`[^`\n]+`/g, '');

  // 3. Strip HTML comments
  cleanContent = cleanContent.replace(/<!--[\s\S]*?-->/g, '');

  // 4. Match tags: must begin with letter or unicode, followed by alphanum, not followed by < or "
  const tagRegex = /(?:^|[^\w#])#([a-zA-Z\u00C0-\u017F][a-zA-Z0-9_\-\u00C0-\u017F]*)/g;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(cleanContent)) !== null) {
    const rawTag = match[1].trim();
    const lower = rawTag.toLowerCase();

    // Ignore C/C++ preprocessor directives and reserved words
    if (RESERVED_TAG_KEYWORDS.has(lower)) {
      continue;
    }

    // Ignore if line looks like C preprocessor (e.g. #include <stdio.h> or #include "header.h")
    const afterMatch = cleanContent.slice(match.index + match[0].length);
    if (/^\s*[<"]/.test(afterMatch)) {
      continue;
    }

    tags.add(rawTag);
  }

  return Array.from(tags);
}

/**
 * Normalize note name (strips .md extension if typed, trims whitespace)
 */
export function normalizeNoteName(name: string): string {
  return name.replace(/\.md$/i, '').trim();
}

/**
 * Strip Markdown formatting to generate clean first-line Apple Notes preview
 */
export function extractPreview(content: string, title: string): string {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, headings that match title, or horizontal rules
    if (!trimmed || trimmed === '---' || trimmed === '***') continue;
    if (trimmed.startsWith('#') && trimmed.replace(/^#+\s*/, '').toLowerCase() === title.toLowerCase()) {
      continue;
    }

    // Clean markdown symbols: links, wikilinks, bold, italic, list markers
    const cleaned = trimmed
      .replace(WIKILINK_REGEX, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`#>-]/g, '')
      .trim();

    if (cleaned.length > 0) {
      return cleaned.slice(0, 140);
    }
  }
  return 'Nessun contenuto aggiuntivo...';
}

/**
 * Computes bidirectional backlinks across all notes in the vault
 */
export function computeBidirectionalLinks(notes: Map<string, { path: string; title: string; rel_path: string; content: string; updated_at: number; folder: string; folderDepth?: number }>): NoteItem[] {
  // First pass: extract outlinks for each note
  const rawList: Array<{
    path: string;
    title: string;
    rel_path: string;
    content: string;
    updated_at: number;
    folder: string;
    folderDepth?: number;
    tags: string[];
    outlinks: string[];
    preview: string;
  }> = [];

  // Map of normalized title -> target note path
  const titleToPath = new Map<string, string>();

  notes.forEach((item) => {
    const normTitle = normalizeNoteName(item.title).toLowerCase();
    titleToPath.set(normTitle, item.path);
  });

  notes.forEach((item) => {
    const outlinks = extractWikiLinks(item.content);
    const tags = extractTags(item.content);
    const preview = extractPreview(item.content, item.title);

    rawList.push({
      ...item,
      tags,
      outlinks,
      preview,
    });
  });

  // Second pass: compute backlinks
  // Map note path -> Set of note titles that link to it
  const backlinksMap = new Map<string, Set<string>>();
  rawList.forEach((n) => backlinksMap.set(n.path, new Set<string>()));

  rawList.forEach((sourceNote) => {
    for (const targetName of sourceNote.outlinks) {
      const targetPath = titleToPath.get(targetName.toLowerCase());
      if (targetPath) {
        backlinksMap.get(targetPath)?.add(sourceNote.title);
      }
    }
  });

  // Assemble full NoteItem list
  return rawList.map((item) => {
    const backlinks = Array.from(backlinksMap.get(item.path) || []);
    return {
      ...item,
      backlinks,
    };
  });
}
