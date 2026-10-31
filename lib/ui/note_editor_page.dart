import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/note_store.dart';
import '../models/note.dart';
import 'block_widgets.dart';

class NoteEditorPage extends StatefulWidget {
  const NoteEditorPage({super.key, required this.noteId});
  final String noteId;

  @override
  State<NoteEditorPage> createState() => _NoteEditorPageState();
}

class _NoteEditorPageState extends State<NoteEditorPage> {
  late final NoteStore _store;
  late final Note _note;
  late final TextEditingController _title;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _store = context.read<NoteStore>();
    _note = _store.byId(widget.noteId)!;
    _title = TextEditingController(text: _note.title);
  }

  /// Speichert kurz nach der letzten Änderung.
  void _changed() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => _store.save(_note));
  }

  @override
  void dispose() {
    if (_debounce?.isActive ?? false) {
      _debounce!.cancel();
      _store.save(_note);
    }
    _title.dispose();
    super.dispose();
  }

  void _add(Block b) {
    setState(() => _note.blocks.add(b));
    _changed();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_note.type == NoteType.recipe ? 'Rezept' : 'Notiz'),
        actions: [
          PopupMenuButton<Block Function()>(
            icon: const Icon(Icons.add),
            tooltip: 'Block hinzufügen',
            onSelected: (make) => _add(make()),
            itemBuilder: (_) => [
              PopupMenuItem(value: () => HeadingBlock(text: ''), child: const Text('Überschrift')),
              PopupMenuItem(value: () => TextBlock(text: ''), child: const Text('Text')),
              PopupMenuItem(
                  value: () => ChecklistBlock(items: [CheckItem('')]),
                  child: const Text('Checkliste')),
              PopupMenuItem(
                  value: () => TableBlock(header: ['Spalte 1', 'Spalte 2'], rows: [
                        ['', '']
                      ]),
                  child: const Text('Tabelle')),
              PopupMenuItem(
                  value: () => StepsBlock(steps: ['']), child: const Text('Schritt-für-Schritt')),
            ],
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
        children: [
          TextField(
            controller: _title,
            style: Theme.of(context).textTheme.headlineMedium,
            decoration: const InputDecoration(hintText: 'Titel', border: InputBorder.none),
            onChanged: (v) {
              _note.title = v;
              _changed();
            },
          ),
          if (_note.type == NoteType.recipe) _servings(),
          for (final b in _note.blocks)
            BlockCard(
              key: ValueKey(b.id),
              block: b,
              onChanged: _changed,
              onDelete: () {
                setState(() => _note.blocks.remove(b));
                _changed();
              },
            ),
        ],
      ),
    );
  }

  Widget _servings() => Row(children: [
        const Text('Portionen'),
        IconButton(
          icon: const Icon(Icons.remove),
          onPressed: () {
            if ((_note.servings ?? 1) > 1) {
              setState(() => _note.servings = _note.servings! - 1);
              _changed();
            }
          },
        ),
        Text('${_note.servings ?? 1}'),
        IconButton(
          icon: const Icon(Icons.add),
          onPressed: () {
            setState(() => _note.servings = (_note.servings ?? 1) + 1);
            _changed();
          },
        ),
      ]);
}
