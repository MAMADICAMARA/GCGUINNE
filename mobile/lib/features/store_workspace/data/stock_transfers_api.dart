import '../../../core/network/api_client.dart';

class StockTransferPreview {
  const StockTransferPreview(
      {required this.storeId, required this.storeName, this.storeTypeLabel});

  final int storeId;
  final String storeName;
  final String? storeTypeLabel;

  factory StockTransferPreview.fromJson(Map<String, dynamic> json) {
    return StockTransferPreview(
      storeId: json['storeId'] as int,
      storeName: json['storeName'] as String,
      storeTypeLabel: json['storeTypeLabel'] as String?,
    );
  }
}

class StockTransferResult {
  const StockTransferResult({
    required this.transferId,
    required this.productName,
    required this.quantity,
    required this.toStoreId,
    required this.toStoreName,
  });

  final int transferId;
  final String productName;
  final int quantity;
  final int toStoreId;
  final String toStoreName;

  factory StockTransferResult.fromJson(Map<String, dynamic> json) {
    return StockTransferResult(
      transferId: json['transferId'] as int,
      productName: json['productName'] as String,
      quantity: json['quantity'] as int,
      toStoreId: json['toStoreId'] as int,
      toStoreName: json['toStoreName'] as String,
    );
  }
}

/// Boutique destinataire déjà utilisée par le passé (§ décidé en
/// conversation, "proposer les boutiques déjà transférées") — aucune
/// donnée nouvelle, juste une relecture de l'historique déjà en base
/// (stock_transfers). Miroir de la réponse de
/// GET /stock-transfers/recent-destinations.
class RecentTransferDestination {
  const RecentTransferDestination({
    required this.storeId,
    required this.name,
    required this.city,
    required this.category,
    required this.transferCode,
  });

  final int storeId;
  final String name;
  final String? city;
  final String? category;
  final String transferCode;

  factory RecentTransferDestination.fromJson(Map<String, dynamic> json) {
    return RecentTransferDestination(
      storeId: json['storeId'] as int,
      name: json['name'] as String,
      city: json['city'] as String?,
      category: json['category'] as String?,
      transferCode: json['transferCode'] as String,
    );
  }
}

/// Miroir de stockTransfers.service.js (§45_transfert_de_stock.sql) —
/// transfert instantané de stock entre boutiques du même type, via le code
/// de transfert de la boutique destination. Réservé à l'Owner côté serveur.
class StockTransfersApi {
  const StockTransfersApi(this._client);

  final ApiClient _client;

  Future<StockTransferPreview> resolveCode(String code) async {
    final data = await _client
        .get('/stock-transfers/resolve-code', query: {'code': code});
    return StockTransferPreview.fromJson(data);
  }

  Future<List<RecentTransferDestination>> listRecentDestinations() async {
    final data = await _client.get('/stock-transfers/recent-destinations');
    final raw = data['destinations'] as List<dynamic>? ?? [];
    return raw
        .map((e) =>
            RecentTransferDestination.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<StockTransferResult> create({
    required String transferCode,
    required int productId,
    required int quantity,
  }) async {
    final data = await _client.post('/stock-transfers', data: {
      'transferCode': transferCode,
      'productId': productId,
      'quantity': quantity,
    });
    return StockTransferResult.fromJson(data);
  }
}
