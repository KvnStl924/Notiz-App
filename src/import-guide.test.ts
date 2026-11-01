import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importMarkdown } from './import';
import { ingredientsOf } from './shopping';

// Das Beispiel in der Anleitung für andere Chats muss sich wirklich importieren lassen.
describe('Anleitung REZEPT-IMPORT.md', () => {
  const lf = (t: string) => t.replace(/\r\n/g, '\n'); // robust gegen Windows-Zeilenenden
  const guide = lf(readFileSync('docs/REZEPT-IMPORT.md', 'utf8'));
  const example = guide.split('```markdown\n')[1].split('```')[0];

  it('das Beispiel wird zu einem Rezept mit Zutaten und Schritten', () => {
    const n = importMarkdown(example, 'note')!;
    expect(n.type).toBe('recipe');
    expect(n.servings).toBe(4);
    expect(ingredientsOf(n).map((i) => i.name)).toEqual(['Spaghetti', 'Guanciale', 'Eigelb', 'Pecorino', 'Pfeffer (nach Geschmack)']);
    const steps = n.blocks.find((b) => b.kind === 'steps');
    expect(steps && steps.kind === 'steps' && steps.steps.length).toBe(4);
  });
  it('das eingebettete Programm entspricht der Datei im Projekt', () => {
    const code = guide.split('```python\n')[1].replace(/```\n$/, '');
    expect(code).toBe(lf(readFileSync('tools/rezept-senden.py', 'utf8')));
  });
});
