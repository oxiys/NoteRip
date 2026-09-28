import type { NoteItem } from '../types';

export interface DataviewQuery {
  type: 'TABLE' | 'LIST' | 'TASK';
  columns: Array<{ key: string; label: string }>;
  fromTags: string[];
  fromFolder: string | null;
  whereClause: string | null;
  sortField: string | null;
  sortOrder: 'asc' | 'desc';
}

export interface DataviewRow {
  note: NoteItem;
  values: Record<string, string | number | string[]>;
}

export function parseDataviewQuery(rawQuery: string): DataviewQuery {
  const lines = rawQuery
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('//'));

  let type: 'TABLE' | 'LIST' | 'TASK' = 'TABLE';
  const columns: Array<{ key: string; label: string }> = [];
  const fromTags: string[] = [];
  let fromFolder: string | null = null;
  let whereClause: string | null = null;
  let sortField: string | null = null;
  let sortOrder: 'asc' | 'desc' = 'asc';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    if (upper.startsWith('TABLE')) {
      type = 'TABLE';
      const colDefs = line.substring(5).trim();
      if (colDefs) {
        // e.g. file.name as "Nota", folder, tags
        const parts = colDefs.split(',').map((p) => p.trim());
        parts.forEach((p) => {
          const asMatch = p.match(/^(.+?)\s+as\s+["']?([^"']+)["']?$/i);
          if (asMatch) {
            columns.push({ key: asMatch[1].trim(), label: asMatch[2].trim() });
          } else {
            const label = p.replace(/^file\./, '');
            columns.push({ key: p, label: label.charAt(0).toUpperCase() + label.slice(1) });
          }
        });
      }
    } else if (upper.startsWith('LIST')) {
      type = 'LIST';
      const colDef = line.substring(4).trim();
      if (colDef) {
        columns.push({ key: colDef, label: colDef });
      }
    } else if (upper.startsWith('TASK')) {
      type = 'TASK';
    } else if (upper.startsWith('FROM')) {
      const fromContent = line.substring(4).trim();
      // Extract folders "..."
      const folderMatches = fromContent.match(/"([^"]+)"|'([^']+)'/);
      if (folderMatches) {
        fromFolder = folderMatches[1] || folderMatches[2];
      }
      // Extract tags #...
      const tagMatches = fromContent.match(/#([a-zA-Z0-9_\-\u00C0-\u017F]+)/g);
      if (tagMatches) {
        tagMatches.forEach((t) => fromTags.push(t.replace(/^#/, '')));
      }
    } else if (upper.startsWith('WHERE')) {
      whereClause = line.substring(5).trim();
    } else if (upper.startsWith('SORT')) {
      const sortRest = line.substring(4).trim();
      const parts = sortRest.split(/\s+/);
      if (parts.length > 0) {
        sortField = parts[0];
        if (parts[1] && parts[1].toLowerCase() === 'desc') {
          sortOrder = 'desc';
        }
      }
    }
  }

  // Default table columns if omitted
  if (type === 'TABLE' && columns.length === 0) {
    columns.push({ key: 'file.name', label: 'File' });
    columns.push({ key: 'folder', label: 'Cartella' });
    columns.push({ key: 'tags', label: 'Tags' });
  }

  return {
    type,
    columns,
    fromTags,
    fromFolder,
    whereClause,
    sortField,
    sortOrder,
  };
}

export function executeDataview(query: DataviewQuery, notes: NoteItem[]): DataviewRow[] {
  let filtered = notes.filter((note) => {
    // 1. Folder filter
    if (query.fromFolder) {
      const normFrom = query.fromFolder.toLowerCase();
      if (!note.folder.toLowerCase().includes(normFrom) && !note.rel_path.toLowerCase().includes(normFrom)) {
        return false;
      }
    }

    // 2. Tag filter
    if (query.fromTags.length > 0) {
      const hasAnyTag = query.fromTags.some((tag) =>
        note.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
      );
      if (!hasAnyTag) return false;
    }

    // 3. WHERE clause simple filter
    if (query.whereClause) {
      const whereLower = query.whereClause.toLowerCase();
      if (whereLower.includes('!completed')) {
        // Task check
        if (!note.content.includes('- [ ]')) return false;
      } else if (whereLower.startsWith('contains(')) {
        const arg = whereLower.replace(/^contains\([^,]+,\s*["']?([^"')]+)["']?\)/, '$1');
        if (!note.content.toLowerCase().includes(arg) && !note.title.toLowerCase().includes(arg)) {
          return false;
        }
      }
    }

    return true;
  });

  // Sorting
  if (query.sortField) {
    const field = query.sortField.toLowerCase().replace(/^file\./, '');
    filtered.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (field === 'name' || field === 'title') {
        valA = a.title.toLowerCase();
        valB = b.title.toLowerCase();
      } else if (field === 'mtime' || field === 'updated_at') {
        valA = a.updated_at;
        valB = b.updated_at;
      } else if (field === 'folder') {
        valA = a.folder.toLowerCase();
        valB = b.folder.toLowerCase();
      }

      if (valA < valB) return query.sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return query.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }

  // Map to DataviewRow
  return filtered.map((note) => {
    const values: Record<string, string | number | string[]> = {};
    query.columns.forEach((col) => {
      const k = col.key.toLowerCase().replace(/^file\./, '');
      if (k === 'name' || k === 'title') {
        values[col.key] = note.title;
      } else if (k === 'folder') {
        values[col.key] = note.folder;
      } else if (k === 'tags') {
        values[col.key] = note.tags;
      } else if (k === 'mtime' || k === 'updated_at') {
        values[col.key] = new Date(note.updated_at).toLocaleDateString('it-IT');
      } else if (k === 'outlinks') {
        values[col.key] = note.outlinks.length;
      } else if (k === 'backlinks') {
        values[col.key] = note.backlinks.length;
      } else if (k === 'preview') {
        values[col.key] = note.preview;
      } else {
        values[col.key] = '-';
      }
    });

    return { note, values };
  });
}
