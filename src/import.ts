import { type Note, type NoteType, newId } from './model';
import { parseMarkdown } from './markdown';
import { migrateNote } from './migrate';

/**
 * Macht aus eingefügtem Text (Markdown im Format der App, siehe docs/REZEPT-IMPORT.md) eine neue Notiz.
 * Fehlt im Kopf `typ:`, gilt der Typ des Bereichs, in dem eingefügt wird. Es wird immer eine NEUE Notiz
 * angelegt (eine `id:` im Text wird ignoriert), damit nichts Vorhandenes überschrieben wird.
 */
export function importMarkdown(text: string, fallback: NoteType): Note | null {
  const t = text.trim();
  if (!t) return null;
  const note = migrateNote(parseMarkdown(t));
  if (note.blocks.length === 0 && note.title === 'Ohne Titel') return null;

  const head = t.startsWith('---') ? t.split(/\n---/)[0] : '';
  const hasType = /^typ:\s*\S+/m.test(head);
  note.type = hasType ? note.type : fallback;
  if (note.type === 'recipe' && !note.servings) note.servings = 4;
  if (note.type === 'note') note.servings = null;
  return { ...note, id: newId(), updatedAt: new Date().toISOString() };
}
