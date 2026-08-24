/// Modèles de données pour la Caisse (POS) — miroir des contrats de
/// backend/src/modules/{products,categories,customers,cashDrawers,orders}.
library;

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

int _parseInt(Object? value) => (value as num).toInt();

class PriceTier {
  const PriceTier({required this.minQuantity, required this.unitPrice});

  factory PriceTier.fromJson(Map<String, dynamic> json) => PriceTier(
        minQuantity: _parseInt(json['minQuantity']),
        unitPrice: _parseNum(json['unitPrice']) ?? 0,
      );

  final int minQuantity;
  final num unitPrice;
}

class Product {
  const Product({
    required this.id,
    required this.categoryId,
    required this.name,
    required this.reference,
    required this.sellingPrice,
    required this.quantity,
    required this.lowStockThreshold,
    required this.imageUrl,
    required this.priceTiers,
    this.purchasePrice = 0,
    this.description,
    this.status = 'ACTIVE',
    this.attributes = const {},
  });

  // GET /products renvoie toujours le même contrat complet — la Caisse
  // n'utilise qu'un sous-ensemble de ces champs, mais rien n'empêche de
  // tous les garder ici pour que le même modèle serve aussi l'écran
  // Produits (fiche complète, formulaire d'édition).
  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] as int,
        categoryId: json['categoryId'] as int?,
        name: json['name'] as String,
        reference: json['reference'] as String?,
        sellingPrice: _parseNum(json['sellingPrice']) ?? 0,
        quantity: _parseInt(json['quantity']),
        lowStockThreshold: _parseInt(json['lowStockThreshold']),
        imageUrl: json['imageUrl'] as String?,
        priceTiers: (json['priceTiers'] as List<dynamic>? ?? [])
            .map((e) => PriceTier.fromJson(e as Map<String, dynamic>))
            .toList(),
        purchasePrice: _parseNum(json['purchasePrice']) ?? 0,
        description: json['description'] as String?,
        status: json['status'] as String? ?? 'ACTIVE',
        attributes: (json['attributes'] as Map<String, dynamic>? ?? {})
            .map((key, value) => MapEntry(key, value.toString())),
      );

  final int id;
  final int? categoryId;
  final String name;
  final String? reference;
  final num sellingPrice;
  final int quantity;
  final int lowStockThreshold;
  final String? imageUrl;
  final List<PriceTier> priceTiers;
  final num purchasePrice;
  final String? description;
  final String status;
  final Map<String, String> attributes;

  /// Miroir de getEffectiveUnitPrice() côté web (PosPage.jsx) — le serveur
  /// reste seul autorité sur le prix réellement facturé, ceci n'est qu'un
  /// aperçu client pour le panier.
  num effectiveUnitPriceFor(int quantityInCart) {
    var price = sellingPrice;
    for (final tier in priceTiers) {
      if (quantityInCart >= tier.minQuantity) price = tier.unitPrice;
    }
    return price;
  }
}

class ProductCategory {
  const ProductCategory({required this.id, required this.name});

  factory ProductCategory.fromJson(Map<String, dynamic> json) =>
      ProductCategory(id: json['id'] as int, name: json['name'] as String);

  final int id;
  final String name;
}

class CustomerSearchResult {
  const CustomerSearchResult({required this.id, required this.name, required this.phone});

  factory CustomerSearchResult.fromJson(Map<String, dynamic> json) => CustomerSearchResult(
        id: json['id'] as int,
        name: json['name'] as String,
        phone: json['phone'] as String?,
      );

  final int id;
  final String name;
  final String? phone;
}

/// Client sélectionné pour la vente en cours — jamais persisté tant que la
/// vente n'est pas confirmée (voir CustomerStepModal côté web : un nouveau
/// client n'est créé qu'à la validation finale, DANS la même transaction
/// que la commande).
class SelectedCustomer {
  const SelectedCustomer({this.id, required this.name, this.phone, this.isNewCustomer = false});

  final int? id;
  final String name;
  final String? phone;
  final bool isNewCustomer;

  bool get isIdentified => id != null || isNewCustomer;
}

class CartItem {
  CartItem({
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.availableStock,
  });

  final int productId;
  final String productName;
  int quantity;
  num unitPrice;
  final int availableStock;

  num get lineTotal => quantity * unitPrice;
}

class CashDrawer {
  const CashDrawer({
    required this.id,
    required this.openingTime,
    required this.openingBalance,
    required this.expectedBalance,
    required this.status,
    this.closingBalance,
    this.discrepancy,
    this.closingTime,
    this.note,
    this.userFullName,
  });

  factory CashDrawer.fromJson(Map<String, dynamic> json) => CashDrawer(
        id: json['id'] as int,
        openingTime: json['openingTime'] as String,
        openingBalance: _parseNum(json['openingBalance']) ?? 0,
        expectedBalance: _parseNum(json['expectedBalance']) ?? 0,
        status: json['status'] as String,
        closingBalance: _parseNum(json['closingBalance']),
        discrepancy: _parseNum(json['discrepancy']),
        closingTime: json['closingTime'] as String?,
        note: json['note'] as String?,
        userFullName: json['userFullName'] as String?,
      );

  final int id;
  final String openingTime;
  final num openingBalance;
  final num expectedBalance;
  final String status;
  final num? closingBalance;
  final num? discrepancy;
  final String? closingTime;
  final String? note;
  final String? userFullName;
}

class CashDrawerCloseResult {
  const CashDrawerCloseResult({
    required this.expectedBalance,
    required this.closingBalance,
    required this.discrepancy,
  });

  factory CashDrawerCloseResult.fromJson(Map<String, dynamic> json) => CashDrawerCloseResult(
        expectedBalance: _parseNum(json['expectedBalance']) ?? 0,
        closingBalance: _parseNum(json['closingBalance']) ?? 0,
        discrepancy: _parseNum(json['discrepancy']) ?? 0,
      );

  final num expectedBalance;
  final num closingBalance;
  final num discrepancy;
}

class ReceiptStoreInfo {
  const ReceiptStoreInfo({required this.name, this.address, this.phone});

  factory ReceiptStoreInfo.fromJson(Map<String, dynamic> json) => ReceiptStoreInfo(
        name: json['name'] as String? ?? '',
        address: json['address'] as String?,
        phone: json['phone'] as String?,
      );

  final String name;
  final String? address;
  final String? phone;
}

class OrderResult {
  const OrderResult({
    required this.orderId,
    required this.orderNumber,
    required this.totalAmount,
    required this.receiptText,
    required this.store,
    required this.sellerName,
  });

  factory OrderResult.fromJson(Map<String, dynamic> json) {
    final context = json['receiptContext'] as Map<String, dynamic>? ?? {};
    return OrderResult(
      orderId: json['orderId'] as int,
      orderNumber: json['orderNumber'] as String? ?? '',
      totalAmount: _parseNum(json['totalAmount']) ?? 0,
      receiptText: json['receipt'] as String? ?? '',
      store: ReceiptStoreInfo.fromJson(context['store'] as Map<String, dynamic>? ?? {}),
      sellerName: context['sellerName'] as String?,
    );
  }

  final int orderId;
  final String orderNumber;
  final num totalAmount;
  final String receiptText;
  final ReceiptStoreInfo store;
  final String? sellerName;
}
