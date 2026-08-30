import 'package:flutter/foundation.dart';

import '../core/storage/token_storage.dart';
import '../features/account/data/stores_api.dart' show PlanBanner;
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

  /// Un Vendeur (jamais consulté pour l'Owner, toujours implicitement vrai)
  /// peut-il annuler/retourner SES PROPRES ventes ?
  /// (§25_autorisation_annulation_retour.sql). Peuplé une fois par
  /// StoreShell à l'entrée dans l'espace boutique (GET
  /// /stores/my-void-return-permission), jamais persisté — donnée dérivée,
  /// toujours rechargée fraîche plutôt que risquer d'afficher une
  /// autorisation périmée (même logique que authStore.js côté web).
  bool canVoidReturn = false;

  /// Un Vendeur (jamais consulté pour l'Owner, toujours implicitement vrai)
  /// peut-il saisir un prix de vente différent du prix catalogue à la
  /// Caisse ? (§39_prix_editable_vente.sql). Même précédent exact que
  /// canVoidReturn ci-dessus.
  bool canEditPrice = false;

  /// Un Vendeur (jamais consulté pour l'Owner, toujours implicitement vrai)
  /// peut-il créer un nouveau produit ? (§40_autorisation_ajout_produit.sql).
  /// Même précédent exact que canVoidReturn/canEditPrice ci-dessus.
  bool canAddProduct = false;

  /// Un Vendeur peut-il ajuster le stock / utiliser le module Fournisseurs /
  /// utiliser le module Achats ?
  /// (§43_autorisation_stock_fournisseurs_achats.sql). Même précédent exact
  /// que canVoidReturn/canEditPrice/canAddProduct ci-dessus.
  bool canManageStock = false;
  bool canManageSuppliers = false;
  bool canManagePurchases = false;

  /// Bandeau "boutique en mode gratuit" (§20_plans_abonnement.sql, décidé
  /// en conversation) — peuplé une fois par StoreShell à l'entrée dans
  /// l'espace boutique (GET /stores/plan-banner, accessible à toute
  /// l'équipe), jamais persisté. Miroir de authStore.js#planBanner.
  PlanBanner? planBanner;

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
    // Donnée dérivée de la boutique précédente, jamais reportée sur la
    // nouvelle — StoreShell la recharge fraîche à l'entrée dans l'espace
    // boutique (même logique que authStore.js#applyStoreSwitch côté web).
    canVoidReturn = false;
    canEditPrice = false;
    canAddProduct = false;
    canManageStock = false;
    canManageSuppliers = false;
    canManagePurchases = false;
    planBanner = null;
    _persist();
    notifyListeners();
  }

  /// Reflète immédiatement un profil modifié (§ décidé en conversation,
  /// ProfilePage) — même principe que applyStoreSwitch, jamais besoin de
  /// recharger l'app ou de se reconnecter.
  void setUser(AppUser newUser) {
    user = newUser;
    _persist();
    notifyListeners();
  }

  /// Remplace le jeton après un changement de mot de passe depuis une
  /// session déjà connectée — le backend renvoie un nouveau jeton pour que
  /// CETTE session continue sans forcer une reconnexion, même si les
  /// AUTRES sessions ouvertes ailleurs sont invalidées côté serveur.
  void setToken(String newToken) {
    token = newToken;
    _persist();
    notifyListeners();
  }

  /// Reflète immédiatement un nouveau taux de taxe par défaut (§ Facturation,
  /// décidé en conversation) — même principe que setUser ci-dessus : la
  /// Caisse lit `activeStore.defaultTaxPercent` à l'ouverture d'une vente,
  /// jamais besoin de se reconnecter pour voir le nouveau réglage.
  void updateActiveStoreDefaultTaxPercent(num value) {
    if (activeStore == null) return;
    activeStore = activeStore!.copyWith(defaultTaxPercent: value);
    _persist();
    notifyListeners();
  }

  void setCanVoidReturn(bool value) {
    canVoidReturn = value;
    notifyListeners();
  }

  void setCanEditPrice(bool value) {
    canEditPrice = value;
    notifyListeners();
  }

  void setCanAddProduct(bool value) {
    canAddProduct = value;
    notifyListeners();
  }

  void setCanManageStock(bool value) {
    canManageStock = value;
    notifyListeners();
  }

  void setCanManageSuppliers(bool value) {
    canManageSuppliers = value;
    notifyListeners();
  }

  void setCanManagePurchases(bool value) {
    canManagePurchases = value;
    notifyListeners();
  }

  void setPlanBanner(PlanBanner value) {
    planBanner = value;
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
    canVoidReturn = false;
    canEditPrice = false;
    canAddProduct = false;
    canManageStock = false;
    canManageSuppliers = false;
    canManagePurchases = false;
    planBanner = null;
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
