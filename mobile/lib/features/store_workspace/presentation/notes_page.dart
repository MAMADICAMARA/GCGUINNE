import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../../core/utils/formatters.dart';
import '../data/note_models.dart';
import '../data/notes_api.dart';
import 'notes/note_editor_sheet.dart';

const Map<String, Color> _kNoteBg = {
  'yellow': Color(0xFFFFFBEB),
  'blue': Color(0xFFEFF6FF),
  'green': Color(0xFFECFDF5),
  'pink': Color(0xFFFDF2F8),
  'gray': Color(0xFFF1F5F9),
};

const Map<String, Color> _kNoteBorder = {
  'yellow': Color(0xFFFDE68A),
  'blue': Color(0xFFBFDBFE),
  'green': Color(0xFFA7F3D0),
  'pink': Color(0xFFFBCFE8),
  'gray': Color(0xFFE2E8F0),
};

/// Miroir de NotesPage.jsx — bloc-note partagé de la boutique, ouvert à
/// toute l'équipe (Owner ET Vendeur). Cartes en liste simple (pas de
/// grille) : le contenu d'une note est un texte libre de longueur très
/// variable, une hauteur de grille fixe reproduirait exactement le genre
/// de débordement déjà corrigé ailleurs.
class NotesPage extends StatefulWidget {
  const NotesPage({super.key});

  @override
  State<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends State<NotesPage> {
  List<Note>? _notes;
  String? _error;
  String _search = '';
  Timer? _debounce;
  int? _busyId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final notes = await context.read<NotesApi>().list(search: _search);
      if (!mounted) return;
      setState(() {
        _notes = notes;
        _error = null;
      });
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    setState(() => _search = value);
    _debounce = Timer(const Duration(milliseconds: 250), _load);
  }

  Future<void> _togglePin(Note note) async {
    setState(() => _busyId = note.id);
    try {
      await context.read<NotesApi>().togglePin(note.id);
      await _load();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _delete(Note note) async {
    final notesApi = context.read<NotesApi>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Supprimer cette note ?'),
        content: const Text('Cette action est irréversible.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: const Text('Annuler')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade600),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Supprimer'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyId = note.id);
    try {
      await notesApi.delete(note.id);
      await _load();
    } on ApiException catch (err) {
      if (mounted) setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _openEditor({Note? note}) async {
    final saved = await showNoteEditorSheet(context, note: note);
    if (saved == true) _load();
  }

  @override
  Widget build(BuildContext context) {
    final notes = _notes;
    return Scaffold(
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openEditor(),
        icon: const Icon(Icons.add),
        label: const Text('Nouvelle note'),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 90),
          children: [
            Text('Bloc-note partagé de la boutique — visible par toute l\'équipe.', style: TextStyle(fontSize: 12.5, color: Colors.grey.shade500)),
            const SizedBox(height: 12),
            TextField(
              onChanged: _onSearchChanged,
              decoration: const InputDecoration(
                hintText: 'Rechercher dans les notes...',
                prefixIcon: Icon(Icons.search, size: 20),
                border: OutlineInputBorder(),
                isDense: true,
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              ),
            ),
            const SizedBox(height: 14),
            if (_error != null)
              Padding(padding: const EdgeInsets.only(bottom: 12), child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13))),
            if (notes == null)
              const Padding(padding: EdgeInsets.only(top: 40), child: Center(child: CircularProgressIndicator()))
            else if (notes.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 48),
                child: Column(
                  children: [
                    Icon(Icons.notes_outlined, size: 40, color: Colors.grey.shade300),
                    const SizedBox(height: 10),
                    Text(
                      _search.isNotEmpty ? 'Aucune note ne correspond à votre recherche.' : "Aucune note pour l'instant.",
                      style: TextStyle(color: Colors.grey.shade500),
                    ),
                  ],
                ),
              )
            else
              for (final note in notes)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: _NoteCard(
                    note: note,
                    busy: _busyId == note.id,
                    onTogglePin: () => _togglePin(note),
                    onEdit: () => _openEditor(note: note),
                    onDelete: () => _delete(note),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _NoteCard extends StatelessWidget {
  const _NoteCard({required this.note, required this.busy, required this.onTogglePin, required this.onEdit, required this.onDelete});

  final Note note;
  final bool busy;
  final VoidCallback onTogglePin;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final bg = _kNoteBg[note.color] ?? _kNoteBg['yellow']!;
    final border = _kNoteBorder[note.color] ?? _kNoteBorder['yellow']!;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(14), border: Border.all(color: border)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: note.title != null && note.title!.isNotEmpty
                    ? Text(note.title!, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5))
                    : const SizedBox.shrink(),
              ),
              InkWell(
                onTap: busy ? null : onTogglePin,
                customBorder: const CircleBorder(),
                child: Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: note.isPinned ? Colors.blueGrey.shade700 : Colors.transparent, shape: BoxShape.circle),
                  child: Icon(
                    note.isPinned ? Icons.push_pin : Icons.push_pin_outlined,
                    size: 15,
                    color: note.isPinned ? Colors.white : Colors.grey.shade500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(note.content, style: const TextStyle(fontSize: 13.5, height: 1.35)),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.only(top: 8),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: Colors.black.withValues(alpha: 0.06)))),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    '${note.authorName != null ? '${note.authorName} · ' : ''}${formatDateTime(note.updatedAt)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 10.5, color: Colors.grey.shade500),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: busy ? null : onEdit,
                  child: Text('Modifier', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
                ),
                const SizedBox(width: 12),
                InkWell(
                  onTap: busy ? null : onDelete,
                  child: Text('Supprimer', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Colors.red.shade400)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
