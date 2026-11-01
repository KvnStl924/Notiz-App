import { describe, expect, it } from 'vitest';
import { importMarkdown } from './import';
import { ingredientsOf } from './shopping';

const rezept = `---
typ: rezept
portionen: 2
id: schon-vorhanden
---
# Rotes Linsen-Dal

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 200 | g | Rote Linsen |
| 1 | Dose | Kokosmilch |

## Zubereitung
1. Zwiebel anbraten.
2. Linsen und Kokosmilch zugeben und 15 Minuten köcheln.
`;

describe('Rezept aus Text einfügen', () => {
  it('legt ein Rezept mit Zutaten und Schritten an', () => {
    const n = importMarkdown(rezept, 'note')!;
    expect(n.title).toBe('Rotes Linsen-Dal');
    expect(n.type).toBe('recipe');
    expect(n.servings).toBe(2);
    expect(ingredientsOf(n).map((i) => i.name)).toEqual(['Rote Linsen', 'Kokosmilch']);
    expect(n.blocks.some((b) => b.kind === 'steps')).toBe(true);
  });
  it('übernimmt nie eine vorhandene id', () => {
    expect(importMarkdown(rezept, 'recipe')!.id).not.toBe('schon-vorhanden');
  });
  it('ohne typ im Kopf gilt der Bereich, in dem eingefügt wird', () => {
    const n = importMarkdown('# Pfannkuchen\n\n## Zutaten\n| Menge | Zutat |\n|---|---|\n| 3 | Eier |\n', 'recipe')!;
    expect(n.type).toBe('recipe');
    expect(n.servings).toBe(4);
    expect(importMarkdown('# Einkauf\n\n- [ ] Milch\n', 'note')!.type).toBe('note');
  });
  it('leerer Text ergibt nichts', () => {
    expect(importMarkdown('   \n  ', 'recipe')).toBeNull();
  });
});
