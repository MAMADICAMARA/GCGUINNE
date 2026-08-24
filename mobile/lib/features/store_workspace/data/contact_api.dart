import '../../../core/network/api_client.dart';
import 'contact_models.dart';

/// Miroir (partiel — formulaire, liens communauté, vidéos tutoriel ; la
/// logique d'ouverture automatique du tutoriel après inscription/connexion
/// n'est pas reprise ici) de contact.routes.js. Jamais requireActiveStore
/// côté serveur : un compte sans boutique active doit quand même pouvoir
/// contacter la plateforme.
class ContactApi {
  const ContactApi(this._client);

  final ApiClient _client;

  Future<List<String>> getSubjectCategories() async {
    final data = await _client.get('/contact/subject-categories');
    final raw = data['categories'] as List<dynamic>? ?? [];
    return raw.cast<String>();
  }

  Future<void> createMessage({required String subject, required String message}) {
    return _client.post('/contact/messages', data: {'subject': subject, 'message': message});
  }

  /// Lecture publique (tout utilisateur authentifié) — ne montre que les
  /// liens actifs, la gestion reste réservée au Super Admin.
  Future<List<SocialLink>> getSocialLinks() async {
    final data = await _client.get('/contact/social-links');
    final raw = data['links'] as List<dynamic>? ?? [];
    return raw.map((e) => SocialLink.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<TutorialVideo>> getTutorialVideos() async {
    final data = await _client.get('/contact/tutorial');
    final raw = data['videos'] as List<dynamic>? ?? [];
    return raw.map((e) => TutorialVideo.fromJson(e as Map<String, dynamic>)).toList();
  }
}
