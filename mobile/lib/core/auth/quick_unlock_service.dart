import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

/// Déclenche le verrou NATIF du téléphone (§ décidé en conversation,
/// déverrouillage rapide) — jamais réimplémenté ici : c'est l'OS qui gère
/// l'écran (empreinte, visage, ou repli PIN/schéma/mot de passe de
/// l'appareil), on ne fait que lire son verdict oui/non.
class QuickUnlockService {
  const QuickUnlockService();

  static final _auth = LocalAuthentication();

  /// true si l'appareil a un verrou utilisable — biométrie enrôlée OU un
  /// verrou d'appareil (code/schéma/mot de passe) configuré. Sans ça,
  /// inutile de proposer le déverrouillage rapide : il n'y a rien à
  /// vérifier.
  Future<bool> isDeviceSupported() async {
    try {
      return await _auth.isDeviceSupported();
    } on PlatformException {
      return false;
    }
  }

  /// biometricOnly: false (décidé en conversation : pas seulement
  /// l'empreinte) — accepte aussi le repli natif code/schéma/mot de passe
  /// de l'appareil si la biométrie échoue ou n'est pas enrôlée.
  /// stickyAuth: true — l'invite reste active si l'app repasse brièvement
  /// en arrière-plan pendant l'affichage du verrou système lui-même.
  Future<bool> authenticate(String reason) async {
    try {
      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
        ),
      );
    } on PlatformException {
      return false;
    }
  }
}
