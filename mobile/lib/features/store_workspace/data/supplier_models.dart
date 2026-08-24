/// Modèles Fournisseurs — miroir de suppliers.service.js / purchases.service.js
/// (§18_fournisseurs_inter_boutiques.sql, §29_commande_depuis_fournisseur_plateforme.sql).
library;

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

int _parseInt(Object? value) => (value as num).toInt();

/// Sert à la fois pour "mes fournisseurs" et "mes clients" — même forme
/// des deux côtés du lien.
class StoreLink {
  const StoreLink({required this.linkId, required this.storeId, required this.name, required this.city, required this.category, required this.linkedAt});

  factory StoreLink.fromJson(Map<String, dynamic> json) => StoreLink(
        linkId: json['linkId'] as int,
        storeId: json['storeId'] as int,
        name: json['name'] as String,
        city: json['city'] as String?,
        category: json['category'] as String?,
        linkedAt: json['linkedAt'] as String?,
      );

  final int linkId;
  final int storeId;
  final String name;
  final String? city;
  final String? category;
  final String? linkedAt;

  String get subtitle {
    final parts = [category, city].where((s) => s != null && s.isNotEmpty).toList();
    return parts.isEmpty ? '—' : parts.join(' · ');
  }
}

/// Produit du catalogue d'un fournisseur, pour construire une commande —
/// prix de vente affiché à titre de référence, jamais le stock (voir
/// suppliers.service.js#getSupplierCatalogForOrder).
class SupplierProduct {
  const SupplierProduct({required this.id, required this.name, required this.reference, required this.imageUrl, required this.categoryName, required this.sellingPrice});

  factory SupplierProduct.fromJson(Map<String, dynamic> json) => SupplierProduct(
        id: json['id'] as int,
        name: json['name'] as String,
        reference: json['reference'] as String?,
        imageUrl: json['imageUrl'] as String?,
        categoryName: json['categoryName'] as String?,
        sellingPrice: _parseNum(json['sellingPrice']) ?? 0,
      );

  final int id;
  final String name;
  final String? reference;
  final String? imageUrl;
  final String? categoryName;
  final num sellingPrice;
}

class SupplierOrderCatalog {
  const SupplierOrderCatalog({required this.supplierName, required this.products});

  factory SupplierOrderCatalog.fromJson(Map<String, dynamic> json) => SupplierOrderCatalog(
        supplierName: json['supplierName'] as String? ?? '',
        products: (json['products'] as List<dynamic>? ?? []).map((e) => SupplierProduct.fromJson(e as Map<String, dynamic>)).toList(),
      );

  final String supplierName;
  final List<SupplierProduct> products;
}

/// Ligne panier lors de la construction d'une commande fournisseur — le
/// prix, contrairement à la Caisse, reste modifiable (c'est un prix
/// convenu avec le fournisseur, pas un prix de vente fixe).
class SupplierCartItem {
  SupplierCartItem({required this.supplierProductId, required this.productName, required this.quantity, required this.unitPrice});

  final int supplierProductId;
  final String productName;
  int quantity;
  num unitPrice;

  num get lineTotal => quantity * unitPrice;
}

const kReceivedOrderStatusLabels = {'PENDING': 'En attente', 'RECEIVED': 'Reçue', 'CANCELLED': 'Annulée'};

class ReceivedOrder {
  const ReceivedOrder({
    required this.id,
    required this.reference,
    required this.totalAmount,
    required this.status,
    required this.createdAt,
    required this.receivedAt,
    required this.buyerStoreName,
  });

  factory ReceivedOrder.fromJson(Map<String, dynamic> json) => ReceivedOrder(
        id: json['id'] as int,
        reference: json['reference'] as String?,
        totalAmount: _parseNum(json['totalAmount']) ?? 0,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String?,
        receivedAt: json['receivedAt'] as String?,
        buyerStoreName: json['buyerStoreName'] as String?,
      );

  final int id;
  final String? reference;
  final num totalAmount;
  final String status;
  final String? createdAt;
  final String? receivedAt;
  final String? buyerStoreName;
}

class ReceivedOrderItem {
  const ReceivedOrderItem({required this.id, required this.productName, required this.quantity});

  factory ReceivedOrderItem.fromJson(Map<String, dynamic> json) => ReceivedOrderItem(
        id: json['id'] as int,
        productName: json['productName'] as String,
        quantity: _parseInt(json['quantity']),
      );

  final int id;
  final String productName;
  final int quantity;
}

class ReceivedOrderDetail {
  const ReceivedOrderDetail({required this.order, required this.items});

  factory ReceivedOrderDetail.fromJson(Map<String, dynamic> json) => ReceivedOrderDetail(
        order: ReceivedOrder.fromJson(json['order'] as Map<String, dynamic>),
        items: (json['items'] as List<dynamic>? ?? []).map((e) => ReceivedOrderItem.fromJson(e as Map<String, dynamic>)).toList(),
      );

  final ReceivedOrder order;
  final List<ReceivedOrderItem> items;
}
