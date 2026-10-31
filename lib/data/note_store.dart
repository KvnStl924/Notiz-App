import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';

import '../models/note.dart';

/// Lokaler Speicher (local-first). Später kommt der Firestore-Abgleich
/// über dieselbe Schnittstelle dazu.
class NoteStore extends ChangeNotifier {
  NoteStore([this._file]);

  File? _file;
  final Map<String, Note> _notes = {};

  List<Note> get notes {
    final l = _notes.values.toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return l;
  }

  Note? byId(String id) => _notes[id];

  Future<void> load() async {
    _file ??= File('${(await getApplicationDocumentsDirectory()).path}/notes.json');
    if (await _file!.exists()) {
      final list = jsonDecode(await _file!.readAsString()) as List;
      for (final j in list) {
        final n = Note.fromJson(j as Map<String, dynamic>);
        _notes[n.id] = n;
      }
    }
    notifyListeners();
  }

  /// Speichert eine neue oder geänderte Notiz.
  Future<void> save(Note note) async {
    note.updatedAt = DateTime.now();
    _notes[note.id] = note;
    notifyListeners();
    await _flush();
  }

  Future<void> delete(String id) async {
    _notes.remove(id);
    notifyListeners();
    await _flush();
  }

  Future<void> _flush() async {
    final tmp = File('${_file!.path}.tmp');
    await tmp.writeAsString(jsonEncode(_notes.values.map((n) => n.toJson()).toList()));
    await tmp.rename(_file!.path);
  }
}
