import 'package:flutter/material.dart';

import '../models/note.dart';

/// Rahmen um einen Block mit Löschen-Knopf.
class BlockCard extends StatelessWidget {
  const BlockCard({
    super.key,
    required this.block,
    required this.onChanged,
    required this.onDelete,
  });

  final Block block;
  final VoidCallback onChanged;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final b = block;
    final Widget child = switch (b) {
      HeadingBlock() => _HeadingEditor(b, onChanged),
      TextBlock() => _TextEditor(b, onChanged),
      ChecklistBlock() => _ChecklistEditor(b, onChanged),
      TableBlock() => _TableEditor(b, onChanged),
      StepsBlock() => _StepsEditor(b, onChanged),
      ImageBlock() => ListTile(
          leading: const Icon(Icons.image),
          title: Text(b.caption.isEmpty ? b.source : b.caption),
        ),
    };
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: child),
        IconButton(
          icon: const Icon(Icons.close, size: 18),
          tooltip: 'Block entfernen',
          onPressed: onDelete,
        ),
      ]),
    );
  }
}

/// Textfeld, das seinen Controller selbst verwaltet.
class _Field extends StatefulWidget {
  const _Field({
    super.key,
    required this.text,
    required this.onChanged,
    this.hint,
    this.style,
    this.multiline = false,
  });
  final String text;
  final ValueChanged<String> onChanged;
  final String? hint;
  final TextStyle? style;
  final bool multiline;

  @override
  State<_Field> createState() => _FieldState();
}

class _FieldState extends State<_Field> {
  late final _c = TextEditingController(text: widget.text);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => TextField(
        controller: _c,
        style: widget.style,
        minLines: 1,
        maxLines: widget.multiline ? null : 1,
        keyboardType: widget.multiline ? TextInputType.multiline : TextInputType.text,
        decoration: InputDecoration(
          hintText: widget.hint,
          isDense: true,
          border: InputBorder.none,
        ),
        onChanged: widget.onChanged,
      );
}

class _HeadingEditor extends StatelessWidget {
  const _HeadingEditor(this.b, this.onChanged);
  final HeadingBlock b;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => _Field(
        text: b.text,
        hint: 'Überschrift',
        style: Theme.of(context).textTheme.titleLarge,
        onChanged: (v) {
          b.text = v;
          onChanged();
        },
      );
}

class _TextEditor extends StatelessWidget {
  const _TextEditor(this.b, this.onChanged);
  final TextBlock b;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => _Field(
        text: b.text,
        hint: 'Text',
        multiline: true,
        onChanged: (v) {
          b.text = v;
          onChanged();
        },
      );
}

class _ChecklistEditor extends StatefulWidget {
  const _ChecklistEditor(this.b, this.onChanged);
  final ChecklistBlock b;
  final VoidCallback onChanged;

  @override
  State<_ChecklistEditor> createState() => _ChecklistEditorState();
}

class _ChecklistEditorState extends State<_ChecklistEditor> {
  @override
  Widget build(BuildContext context) {
    final items = widget.b.items;
    return Column(children: [
      for (final item in items)
        Row(key: ObjectKey(item), children: [
          Checkbox(
            value: item.done,
            onChanged: (v) {
              setState(() => item.done = v ?? false);
              widget.onChanged();
            },
          ),
          Expanded(
            child: _Field(
              text: item.text,
              hint: 'Eintrag',
              onChanged: (v) {
                item.text = v;
                widget.onChanged();
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.remove_circle_outline, size: 18),
            onPressed: () {
              setState(() => items.remove(item));
              widget.onChanged();
            },
          ),
        ]),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('Eintrag'),
          onPressed: () {
            setState(() => items.add(CheckItem('')));
            widget.onChanged();
          },
        ),
      ),
    ]);
  }
}

class _StepsEditor extends StatefulWidget {
  const _StepsEditor(this.b, this.onChanged);
  final StepsBlock b;
  final VoidCallback onChanged;

