import 'pos_models.dart';

/// Réponse paginée de GET /products — voir products.service.js#listProducts.
class ProductListResult {
  const ProductListResult({
    required this.products,
    required this.total,
    required this.page,
    required this.pages,
    this.planName,
    this.maxProductsPerStore,
  });

  factory ProductListResult.fromJson(Map<String, dynamic> json) => ProductListResult(
        products: (json['products'] as List<dynamic>? ?? [])
            .map((e) => Product.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: (json['total'] as num).toInt(),
        page: (json['page'] as num).toInt(),
        pages: (json['pages'] as num).toInt(),
        planName: json['planName'] as String?,
        maxProductsPerStore: (json['maxProductsPerStore'] as num?)?.toInt(),
      );

  final List<Product> products;
  final int total;
  final int page;
  final int pages;
  // Présents sur la même réponse que "products" (§ décidé en conversation) —
  // évite un second appel juste pour savoir quel plan explique le verrou.
  final String? planName;
  final int? maxProductsPerStore;
}

/// Miroir de MOVEMENT_LABELS côté web (ProductDetail.jsx) — un mouvement de
/// stock est immuable (jamais modifié ni supprimé une fois créé).
const Map<String, String> kStockMovementLabels = {
  'INITIAL_STOCK': 'Stock initial',
  'PURCHASE_IN': 'Achat reçu',
  'SALE_OUT': 'Vente',
  'RETURN_IN': 'Retour',
  'ADJUSTMENT': 'Ajustement',
  'TRANSFER_OUT': 'Transfert sortant',
  'TRANSFER_IN': 'Transfert entrant',
};

class StockMovement {
  const StockMovement({
    required this.id,
    required this.type,
    required this.quantity,
    required this.createdAt,
    this.note,
    this.productId,
    this.productName,
  });

  factory StockMovement.fromJson(Map<String, dynamic> json) => StockMovement(
        id: json['id'] as int,
        type: json['type'] as String,
        quantity: (json['quantity'] as num).toInt(),
        createdAt: json['createdAt'] as String?,
        note: json['note'] as String?,
        productId: json['productId'] as int?,
        productName: json['productName'] as String?,
      );

  final int id;
  final String type;
  final int quantity;
  final String? createdAt;
  final String? note;
  // Présents seulement sur le mouvement "boutique entière" (Supervision) —
  // absents de l'historique par-produit (déjà scopé à un seul produit),
  // voir products.service.js#getStockHistory vs #getStoreStockMovements.
  final int? productId;
  final String? productName;

  String get label => kStockMovementLabels[type] ?? type;
}
