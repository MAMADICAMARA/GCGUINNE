/// Modèles Achats — miroir de purchases.service.js (§28_commandes_achat_premium.sql).
/// `SupplierContact` est un carnet d'adresses texte libre propre à la
/// boutique (fournisseur hors plateforme) — à ne jamais confondre avec
/// `StoreLink` (supplier_models.dart), une autre boutique de la plateforme.
library;

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

class SupplierContact {
  const SupplierContact({required this.id, required this.name, required this.phone, required this.email, required this.address});

  factory SupplierContact.fromJson(Map<String, dynamic> json) => SupplierContact(
        id: json['id'] as int,
        name: json['name'] as String,
        phone: json['phone'] as String?,
        email: json['email'] as String?,
        address: json['address'] as String?,
      );

  final int id;
  final String name;
  final String? phone;
  final String? email;
  final String? address;

  String get subtitle {
    final parts = [phone, email].where((s) => s != null && s.isNotEmpty).toList();
    return parts.isEmpty ? '—' : parts.join(' · ');
  }
}

const kPurchaseOrderStatusLabels = {'PENDING': 'En attente', 'RECEIVED': 'Reçue', 'CANCELLED': 'Annulée'};

class PurchaseOrderSummary {
  const PurchaseOrderSummary({
    required this.id,
    required this.reference,
    required this.totalAmount,
    required this.status,
    required this.createdAt,
    required this.receivedAt,
    required this.supplierId,
    required this.supplierName,
    required this.supplierType,
    required this.createdByName,
  });

  factory PurchaseOrderSummary.fromJson(Map<String, dynamic> json) => PurchaseOrderSummary(
        id: json['id'] as int,
        reference: json['reference'] as String?,
        totalAmount: _parseNum(json['totalAmount']) ?? 0,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String?,
        receivedAt: json['receivedAt'] as String?,
        supplierId: json['supplierId'] as int?,
        supplierName: json['supplierName'] as String? ?? '—',
        supplierType: json['supplierType'] as String? ?? 'EXTERNAL',
        createdByName: json['createdByName'] as String?,
      );

  final int id;
  final String? reference;
  final num totalAmount;
  final String status;
  final String? createdAt;
  final String? receivedAt;
  final int? supplierId;
  final String supplierName;
  /// 'EXTERNAL' (fournisseur contact) ou 'PLATFORM' (boutique de la plateforme).
  final String supplierType;
  final String? createdByName;
}

class PurchaseOrderInfo {
  const PurchaseOrderInfo({
    required this.id,
    required this.reference,
    required this.totalAmount,
    required this.status,
    required this.createdAt,
    required this.receivedAt,
    required this.supplierId,
    required this.supplierName,
    required this.supplierPhone,
    required this.supplierType,
    required this.createdByName,
    required this.receivedByName,
  });

  factory PurchaseOrderInfo.fromJson(Map<String, dynamic> json) => PurchaseOrderInfo(
        id: json['id'] as int,
        reference: json['reference'] as String?,
        totalAmount: _parseNum(json['totalAmount']) ?? 0,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String?,
        receivedAt: json['receivedAt'] as String?,
        supplierId: json['supplierId'] as int?,
        supplierName: json['supplierName'] as String? ?? '—',
        supplierPhone: json['supplierPhone'] as String?,
        supplierType: json['supplierType'] as String? ?? 'EXTERNAL',
        createdByName: json['createdByName'] as String?,
        receivedByName: json['receivedByName'] as String?,
      );

  final int id;
  final String? reference;
  final num totalAmount;
  final String status;
  final String? createdAt;
  final String? receivedAt;
  final int? supplierId;
  final String supplierName;
  final String? supplierPhone;
  final String supplierType;
  final String? createdByName;
  final String? receivedByName;
}

class PurchaseOrderItem {
  const PurchaseOrderItem({required this.id, required this.productId, required this.quantity, required this.purchasePrice, required this.productName, required this.reference});

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> json) => PurchaseOrderItem(
        id: json['id'] as int,
        productId: json['productId'] as int,
        quantity: json['quantity'] as int,
        purchasePrice: _parseNum(json['purchasePrice']) ?? 0,
        productName: json['productName'] as String,
        reference: json['reference'] as String?,
      );

  final int id;
  final int productId;
  final int quantity;
  final num purchasePrice;
  final String productName;
  final String? reference;
}

class PurchaseOrderDetail {
  const PurchaseOrderDetail({required this.order, required this.items});

  factory PurchaseOrderDetail.fromJson(Map<String, dynamic> json) => PurchaseOrderDetail(
        order: PurchaseOrderInfo.fromJson(json['order'] as Map<String, dynamic>),
        items: (json['items'] as List<dynamic>? ?? []).map((e) => PurchaseOrderItem.fromJson(e as Map<String, dynamic>)).toList(),
      );

  final PurchaseOrderInfo order;
  final List<PurchaseOrderItem> items;
}

/// Ligne panier lors de la construction d'une commande manuelle — produits
/// DE CETTE BOUTIQUE (contrairement à SupplierCartItem, qui porte sur le
/// catalogue d'un fournisseur de la plateforme).
class PurchaseOrderDraftItem {
  PurchaseOrderDraftItem({this.productId, this.productName, required this.quantity, required this.purchasePrice});

  int? productId;
  String? productName;
  int quantity;
  num purchasePrice;
}
