import 'package:flutter/foundation.dart';

import '../core/storage/token_storage.dart';
import 'models/store.dart';
import 'models/user.dart';

/// État global d'authentification et de contexte boutique.
/// Miroir de frontend/src/store/authStore.js (Zustand), avec en plus la
/// persistance de session (nécessaire sur mobile — voir TokenStorage).
///
/// Rappel d'architecture (cahier des charges §4.1 vs §4.2, §6.1) :
/// - Un compte peut exister sans boutique.
/// - `activeStore` représente la boutique actuellement sélectionnée ;
///   toute donnée affichée dans l'espace "boutique" en dépend.
/// - La vérité sur les permissions reste toujours contrôlée côté serveur.
class AuthState extends ChangeNotifier {
  AuthState(this._tokenStorage);

  final TokenStorage _tokenStorage;

  String? token;
  AppUser? user;
  List<StoreRef> stores = <StoreRef>[];
  StoreRef? activeStore;

  /// true tant que la tentative de restauration de session au démarrage
  /// n'est pas terminée (voir main.dart, qui attend [restore] avant
  /// d'appeler runApp).
  bool isRestoring = true;

  bool get isAuthenticated => token != null;

  /// Applique le résultat de /auth/register ou /auth/login.
  void setSession(Map<String, dynamic> json) {
    token = json['token'] as String;
    user = AppUser.fromJson(json['user'] as Map<String, dynamic>);
    stores = _parseStores(json['stores']);
    activeStore = stores.length == 1 ? stores.first : null;
    _persist();
    notifyListeners();
  }

  /// Applique le résultat de /auth/switch-store ou de POST /stores
  /// (création de boutique) : nouveau jeton + boutique désormais active.
  void applyStoreSwitch(Map<String, dynamic> json) {
    token = json['token'] as String;
    activeStore = StoreRef.fromJson(json['activeStore'] as Map<String, dynamic>);
    if (json['stores'] != null) {
      stores = _parseStores(json['stores']);
    }
    _persist();
    notifyListeners();
  }

  /// Rafraîchit simplement la liste des boutiques (GET /stores/mine),
  /// sans toucher au jeton ni à la boutique active.
  void setStores(List<StoreRef> newStores) {
    stores = newStores;
    _persist();
    notifyListeners();
  }

  Future<void> logout() async {
    token = null;
    user = null;
    stores = <StoreRef>[];
    activeStore = null;
    await _tokenStorage.clear();
    notifyListeners();
  }

  /// Restaure la session depuis le stockage sécurisé au démarrage de
  /// l'application. À appeler une seule fois, avant runApp.
  Future<void> restore() async {
    final saved = await _tokenStorage.readSession();
    if (saved != null) {
      token = saved['token'] as String?;
      final userJson = saved['user'];
      if (userJson != null) {
        user = AppUser.fromJson(userJson as Map<String, dynamic>);
      }
      stores = _parseStores(saved['stores']);
      final activeJson = saved['activeStore'];
      if (activeJson != null) {
        activeStore = StoreRef.fromJson(activeJson as Map<String, dynamic>);
      }
    }
    isRestoring = false;
    notifyListeners();
  }

  List<StoreRef> _parseStores(Object? raw) {
    if (raw is! List) return <StoreRef>[];
    return raw
        .map((e) => StoreRef.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> _persist() async {
    await _tokenStorage.writeSession({
      'token': token,
      'user': user?.toJson(),
      'stores': stores.map((s) => s.toJson()).toList(),
      'activeStore': activeStore?.toJson(),
    });
  }
}