  @override
  State<_StepsEditor> createState() => _StepsEditorState();
}

class _StepsEditorState extends State<_StepsEditor> {
  // Stabile Schlüssel pro Schritt, damit Textfelder beim Löschen nicht verrutschen.
  late final List<Object> _keys = List.generate(widget.b.steps.length, (_) => Object());

  @override
  Widget build(BuildContext context) {
    final steps = widget.b.steps;
    return Column(children: [
      for (var i = 0; i < steps.length; i++)
        Row(
          key: ObjectKey(_keys[i]),
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 6, right: 8),
              child: CircleAvatar(radius: 12, child: Text('${i + 1}', style: const TextStyle(fontSize: 12))),
            ),
            Expanded(
              child: _Field(
                text: steps[i],
                hint: 'Schritt ${i + 1}',
                multiline: true,
                onChanged: (v) {
                  steps[i] = v;
                  widget.onChanged();
                },
              ),
            ),
            IconButton(
              icon: const Icon(Icons.remove_circle_outline, size: 18),
              onPressed: () {
                setState(() {
                  steps.removeAt(i);
                  _keys.removeAt(i);
                });
                widget.onChanged();
              },
            ),
          ],
        ),
      Align(
        alignment: Alignment.centerLeft,
        child: TextButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('Schritt'),
          onPressed: () {
            setState(() {
              steps.add('');
              _keys.add(Object());
            });
            widget.onChanged();
          },
        ),
      ),
    ]);
  }
}

class _TableEditor extends StatefulWidget {
  const _TableEditor(this.b, this.onChanged);
  final TableBlock b;
  final VoidCallback onChanged;

  @override
  State<_TableEditor> createState() => _TableEditorState();
}

class _TableEditorState extends State<_TableEditor> {
  late final List<Object> _rowKeys = List.generate(widget.b.rows.length, (_) => Object());

  @override
  Widget build(BuildContext context) {
    final b = widget.b;
    final cols = b.header.length;
    final scheme = Theme.of(context).colorScheme;

    Widget cell(Widget w, {Color? color}) => Container(
          width: 120,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: color,
            border: Border.all(color: scheme.outlineVariant, width: 0.5),
          ),
          child: w,
        );

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Column(children: [
          Row(children: [
            for (var c = 0; c < cols; c++)
              cell(
                _Field(
                  key: ValueKey('h$c${b.id}'),
                  text: b.header[c],
                  style: const TextStyle(fontWeight: FontWeight.bold),
                  onChanged: (v) {
                    b.header[c] = v;
                    widget.onChanged();
                  },
                ),
                color: scheme.surfaceContainerHighest,
              ),
            const SizedBox(width: 40),
          ]),
          for (var r = 0; r < b.rows.length; r++)
            Row(key: ObjectKey(_rowKeys[r]), children: [
              for (var c = 0; c < cols; c++)
                cell(_Field(
                  text: b.rows[r][c],
                  multiline: true,
                  onChanged: (v) {
                    b.rows[r][c] = v;
                    widget.onChanged();
                  },
                )),
              SizedBox(
                width: 40,
                child: IconButton(
                  icon: const Icon(Icons.remove_circle_outline, size: 18),
                  onPressed: () {
                    setState(() {
                      b.rows.removeAt(r);
                      _rowKeys.removeAt(r);
                    });
                    widget.onChanged();
                  },
                ),
              ),
            ]),
        ]),
      ),
      Row(children: [
        TextButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('Zeile'),
          onPressed: () {
            setState(() {
              b.rows.add(List.filled(cols, ''));
              _rowKeys.add(Object());
            });
            widget.onChanged();
          },
        ),
        TextButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('Spalte'),
          onPressed: () {
            setState(() {
              b.header.add('Spalte ${cols + 1}');
              for (final r in b.rows) {
                r.add('');
              }
            });
            widget.onChanged();
          },
        ),
      ]),
    ]);
  }
}
