import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/note.dart';

/// Lokaler Speicher (local-first). Läuft im Browser (localStorage) und nativ.
/// Später kommt der Firestore-Abgleich über dieselbe Schnittstelle dazu.
class NoteStore extends ChangeNotifier {
  static const _key = 'notes_v1';

  final Map<String, Note> _notes = {};
  SharedPreferences? _prefs;

  List<Note> get notes {
    final l = _notes.values.toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return l;
  }

  Note? byId(String id) => _notes[id];

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    if (raw != null) {
      for (final j in jsonDecode(raw) as List) {
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

  Future<void> _flush() => _prefs!
      .setString(_key, jsonEncode(_notes.values.map((n) => n.toJson()).toList()));
}
