import type { Block, Note } from './model';

type Table = Extract<Block, { kind: 'table' }>;

/**
 * Altes Format „Menge | Einheit | Zutat“ wird zu „Menge | Zutat“, die Einheit wandert in die Menge
 * („500“ + „g“ -> „500 g“). Andere Tabellen bleiben unverändert.
 */
export function migrateTable(t: Table): void {
  const h = t.header.map((x) => x.trim().toLowerCase());
  const m = h.indexOf('menge');
  const e = h.indexOf('einheit');
  if (m < 0 || e !== m + 1) return;
  const drop = (arr: string[]) => arr.filter((_, i) => i !== e);
  t.rows = t.rows.map((r) => {
    const merged = [r[m] ?? '', r[e] ?? ''].map((x) => x.trim()).filter(Boolean).join(' ');
    const row = [...r];
    row[m] = merged;
    return drop(row);
  });
  t.header = drop(t.header);
}

/** Notiz beim Laden, Importieren und Übernehmen vom Sync auf das aktuelle Format bringen. */
export function migrateNote(n: Note): Note {
  for (const b of n.blocks) if (b.kind === 'table') migrateTable(b);
  return n;
}
