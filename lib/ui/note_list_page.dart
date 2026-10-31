import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/note_store.dart';
import '../models/note.dart';
import 'note_editor_page.dart';

class NoteListPage extends StatefulWidget {
  const NoteListPage({super.key});

  @override
  State<NoteListPage> createState() => _NoteListPageState();
}

class _NoteListPageState extends State<NoteListPage> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final store = context.watch<NoteStore>();
    final q = _query.toLowerCase();
    final notes = store.notes.where((n) => n.title.toLowerCase().contains(q)).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Notizen')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: SearchBar(
              hintText: 'Suchen',
              leading: const Icon(Icons.search),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: notes.isEmpty
                ? const Center(child: Text('Noch keine Notizen'))
                : ListView.builder(
                    itemCount: notes.length,
                    itemBuilder: (_, i) => _NoteTile(note: notes[i]),
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        icon: const Icon(Icons.add),
        label: const Text('Neu'),
        onPressed: () => _create(context),
      ),
    );
  }

  Future<void> _create(BuildContext context) async {
    final type = await showModalBottomSheet<NoteType>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.restaurant_menu),
            title: const Text('Rezept'),
            subtitle: const Text('Zutaten-Tabelle und Schritt-für-Schritt-Anleitung'),
            onTap: () => Navigator.pop(context, NoteType.recipe),
          ),
          ListTile(
            leading: const Icon(Icons.notes),
            title: const Text('Notiz'),
            onTap: () => Navigator.pop(context, NoteType.note),
          ),
        ]),
      ),
    );
    if (type == null || !context.mounted) return;

    final note = Note(
      title: '',
      type: type,
      servings: type == NoteType.recipe ? 4 : null,
      blocks: type == NoteType.recipe
          ? [
              HeadingBlock(text: 'Zutaten'),
              TableBlock(header: ['Menge', 'Einheit', 'Zutat'], rows: [
                ['', '', '']
              ]),
              HeadingBlock(text: 'Zubereitung'),
              StepsBlock(steps: ['']),
            ]
          : [TextBlock(text: '')],
    );
    await context.read<NoteStore>().save(note);
    if (!context.mounted) return;
    Navigator.push(context, MaterialPageRoute(builder: (_) => NoteEditorPage(noteId: note.id)));
  }
}

class _NoteTile extends StatelessWidget {
  const _NoteTile({required this.note});
  final Note note;

  @override
  Widget build(BuildContext context) {
    return Dismissible(
      key: ValueKey(note.id),
      direction: DismissDirection.endToStart,
      background: Container(
        color: Theme.of(context).colorScheme.errorContainer,
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 24),
        child: const Icon(Icons.delete),
      ),
      confirmDismiss: (_) async =>
          await showDialog<bool>(
            context: context,
            builder: (c) => AlertDialog(
              title: const Text('Notiz löschen?'),
              content: Text('„${note.title.isEmpty ? 'Ohne Titel' : note.title}“ wird gelöscht.'),
              actions: [
                TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Abbrechen')),
                FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Löschen')),
              ],
            ),
          ) ??
          false,
      onDismissed: (_) => context.read<NoteStore>().delete(note.id),
      child: ListTile(
        leading: Icon(note.type == NoteType.recipe ? Icons.restaurant_menu : Icons.notes),
        title: Text(note.title.isEmpty ? 'Ohne Titel' : note.title),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => NoteEditorPage(noteId: note.id)),
        ),
      ),
    );
  }
}
