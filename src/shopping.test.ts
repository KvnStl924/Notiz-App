import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './markdown';
import { mk, type ShopItem } from './model';
import { ingredientsOf, mergeRecipe } from './shopping';

const recipe = (md: string) => parseMarkdown(md);

const carbonara = recipe(`---
typ: rezept
portionen: 4
---
# Carbonara

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 400 | g | Spaghetti |
| 150 | g | Guanciale |
|  |  |  |
| 4 | Stück | Eigelb |
`);

describe('ingredientsOf', () => {
  it('liest Menge, Einheit und Zutat; leere Zeilen werden übersprungen', () => {
    expect(ingredientsOf(carbonara)).toEqual([
      { name: 'Spaghetti', amount: '400 g' },
      { name: 'Guanciale', amount: '150 g' },
      { name: 'Eigelb', amount: '4 Stück' },
    ]);
  });

  it('erkennt umsortierte Spalten an der Überschrift', () => {
    const n = recipe('# X\n\n## Zutaten\n| Zutat | Menge |\n|---|---|\n| Salz | 1 Prise |\n');
    expect(ingredientsOf(n)).toEqual([{ name: 'Salz', amount: '1 Prise' }]);
  });

  it('ohne passende Überschriften: letzte Spalte ist der Name', () => {
    const n = recipe('# X\n\n| A | B | C |\n|---|---|---|\n| 2 | EL | Öl |\n');
    expect(ingredientsOf(n)).toEqual([{ name: 'Öl', amount: '2 EL' }]);
  });

  it('bevorzugt die Tabelle unter „Zutaten“', () => {
    const n = recipe('# X\n\n| Kcal | Wert |\n|---|---|\n| 1 | 2 |\n\n## Zutaten\n| Menge | Zutat |\n|---|---|\n| 1 | Ei |\n');
    expect(ingredientsOf(n)).toEqual([{ name: 'Ei', amount: '1' }]);
  });

  it('keine Tabelle: keine Zutaten', () => {
    expect(ingredientsOf(mk.note({ title: 'Nur Text', blocks: [mk.text('hallo')] }))).toEqual([]);
  });
});

describe('mergeRecipe', () => {
  it('legt neue Posten an', () => {
    const r = mergeRecipe([], carbonara);
    expect(r.added.map((i) => i.name)).toEqual(['Spaghetti', 'Guanciale', 'Eigelb']);
    expect(r.added.every((i) => i.recipeId === carbonara.id && !i.home && !i.bought)).toBe(true);
  });

  it('legt nichts doppelt an und behält Häkchen', () => {
    const first = mergeRecipe([], carbonara).added;
    first[0].home = true;
    const again = mergeRecipe(first, carbonara);
    expect(again.added).toHaveLength(0);
    expect(again.unchanged).toBe(3);
    expect(first[0].home).toBe(true);
  });

  it('ergänzt neue Zutaten und passt die Menge an, solange nicht gekauft', () => {
    const items: ShopItem[] = mergeRecipe([], carbonara).added;
    items[0].bought = true;
    const t = carbonara.blocks.find((b) => b.kind === 'table')!;
    if (t.kind === 'table') {
      t.rows[0][0] = '500'; // Spaghetti: schon gekauft -> bleibt
      t.rows[1][0] = '200'; // Guanciale: noch offen -> Menge wird angepasst
      t.rows.push(['1', 'Stück', 'Pfeffer']);
    }
    const r = mergeRecipe(items, carbonara);
    expect(r.added.map((i) => i.name)).toEqual(['Pfeffer']);
    expect(r.updated.map((i) => [i.name, i.amount])).toEqual([['Guanciale', '200 g']]);
    expect(items[0].amount).toBe('400 g');
  });

  it('Rezepte werden getrennt: gleiche Zutat aus anderem Rezept zählt neu', () => {
    const other = recipe('# Anderes\n\n## Zutaten\n| Menge | Zutat |\n|---|---|\n| 1 | Eigelb |\n');
    const items = mergeRecipe([], carbonara).added;
    expect(mergeRecipe(items, other).added.map((i) => i.name)).toEqual(['Eigelb']);
  });
});
