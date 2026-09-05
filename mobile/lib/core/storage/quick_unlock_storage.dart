import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Identifiants enregistrés pour le déverrouillage rapide (§ décidé en
/// conversation) — même mécanisme de stockage que TokenStorage (Keychain
/// iOS / Keystore Android), mais sous une clé DISTINCTE de la session :
/// AuthState.logout() n'efface que la session, jamais ces identifiants
/// (une déconnexion ne doit pas désactiver le déverrouillage rapide, comme
/// dans une app bancaire — seul le réglage dédié dans "Paramètres du
/// compte" le fait).
///
/// L'appareil déverrouille (empreinte, visage, PIN, schéma — cf.
/// QuickUnlockService) uniquement l'ACCÈS à ces identifiants, qui servent
/// ensuite à un vrai POST /auth/login — jamais une connexion "silencieuse"
/// côté serveur, pour préserver le journal d'audit du Super Admin.
class QuickUnlockStorage {
  const QuickUnlockStorage();

  static const _storage = FlutterSecureStorage();
  static const _key = 'gestion_commerciale_quick_unlock';

  Future<void> save({required String email, required String password}) {
    return _storage.write(
      key: _key,
      value: jsonEncode({'email': email, 'password': password}),
    );
  }

  /// Retourne (email, password), ou null si jamais activé / corrompu.
  Future<(String, String)?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    try {
      final json = jsonDecode(raw) as Map<String, dynamic>;
      final email = json['email'] as String?;
      final password = json['password'] as String?;
      if (email == null || password == null) return null;
      return (email, password);
    } catch (_) {
      return null;
    }
  }

  Future<bool> get isEnabled async => (await read()) != null;

  Future<void> clear() => _storage.delete(key: _key);
}
