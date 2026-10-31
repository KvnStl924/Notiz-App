import 'dart:math';

String newId() {
  final r = Random.secure();
  return List.generate(16, (_) => r.nextInt(16).toRadixString(16)).join();
}

enum NoteType { note, recipe }

/// Eine Notiz besteht aus einer Liste von Blöcken. Jeder Block hat eine
/// eigene ID, damit Änderungen später pro Block synchronisiert werden können.
class Note {
  Note({
    String? id,
    required this.title,
    this.type = NoteType.note,
    this.servings,
    List<Block>? blocks,
    DateTime? updatedAt,
  })  : id = id ?? newId(),
        blocks = blocks ?? [],
        updatedAt = updatedAt ?? DateTime.now();

  final String id;
  String title;
  NoteType type;
  int? servings;
  List<Block> blocks;
  DateTime updatedAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'type': type.name,
        'servings': servings,
        'updatedAt': updatedAt.toIso8601String(),
        'blocks': blocks.map((b) => b.toJson()).toList(),
      };

  factory Note.fromJson(Map<String, dynamic> j) => Note(
        id: j['id'] as String,
        title: j['title'] as String,
        type: NoteType.values.byName(j['type'] as String),
        servings: j['servings'] as int?,
        updatedAt: DateTime.parse(j['updatedAt'] as String),
        blocks: (j['blocks'] as List)
            .map((b) => Block.fromJson(b as Map<String, dynamic>))
            .toList(),
      );
}

sealed class Block {
  Block({String? id}) : id = id ?? newId();
  final String id;

  Map<String, dynamic> toJson();

  factory Block.fromJson(Map<String, dynamic> j) {
    final id = j['id'] as String;
    switch (j['kind']) {
      case 'heading':
        return HeadingBlock(id: id, text: j['text'] as String, level: j['level'] as int);
      case 'text':
        return TextBlock(id: id, text: j['text'] as String);
      case 'checklist':
        return ChecklistBlock(
          id: id,
          items: (j['items'] as List)
              .map((i) => CheckItem(i['text'] as String, done: i['done'] as bool))
              .toList(),
        );
      case 'table':
        return TableBlock(
          id: id,
          header: (j['header'] as List).cast<String>(),
          rows: (j['rows'] as List).map((r) => (r as List).cast<String>()).toList(),
        );
      case 'steps':
        return StepsBlock(id: id, steps: (j['steps'] as List).cast<String>());
      case 'image':
        return ImageBlock(id: id, source: j['source'] as String, caption: j['caption'] as String);
    }
    throw FormatException('Unbekannter Blocktyp: ${j['kind']}');
  }
}

class HeadingBlock extends Block {
  HeadingBlock({super.id, required this.text, this.level = 2});
  String text;
  int level;
  @override
  Map<String, dynamic> toJson() => {'kind': 'heading', 'id': id, 'text': text, 'level': level};
}

class TextBlock extends Block {
  TextBlock({super.id, required this.text});
  String text;
  @override
  Map<String, dynamic> toJson() => {'kind': 'text', 'id': id, 'text': text};
}

class CheckItem {
  CheckItem(this.text, {this.done = false});
  String text;
  bool done;
}

class ChecklistBlock extends Block {
  ChecklistBlock({super.id, List<CheckItem>? items}) : items = items ?? [];
  List<CheckItem> items;
  @override
  Map<String, dynamic> toJson() => {
        'kind': 'checklist',
        'id': id,
        'items': items.map((i) => {'text': i.text, 'done': i.done}).toList(),
      };
}

class TableBlock extends Block {
  TableBlock({super.id, required this.header, List<List<String>>? rows}) : rows = rows ?? [];
  List<String> header;
  List<List<String>> rows;
  @override
  Map<String, dynamic> toJson() =>
      {'kind': 'table', 'id': id, 'header': header, 'rows': rows};
}

/// Nummerierte Schritt-für-Schritt-Anleitung.
class StepsBlock extends Block {
  StepsBlock({super.id, List<String>? steps}) : steps = steps ?? [];
  List<String> steps;
  @override
  Map<String, dynamic> toJson() => {'kind': 'steps', 'id': id, 'steps': steps};
}

class ImageBlock extends Block {
  ImageBlock({super.id, required this.source, this.caption = ''});
  /// Lokaler Dateipfad oder URL.
  String source;
  String caption;
  @override
  Map<String, dynamic> toJson() =>
      {'kind': 'image', 'id': id, 'source': source, 'caption': caption};
}
