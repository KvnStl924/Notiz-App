import { describe, expect, it } from 'vitest';
import { parseMarkdown, writeMarkdown } from './markdown';
import { mk, type Block } from './model';

const carbonara = `---
typ: rezept
portionen: 4
---
# Spaghetti Carbonara

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 400 | g | Spaghetti |
| 150 | g | Guanciale |

## Zubereitung
1. Wasser salzen und Spaghetti kochen.
2. Guanciale knusprig braten.

## Einkaufsliste
- [ ] Eier
- [x] Pecorino

Lecker mit
frischem Pfeffer.
`;

const strip = (b: Block[]) => b.map((x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'id' ? undefined : v))));
const of = <K extends Block['kind']>(blocks: Block[], kind: K) =>
  blocks.filter((b) => b.kind === kind) as Extract<Block, { kind: K }>[];

describe('Markdown', () => {
  it('liest ein von Hand/Claude geschriebenes Rezept', () => {
    const n = parseMarkdown(carbonara);
    expect(n.title).toBe('Spaghetti Carbonara');
    expect(n.type).toBe('recipe');
    expect(n.servings).toBe(4);

    const [table] = of(n.blocks, 'table');
    expect(table.header).toEqual(['Menge', 'Einheit', 'Zutat']);
    expect(table.rows).toEqual([
      ['400', 'g', 'Spaghetti'],
      ['150', 'g', 'Guanciale'],
    ]);
    expect(of(n.blocks, 'steps')[0].steps).toHaveLength(2);
    expect(of(n.blocks, 'checklist')[0].items.map((i) => i.done)).toEqual([false, true]);
    expect(of(n.blocks, 'text')[0].text).toBe('Lecker mit\nfrischem Pfeffer.');
  });

  it('Datei ohne id bekommt eine neue id', () => {
    expect(parseMarkdown(carbonara).id).toHaveLength(16);
  });

  it('schreiben und wieder lesen ergibt dieselbe Notiz', () => {
    const original = parseMarkdown(carbonara);
    const again = parseMarkdown(writeMarkdown(original));
    expect(again.id).toBe(original.id);
    expect(again.title).toBe(original.title);
    expect(strip(again.blocks)).toEqual(strip(original.blocks));
  });

  it('Pipe-Zeichen und kurze Zeilen in Tabellen', () => {
    const n = mk.note({ title: 'T', blocks: [mk.table(['A', 'B'], [['x|y', 'z']])] });
    const back = parseMarkdown(writeMarkdown(n));
    expect(of(back.blocks, 'table')[0].rows[0]).toEqual(['x|y', 'z']);

    const short = parseMarkdown('# T\n\n| A | B |\n|---|---|\n| 1 |\n');
    expect(of(short.blocks, 'table')[0].rows[0]).toEqual(['1', '']);
  });

  it('Notiz ohne Kopfzeilen und mit Windows-Zeilenenden', () => {
    const n = parseMarkdown('# Einkauf\r\n\r\n- [ ] Milch\r\n');
    expect(n.title).toBe('Einkauf');
    expect(of(n.blocks, 'checklist')[0].items[0].text).toBe('Milch');
  });
});
