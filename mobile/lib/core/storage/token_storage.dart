import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persiste la session (jeton + compte + boutiques) dans le stockage
/// sécurisé natif (Keychain sur iOS, Keystore sur Android).
///
/// Contrairement à l'application web (où la session ne survit qu'en
/// mémoire tant que l'onglet reste ouvert), une application mobile doit
/// rester connectée entre deux ouvertures — c'est le comportement attendu
/// par les utilisateurs sur mobile.
class TokenStorage {
  const TokenStorage();

  static const _storage = FlutterSecureStorage();
  static const _sessionKey = 'gestion_commerciale_session';

  Future<void> writeSession(Map<String, dynamic> session) {
    return _storage.write(key: _sessionKey, value: jsonEncode(session));
  }

  Future<Map<String, dynamic>?> readSession() async {
    final raw = await _storage.read(key: _sessionKey);
    if (raw == null) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      // Session corrompue ou format obsolète : on l'ignore plutôt que de
      // faire planter le démarrage de l'application.
      return null;
    }
  }

  Future<void> clear() {
    return _storage.delete(key: _sessionKey);
  }
}
