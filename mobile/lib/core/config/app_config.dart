/// Configuration centrale de l'application.
///
/// Par défaut, l'app pointe vers le backend de PRODUCTION déjà déployé sur
/// Render (§ décidé en conversation, préparation de la publication Play
/// Store) — un lancement normal (bouton Run d'Android Studio, build de
/// release...) doit toujours joindre le vrai serveur, jamais une adresse
/// utilisable seulement en développement.
///
/// Pour tester en LOCAL contre un backend lancé sur sa propre machine,
/// surcharger explicitement au lancement, sans recompiler :
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:4000/api/v1
///
/// Rappel des adresses de dev selon l'environnement (jamais utilisées sans
/// cette surcharge explicite) :
/// - Web (Chrome, Edge...) : http://localhost:4000/api/v1 (même machine que
///   le backend, pas d'émulateur entre les deux).
/// - Émulateur Android : http://10.0.2.2:4000/api/v1 (10.0.2.2 pointe vers
///   le "localhost" de la machine hôte).
/// - Appareil physique (téléphone réel) : "localhost" et "10.0.2.2" ne
///   fonctionnent PAS — il faut l'adresse IP locale de la machine qui fait
///   tourner le backend (ex: http://192.168.1.10:4000/api/v1), et le
///   téléphone doit être sur le même réseau Wi-Fi.
class AppConfig {
  AppConfig._();

  static const String _override = String.fromEnvironment('API_BASE_URL');
  static const String _productionApiBaseUrl =
      'https://gestion-commerciale-backend.onrender.com/api/v1';

  static String get apiBaseUrl {
    if (_override.isNotEmpty) return _override;
    return _productionApiBaseUrl;
  }

  // URL publique du frontend web de production (§ cahier des charges
  // "Système de notification de mise à jour", décidé en conversation) —
  // sert uniquement à construire le lien vers /telecharger ouvert dans le
  // navigateur externe du téléphone (jamais un appel API, juste une page à
  // afficher). Même mécanisme de surcharge que API_BASE_URL ci-dessus :
  //   flutter run --dart-define=FRONTEND_URL=http://192.168.1.10:5173
  static const String _frontendUrlOverride = String.fromEnvironment('FRONTEND_URL');
  static const String _productionFrontendUrl = 'https://gcguinee224.com';

  static String get frontendUrl {
    if (_frontendUrlOverride.isNotEmpty) return _frontendUrlOverride;
    return _productionFrontendUrl;
  }
}
