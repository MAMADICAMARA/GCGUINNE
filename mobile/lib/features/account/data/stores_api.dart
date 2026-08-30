import '../../../core/network/api_client.dart';
import '../../../state/models/store.dart';
import '../../store_workspace/data/settings_models.dart';

/// Miroir de la logique de MyStorePage.jsx côté web.
class StoresApi {
  const StoresApi(this._client);

  final ApiClient _client;

  /// GET /stores/mine — toujours interrogé en base (jamais déduit du
  /// jeton, potentiellement périmé après création d'une boutique ailleurs).
  Future<List<StoreRef>> listMine() async {
    final data = await _client.get('/stores/mine');
    final raw = data['stores'] as List<dynamic>? ?? <dynamic>[];
    return raw.map((e) => StoreRef.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// POST /stores — création d'une boutique (première ou supplémentaire).
  /// Retourne { token, activeStore, stores } : la nouvelle boutique
  /// devient immédiatement active (cf. §4.2 du cahier des charges). Miroir
  /// exact du contrat serveur (stores.routes.js) — name et storeTypeId
  /// requis, le reste optionnel.
  Future<Map<String, dynamic>> create({
    required String name,
    required int storeTypeId,
    String? country,
    String? region,
    String? city,
    String? address,
    String? phone,
  }) {
    return _client.post('/stores', data: {
      'name': name,
      'storeTypeId': storeTypeId,
      if (country != null && country.isNotEmpty) 'country': country,
      if (region != null && region.isNotEmpty) 'region': region,
      if (city != null && city.isNotEmpty) 'city': city,
      if (address != null && address.isNotEmpty) 'address': address,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
  }

  /// GET /stores/plan-status — plan EFFECTIF de la boutique active (jamais
  /// mis en cache côté serveur : recalculé à chaque appel, un abonnement
  /// pouvant expirer en cours de session). Owner uniquement.
  Future<PlanStatus> getPlanStatus() async {
    final data = await _client.get('/stores/plan-status');
    return PlanStatus.fromJson(data);
  }

  Future<String?> getSupervisionCode() async {
    final data = await _client.get('/stores/supervision-code');
    return data['supervisionCode'] as String?;
  }

  Future<String> regenerateSupervisionCode() async {
    final data = await _client.post('/stores/supervision-code/regenerate');
    return data['supervisionCode'] as String;
  }

  Future<String?> getSupplierCode() async {
    final data = await _client.get('/stores/supplier-code');
    return data['supplierCode'] as String?;
  }

  Future<String> regenerateSupplierCode() async {
    final data = await _client.post('/stores/supplier-code/regenerate');
    return data['supplierCode'] as String;
  }

  /// {storeTypeId, storeTypeLabel} — les deux sont null tant qu'aucun type
  /// n'a été adopté (boutiques créées avant cette fonctionnalité).
  Future<(int?, String?)> getStoreType() async {
    final data = await _client.get('/stores/type');
    return (data['storeTypeId'] as int?, data['storeTypeLabel'] as String?);
  }

  Future<List<StoreTypeOption>> listStoreTypes() async {
    final data = await _client.get('/stores/types');
    final raw = data['storeTypes'] as List<dynamic>? ?? [];
    return raw.map((e) => StoreTypeOption.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Définitif une fois enregistré — pas de re-changement possible côté
  /// serveur (cf. stores.service.js#adoptStoreType).
  Future<Map<String, dynamic>> adoptStoreType(int storeTypeId) {
    return _client.put('/stores/type', data: {'storeTypeId': storeTypeId});
  }

  /// Informations générales de la boutique (§ décidé en conversation, "tout
  /// modifiable sauf l'e-mail") — miroir de GET/PUT /stores/info. Owner
  /// uniquement (déjà vérifié côté serveur, requireRole('OWNER')).
  Future<StoreInfo> getStoreInfo() async {
    final data = await _client.get('/stores/info');
    return StoreInfo.fromJson(data);
  }

  Future<StoreInfo> updateStoreInfo(StoreInfo info) async {
    final data = await _client.put('/stores/info', data: info.toJson());
    return StoreInfo.fromJson(data);
  }

  Future<String?> getLogo() async {
    final data = await _client.get('/stores/logo');
    return data['logoUrl'] as String?;
  }

  Future<String?> updateLogo(String? logoUrl) async {
    final data = await _client.put('/stores/logo', data: {'logoUrl': logoUrl});
    return data['logoUrl'] as String?;
  }

  Future<(ReceiptSettings, StoreContactInfo)> getReceiptSettings() async {
    final data = await _client.get('/stores/receipt-settings');
    return (ReceiptSettings.fromJson(data), StoreContactInfo.fromJson(data['store'] as Map<String, dynamic>? ?? {}));
  }

  Future<ReceiptSettings> updateReceiptSettings(ReceiptSettings settings) async {
    final data = await _client.put('/stores/receipt-settings', data: settings.toJson());
    return ReceiptSettings.fromJson(data);
  }

  Future<BillingSettings> getBillingSettings() async {
    final data = await _client.get('/stores/billing-settings');
    return BillingSettings.fromJson(data);
  }

  Future<BillingSettings> updateBillingSettings(BillingSettings settings) async {
    final data = await _client.put('/stores/billing-settings', data: settings.toJson());
    return BillingSettings.fromJson(data);
  }

  Future<bool> getVoidReturnSettings() async {
    final data = await _client.get('/stores/void-return-settings');
    return data['allowAllSellers'] as bool? ?? false;
  }

  Future<bool> updateVoidReturnSettings(bool allowAllSellers) async {
    final data = await _client.put('/stores/void-return-settings', data: {'allowAllSellers': allowAllSellers});
    return data['allowAllSellers'] as bool? ?? false;
  }

  /// GET /stores/my-void-return-permission — accessible à tout rôle,
  /// mais n'a d'intérêt qu'à interroger pour un Vendeur (l'Owner peut
  /// toujours annuler/retourner, cf. stores.service.js#canUserVoidReturn).
  Future<bool> getMyVoidReturnPermission() async {
    final data = await _client.get('/stores/my-void-return-permission');
    return data['allowed'] as bool? ?? false;
  }

  /// Miroir exact des trois méthodes ci-dessus, pour le prix modifiable à
  /// la Caisse (§39_prix_editable_vente.sql, décidé en conversation).
  Future<bool> getEditPriceSettings() async {
    final data = await _client.get('/stores/edit-price-settings');
    return data['allowAllSellers'] as bool? ?? false;
  }

  Future<bool> updateEditPriceSettings(bool allowAllSellers) async {
    final data = await _client.put('/stores/edit-price-settings', data: {'allowAllSellers': allowAllSellers});
    return data['allowAllSellers'] as bool? ?? false;
  }

  Future<bool> getMyEditPricePermission() async {
    final data = await _client.get('/stores/my-edit-price-permission');
    return data['allowed'] as bool? ?? false;
  }

  /// Miroir exact des trois méthodes ci-dessus, pour la création de
  /// produit (§40_autorisation_ajout_produit.sql, décidé en conversation).
  Future<bool> getAddProductSettings() async {
    final data = await _client.get('/stores/add-product-settings');
    return data['allowAllSellers'] as bool? ?? false;
  }

  Future<bool> updateAddProductSettings(bool allowAllSellers) async {
    final data = await _client.put('/stores/add-product-settings', data: {'allowAllSellers': allowAllSellers});
    return data['allowAllSellers'] as bool? ?? false;
  }

  Future<bool> getMyAddProductPermission() async {
    final data = await _client.get('/stores/my-add-product-permission');
    return data['allowed'] as bool? ?? false;
  }
}

class PlanStatus {
  const PlanStatus({
    required this.planName,
    required this.isEffectivelyFreemium,
    required this.allowsSupervision,
    required this.allowsSuppliers,
    required this.allowsPurchaseOrders,
    required this.maxUsersPerStore,
    required this.planExpiresAt,
    required this.expired,
    required this.previousPlanName,
  });

  factory PlanStatus.fromJson(Map<String, dynamic> json) => PlanStatus(
        planName: json['planName'] as String? ?? '',
        isEffectivelyFreemium: json['isEffectivelyFreemium'] as bool? ?? true,
        allowsSupervision: json['allowsSupervision'] as bool? ?? false,
        allowsSuppliers: json['allowsSuppliers'] as bool? ?? false,
        allowsPurchaseOrders: json['allowsPurchaseOrders'] as bool? ?? false,
        maxUsersPerStore: json['maxUsersPerStore'] as int? ?? 1,
        planExpiresAt: json['planExpiresAt'] as String?,
        expired: json['expired'] as bool? ?? false,
        previousPlanName: json['previousPlanName'] as String?,
      );

  final String planName;
  final bool isEffectivelyFreemium;
  final bool allowsSupervision;
  final bool allowsSuppliers;
  final bool allowsPurchaseOrders;
  final int maxUsersPerStore;
  final String? planExpiresAt;
  final bool expired;
  final String? previousPlanName;
}
