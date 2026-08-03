/// Configuration centrale de l'application.
///
/// L'URL de l'API peut être surchargée au lancement sans recompiler :
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:4000/api/v1
///
/// Valeurs par défaut selon l'environnement de test :
/// - Émulateur Android : 10.0.2.2 pointe vers le "localhost" de la machine
///   hôte (celle qui fait tourner le backend Node).
/// - Simulateur iOS : "localhost" fonctionne directement, pas besoin de
///   surcharger.
/// - Appareil physique (téléphone réel) : "localhost" et "10.0.2.2" ne
///   fonctionnent PAS. Il faut l'adresse IP locale de la machine qui fait
///   tourner le backend (ex: http://192.168.1.10:4000/api/v1), et le
///   téléphone doit être sur le même réseau Wi-Fi.
class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );
}
