import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../../core/network/api_exception.dart';
import '../../data/note_models.dart';
import '../../data/notes_api.dart';

const Map<String, Color> _kColorSwatches = {
  'yellow': Color(0xFFFDE68A),
  'blue': Color(0xFFBFDBFE),
  'green': Color(0xFFA7F3D0),
  'pink': Color(0xFFFBCFE8),
  'gray': Color(0xFFCBD5E1),
};

/// Miroir de NoteEditorModal.jsx — création/édition. Retourne `true` si
/// enregistrée.
Future<bool?> showNoteEditorSheet(BuildContext context, {Note? note}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (context) => _NoteEditorSheet(note: note),
  );
}

class _NoteEditorSheet extends StatefulWidget {
  const _NoteEditorSheet({this.note});

  final Note? note;

  @override
  State<_NoteEditorSheet> createState() => _NoteEditorSheetState();
}

class _NoteEditorSheetState extends State<_NoteEditorSheet> {
  late final TextEditingController _titleController;
  late final TextEditingController _contentController;
  late String _color;
  String? _error;
  bool _submitting = false;

  bool get _isEdit => widget.note != null;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.note?.title ?? '');
    _contentController = TextEditingController(text: widget.note?.content ?? '');
    _color = widget.note?.color ?? 'yellow';
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_contentController.text.trim().isEmpty) {
      setState(() => _error = 'Le contenu de la note est requis.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final notesApi = context.read<NotesApi>();
    final title = _titleController.text.trim().isEmpty ? null : _titleController.text.trim();
    try {
      if (_isEdit) {
        await notesApi.update(id: widget.note!.id, title: title, content: _contentController.text.trim(), color: _color);
      } else {
        await notesApi.create(title: title, content: _contentController.text.trim(), color: _color);
      }
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(_isEdit ? 'Modifier la note' : 'Nouvelle note', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
              const SizedBox(height: 14),
              if (_error != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(10)),
                  child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
                ),
              TextField(
                controller: _titleController,
                maxLength: 150,
                decoration: const InputDecoration(labelText: 'Titre (optionnel)', hintText: 'Ex : Fermeture exceptionnelle', border: OutlineInputBorder()),
              ),
              TextField(
                controller: _contentController,
                autofocus: true,
                minLines: 6,
                maxLines: 10,
                decoration: const InputDecoration(labelText: 'Contenu', hintText: 'Écrivez votre note...', border: OutlineInputBorder(), alignLabelWithHint: true),
              ),
              const SizedBox(height: 12),
              const Text('Couleur', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12.5)),
              const SizedBox(height: 8),
              Row(
                children: [
                  for (final entry in _kColorSwatches.entries) ...[
                    InkWell(
                      onTap: () => setState(() => _color = entry.key),
                      customBorder: const CircleBorder(),
                      child: Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: entry.value,
                          shape: BoxShape.circle,
                          border: _color == entry.key ? Border.all(color: Theme.of(context).colorScheme.primary, width: 2.5) : null,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                ],
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                child: Text(_submitting ? 'Enregistrement...' : 'Enregistrer'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
