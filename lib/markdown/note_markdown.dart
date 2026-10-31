import '../models/note.dart';

/// Wandelt Notizen in Markdown um und zurück.
///
/// Das Format ist in docs/KONZEPT.md beschrieben. Es ist bewusst einfach, damit
/// die Dateien in Google Drive von Hand oder von Claude bearbeitet werden können.
class NoteMarkdown {
  static String write(Note note) {
    final out = StringBuffer();
    out.writeln('---');
    out.writeln('id: ${note.id}');
    out.writeln('typ: ${note.type == NoteType.recipe ? 'rezept' : 'notiz'}');
    if (note.servings != null) out.writeln('portionen: ${note.servings}');
    out.writeln('---');
    out.writeln('# ${note.title}');

    for (final b in note.blocks) {
      out.writeln();
      switch (b) {
        case HeadingBlock():
          out.writeln('${'#' * b.level} ${b.text}');
        case TextBlock():
          out.writeln(b.text);
        case ChecklistBlock():
          for (final i in b.items) {
            out.writeln('- [${i.done ? 'x' : ' '}] ${i.text}');
          }
        case StepsBlock():
          for (var n = 0; n < b.steps.length; n++) {
            out.writeln('${n + 1}. ${b.steps[n]}');
          }
        case TableBlock():
          out.writeln(_row(b.header));
          out.writeln(_row(List.filled(b.header.length, '---')));
          for (final r in b.rows) {
            out.writeln(_row(_fit(r, b.header.length)));
          }
        case ImageBlock():
          out.writeln('![${b.caption}](${b.source})');
      }
    }
    return out.toString();
  }

  static final _checkRe = RegExp(r'^[-*] \[([ xX])\] ?(.*)$');
  static final _stepRe = RegExp(r'^\d+[.)] ?(.*)$');
  static final _headingRe = RegExp(r'^(#{1,6}) +(.*)$');
  static final _imageRe = RegExp(r'^!\[(.*?)\]\((.*?)\)$');

  /// Liest Markdown. Fehlt die `id` im Kopf (z. B. bei einer von Claude neu
  /// angelegten Datei), wird eine neue vergeben.
  static Note parse(String markdown) {
    final lines = markdown.replaceAll('\r\n', '\n').split('\n');
    var i = 0;

    final meta = <String, String>{};
    if (lines.isNotEmpty && lines[0].trim() == '---') {
      i = 1;
      while (i < lines.length && lines[i].trim() != '---') {
        final line = lines[i];
        final c = line.indexOf(':');
        if (c > 0) {
          // Kommentare hinter " #" abschneiden
          meta[line.substring(0, c).trim()] =
              line.substring(c + 1).split(RegExp(r'\s+#')).first.trim();
        }
        i++;
      }
      i++; // schließendes ---
    }

    String? title;
    final blocks = <Block>[];

    bool blank(String l) => l.trim().isEmpty;

    while (i < lines.length) {
      final line = lines[i];
      if (blank(line)) {
        i++;
        continue;
      }

      final h = _headingRe.firstMatch(line);
      if (h != null) {
        final level = h.group(1)!.length;
        if (level == 1 && title == null) {
          title = h.group(2)!.trim();
        } else {
          blocks.add(HeadingBlock(text: h.group(2)!.trim(), level: level));
        }
        i++;
        continue;
      }

      if (_checkRe.hasMatch(line)) {
        final items = <CheckItem>[];
        while (i < lines.length && _checkRe.hasMatch(lines[i])) {
          final m = _checkRe.firstMatch(lines[i])!;
          items.add(CheckItem(m.group(2)!.trim(), done: m.group(1)!.toLowerCase() == 'x'));
          i++;
        }
        blocks.add(ChecklistBlock(items: items));
        continue;
      }

      if (_stepRe.hasMatch(line)) {
        final steps = <String>[];
        while (i < lines.length && _stepRe.hasMatch(lines[i])) {
          steps.add(_stepRe.firstMatch(lines[i])!.group(1)!.trim());
          i++;
        }
        blocks.add(StepsBlock(steps: steps));
        continue;
      }

      if (line.trimLeft().startsWith('|')) {
        final rows = <List<String>>[];
        while (i < lines.length && lines[i].trimLeft().startsWith('|')) {
          rows.add(_cells(lines[i]));
          i++;
        }
        // Zeile 2 ist die Trennzeile |---|---|
        final hasSeparator =
            rows.length >= 2 && rows[1].every((c) => RegExp(r'^:?-{1,}:?$').hasMatch(c));
        final header = rows.first;
        final body = rows.skip(hasSeparator ? 2 : 1).map((r) => _fit(r, header.length)).toList();
        blocks.add(TableBlock(header: header, rows: body));
        continue;
      }

      final img = _imageRe.firstMatch(line.trim());
      if (img != null) {
        blocks.add(ImageBlock(caption: img.group(1)!, source: img.group(2)!));
        i++;
        continue;
      }

      // Absatz: alle Zeilen bis zur nächsten Leerzeile oder einem anderen Blocktyp
      final para = <String>[];
      while (i < lines.length &&
          !blank(lines[i]) &&
          !_headingRe.hasMatch(lines[i]) &&
          !_checkRe.hasMatch(lines[i]) &&
          !_stepRe.hasMatch(lines[i]) &&
          !lines[i].trimLeft().startsWith('|')) {
        para.add(lines[i]);
        i++;
      }
      blocks.add(TextBlock(text: para.join('\n')));
    }

    return Note(
      id: meta['id'],
      title: title ?? 'Ohne Titel',
      type: meta['typ'] == 'rezept' ? NoteType.recipe : NoteType.note,
      servings: int.tryParse(meta['portionen'] ?? ''),
      blocks: blocks,
    );
  }

  static String _row(List<String> cells) =>
      '| ${cells.map((c) => c.replaceAll('|', r'\|').replaceAll('\n', ' ')).join(' | ')} |';

  static List<String> _cells(String line) {
    var t = line.trim();
    if (t.startsWith('|')) t = t.substring(1);
    if (t.endsWith('|') && !t.endsWith(r'\|')) t = t.substring(0, t.length - 1);
    return t
        .split(RegExp(r'(?<!\\)\|'))
        .map((c) => c.trim().replaceAll(r'\|', '|'))
        .toList();
  }

  static List<String> _fit(List<String> row, int n) {
    if (row.length == n) return row;
    if (row.length > n) return row.sublist(0, n);
    return [...row, ...List.filled(n - row.length, '')];
  }
}
