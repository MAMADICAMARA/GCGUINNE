import '../../../core/network/api_client.dart';
import 'note_models.dart';

/// Miroir de notes.routes.js — carnet partagé par toute l'équipe de la
/// boutique (Owner ET Vendeur, contrairement aux écrans réservés à
/// l'Owner) : création, édition, épinglage et suppression accessibles à
/// n'importe quel membre, sur n'importe quelle note.
class NotesApi {
  const NotesApi(this._client);

  final ApiClient _client;

  Future<List<Note>> list({String? search}) async {
    final data = await _client.get('/notes', query: search != null && search.trim().isNotEmpty ? {'search': search.trim()} : null);
    final raw = data['notes'] as List<dynamic>? ?? [];
    return raw.map((e) => Note.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Note> create({String? title, required String content, required String color}) async {
    final data = await _client.post('/notes', data: {'title': title, 'content': content, 'color': color});
    return Note.fromJson(data);
  }

  /// Remplacement complet (jamais une fusion partielle) — évite toute
  /// ambiguïté entre "champ non fourni" et "champ vidé volontairement".
  Future<Note> update({required int id, String? title, required String content, required String color}) async {
    final data = await _client.put('/notes/$id', data: {'title': title, 'content': content, 'color': color});
    return Note.fromJson(data);
  }

  Future<void> togglePin(int id) => _client.post('/notes/$id/toggle-pin');

  Future<void> delete(int id) => _client.delete('/notes/$id');
}
