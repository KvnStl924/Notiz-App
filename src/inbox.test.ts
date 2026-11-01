import { describe, expect, it } from 'vitest';
import { noteFromRow, parseCsv, parseSheetId, rowsFromCsv } from './inbox';
import { ingredientsOf } from './shopping';

const md = `---
typ: rezept
portionen: 2
---
# Test-Rezept

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 200 | g | Mehl |
| 1 | Prise | Salz |

## Zubereitung
1. Mehl und Salz mischen.
2. Backen.
`;
const q = (s: string) => '"' + s.replace(/"/g, '""') + '"'; // so schreibt Google Zellen in CSV
const csv = `"Zeit","Titel","Rezept"\n"2026-11-01 10:00","Test-Rezept",${q(md)}\n"","",""\n`;

describe('Rezept-Eingang', () => {
  it('liest Zellen mit Anführungszeichen, Kommas und Zeilenumbrüchen', () => {
    expect(parseCsv('a,"b,c","d ""x"" e"\n1,2,3')).toEqual([['a', 'b,c', 'd "x" e'], ['1', '2', '3']]);
    expect(parseCsv('"zwei\nZeilen",x\r\ny,z')).toEqual([['zwei\nZeilen', 'x'], ['y', 'z']]);
  });
  it('überspringt Kopfzeile und leere Zeilen', () => {
    const rows = rowsFromCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Test-Rezept');
    expect(rows[0].markdown).toBe(md);
  });
  it('macht aus der Zeile ein Rezept mit Zutaten', async () => {
    const n = (await noteFromRow(rowsFromCsv(csv)[0]))!;
    expect(n.type).toBe('recipe');
    expect(n.servings).toBe(2);
    expect(ingredientsOf(n).map((i) => i.name)).toEqual(['Mehl', 'Salz']);
  });
  it('gleiche Zeile ergibt auf jedem Gerät dieselben IDs (kein Doppeltes)', async () => {
    const [a, b] = [await noteFromRow(rowsFromCsv(csv)[0]), await noteFromRow(rowsFromCsv(csv)[0])];
    expect(a!.id).toBe(b!.id);
    expect(a!.blocks.map((x) => x.id)).toEqual(b!.blocks.map((x) => x.id));
    const other = await noteFromRow({ title: 'Anderes', markdown: md });
    expect(other!.id).not.toBe(a!.id);
  });
  it('ohne Überschrift im Text gilt die Spalte Titel', async () => {
    const n = await noteFromRow({ title: 'Nur Spalte', markdown: '## Zutaten\n| Menge | Zutat |\n|---|---|\n| 1 | Ei |\n' });
    expect(n!.title).toBe('Nur Spalte');
  });
  it('erkennt die Tabellen-ID im Link', () => {
    expect(parseSheetId('https://docs.google.com/spreadsheets/d/1cGwVzjOz1QfMTnONgrWyFYucLpNwrzvHkaMNtPJ3rcE/edit?usp=sharing')).toBe(
      '1cGwVzjOz1QfMTnONgrWyFYucLpNwrzvHkaMNtPJ3rcE',
    );
    expect(parseSheetId('hallo')).toBeNull();
  });
});
