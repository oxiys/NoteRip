import type { NoteItem } from '../types';


/**
 * Regex for WikiLinks [[Note Name]] or [[Note Name|Alias]]
 */
const WIKILINK_REGEX = /\[\[([^[\]|]+)(?:\|[^[\]]+)?\]\]/g;

/**
 * Regex for tags #tag_name
 */
const TAG_REGEX = /(?:^|\s)#([a-zA-Z0-9_\-\u00C0-\u017F]+)/g;

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

/**
 * Extract tags like #university #distributed-systems
 */
export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  const regex = new RegExp(TAG_REGEX);

  while ((match = regex.exec(content)) !== null) {
    const tag = match[1].trim();
    if (tag) {
      tags.add(tag);
    }
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
export function computeBidirectionalLinks(notes: Map<string, { path: string; title: string; rel_path: string; content: string; updated_at: number; folder: string }>): NoteItem[] {
  // First pass: extract outlinks for each note
  const rawList: Array<{
    path: string;
    title: string;
    rel_path: string;
    content: string;
    updated_at: number;
    folder: string;
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
