import 'package:flutter_test/flutter_test.dart';
import 'package:notiz_app/markdown/note_markdown.dart';
import 'package:notiz_app/models/note.dart';

const carbonara = '''
---
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
''';

void main() {
  test('liest ein von Hand/Claude geschriebenes Rezept', () {
    final n = NoteMarkdown.parse(carbonara);
    expect(n.title, 'Spaghetti Carbonara');
    expect(n.type, NoteType.recipe);
    expect(n.servings, 4);

    final table = n.blocks.whereType<TableBlock>().single;
    expect(table.header, ['Menge', 'Einheit', 'Zutat']);
    expect(table.rows, [
      ['400', 'g', 'Spaghetti'],
      ['150', 'g', 'Guanciale'],
    ]);

    final steps = n.blocks.whereType<StepsBlock>().single;
    expect(steps.steps.length, 2);

    final list = n.blocks.whereType<ChecklistBlock>().single;
    expect(list.items.map((e) => e.done), [false, true]);

    expect((n.blocks.last as TextBlock).text, 'Lecker mit\nfrischem Pfeffer.');
  });

  test('Datei ohne id bekommt eine neue id', () {
    final n = NoteMarkdown.parse(carbonara);
    expect(n.id.length, 16);
  });

  test('schreiben und wieder lesen ergibt dieselbe Notiz', () {
    final original = NoteMarkdown.parse(carbonara);
    final again = NoteMarkdown.parse(NoteMarkdown.write(original));
    expect(again.id, original.id);
    expect(again.toJson()['title'], original.toJson()['title']);
    expect(
      again.blocks.map((b) => b.toJson()..remove('id')).toList(),
      original.blocks.map((b) => b.toJson()..remove('id')).toList(),
    );
  });

  test('Pipe-Zeichen und kurze Zeilen in Tabellen', () {
    final n = Note(title: 'T', blocks: [
      TableBlock(header: ['A', 'B'], rows: [
        ['x|y', 'z'],
      ]),
    ]);
    final back = NoteMarkdown.parse(NoteMarkdown.write(n));
    expect((back.blocks.single as TableBlock).rows.single, ['x|y', 'z']);

    final short = NoteMarkdown.parse('# T\n\n| A | B |\n|---|---|\n| 1 |\n');
    expect((short.blocks.single as TableBlock).rows.single, ['1', '']);
  });

  test('JSON-Roundtrip', () {
    final n = NoteMarkdown.parse(carbonara);
    final back = Note.fromJson(n.toJson());
    expect(back.toJson(), n.toJson());
  });
}
