import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:notiz_app/data/note_store.dart';
import 'package:notiz_app/main.dart';
import 'package:notiz_app/models/note.dart';
import 'package:provider/provider.dart';

/// Echte Datei-Zugriffe laufen außerhalb der simulierten Testzeit: abwechselnd
/// echte Zeit vergehen lassen und Frames pumpen.
Future<void> settleIo(WidgetTester tester) async {
  for (var i = 0; i < 5; i++) {
    await tester.runAsync(() => Future.delayed(const Duration(milliseconds: 60)));
    await tester.pumpAndSettle();
  }
}

void main() {
  late Directory dir;
  late File file;

  setUp(() {
    dir = Directory.systemTemp.createTempSync('notiz');
    file = File('${dir.path}/notes.json');
  });
  tearDown(() => dir.deleteSync(recursive: true));

  testWidgets('Rezept anlegen, Tabelle ausfüllen, wird gespeichert', (tester) async {
    final store = NoteStore(file);
    await tester.runAsync(store.load);
    await tester.pumpWidget(
        ChangeNotifierProvider.value(value: store, child: const NotizApp()));

    expect(find.text('Noch keine Notizen'), findsOneWidget);

    await tester.tap(find.text('Neu'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Rezept'));
    await tester.pumpAndSettle(); // Menü schließt sich, Speichern startet
    await settleIo(tester); // Editor öffnet sich
    expect(find.text('Rezept'), findsOneWidget); // Editor-Titel
    expect(find.text('Zubereitung'), findsOneWidget); // Rezept-Vorlage ist da

    await tester.enterText(find.byType(TextField).first, 'Pfannkuchen');
    // Felder: Titel, Überschrift 'Zutaten', 3 Tabellenköpfe, dann erste Zelle (Menge)
    final cells = find.byType(TextField);
    await tester.enterText(cells.at(5), '250');
    await tester.pump(const Duration(seconds: 1)); // Debounce-Timer löst aus
    await settleIo(tester);

    final saved = store.notes.single;
    expect(saved.title, 'Pfannkuchen');
    final table = saved.blocks.whereType<TableBlock>().single;
    expect(table.rows.first.first, '250');

    // Neustart: Daten sind noch da
    final store2 = NoteStore(file);
    await tester.runAsync(store2.load);
    expect(store2.notes.single.title, 'Pfannkuchen');
  });
}
