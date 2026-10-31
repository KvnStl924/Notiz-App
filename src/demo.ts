import { parseMarkdown } from './markdown';
import type { Note } from './model';

/** Beispieldaten für die Vorschau (nur im Demo-Build, siehe VITE_DEMO). Absichtlich als Markdown geschrieben. */
const MD = [
  `---
typ: rezept
portionen: 4
---
# Spaghetti Carbonara

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 400 | g | Spaghetti |
| 150 | g | Guanciale |
| 4 | Stück | Eigelb |
| 80 | g | Pecorino |

## Zubereitung
1. Wasser salzen und die Spaghetti nach Packungsangabe kochen.
2. Guanciale in einer Pfanne knusprig braten.
3. Eigelb mit geriebenem Pecorino verrühren und mit etwas Nudelwasser zu einer Creme vermengen.
4. Spaghetti mit dem Guanciale mischen, vom Herd nehmen und die Creme unterheben.
`,
  `---
typ: rezept
portionen: 2
---
# Rotes Linsen-Dal

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 200 | g | Rote Linsen |
| 1 | Dose | Kokosmilch |
| 1 | Stück | Zwiebel |
| 2 | TL | Currypulver |

## Zubereitung
1. Zwiebel würfeln und in etwas Öl glasig anbraten.
2. Curry kurz mitrösten, Linsen und Kokosmilch zugeben.
3. 15 Minuten köcheln lassen und mit Salz abschmecken.
`,
  `---
typ: rezept
portionen: 3
---
# Pfannkuchen

## Zutaten
| Menge | Einheit | Zutat |
|---|---|---|
| 250 | g | Mehl |
| 500 | ml | Milch |
| 3 | Stück | Eier |
`,
  `---
typ: notiz
---
# Einkauf Samstag

- [x] Eier
- [ ] Pecorino
- [ ] Guanciale
- [ ] Rote Linsen
`,
  `---
typ: notiz
---
# Urlaub planen

Ideen für den Sommer:

- [ ] Unterkunft vergleichen
- [ ] Flüge prüfen
`,
];

export function demoNotes(): Note[] {
  const now = Date.now();
  return MD.map((m, i) => ({ ...parseMarkdown(m), updatedAt: new Date(now - i * 600_000).toISOString() }));
}
