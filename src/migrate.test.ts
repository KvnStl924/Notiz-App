import { describe, expect, it } from 'vitest';
import { migrateNote } from './migrate';
import { parseMarkdown } from './markdown';
import { ingredientsOf } from './shopping';

describe('Umstellung auf „Menge | Zutat“', () => {
  it('alte Tabelle mit Einheit-Spalte wird zusammengeführt', () => {
    const n = migrateNote(parseMarkdown('# X\n\n## Zutaten\n| Menge | Einheit | Zutat |\n|---|---|---|\n| 400 | g | Spaghetti |\n| 2 | TL | Salz |\n| | | Pfeffer |\n'));
    const t = n.blocks.find((b) => b.kind === 'table');
    expect(t?.kind === 'table' && t.header).toEqual(['Menge', 'Zutat']);
    expect(t?.kind === 'table' && t.rows).toEqual([
      ['400 g', 'Spaghetti'],
      ['2 TL', 'Salz'],
      ['', 'Pfeffer'],
    ]);
    expect(ingredientsOf(n).map((i) => `${i.amount}|${i.name}`)).toEqual(['400 g|Spaghetti', '2 TL|Salz', '|Pfeffer']);
  });
  it('neue Tabelle bleibt unverändert', () => {
    const n = migrateNote(parseMarkdown('# X\n\n## Zutaten\n| Menge | Zutat |\n|---|---|\n| 2 TL | Salz |\n'));
    const t = n.blocks.find((b) => b.kind === 'table');
    expect(t?.kind === 'table' && t.header).toEqual(['Menge', 'Zutat']);
    expect(t?.kind === 'table' && t.rows).toEqual([['2 TL', 'Salz']]);
  });
});
