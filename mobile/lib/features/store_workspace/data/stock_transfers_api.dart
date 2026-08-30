import '../../../core/network/api_client.dart';

class StockTransferPreview {
  const StockTransferPreview({required this.storeId, required this.storeName, this.storeTypeLabel});

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

/// Miroir de stockTransfers.service.js (§45_transfert_de_stock.sql) —
/// transfert instantané de stock entre boutiques du même type, via le code
/// de transfert de la boutique destination. Réservé à l'Owner côté serveur.
class StockTransfersApi {
  const StockTransfersApi(this._client);

  final ApiClient _client;

  Future<StockTransferPreview> resolveCode(String code) async {
    final data = await _client.get('/stock-transfers/resolve-code', query: {'code': code});
    return StockTransferPreview.fromJson(data);
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
