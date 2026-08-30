/// Modèles pour MARCHÉ — miroir de marketplace.service.js.
library;

import '../../store_workspace/data/pos_models.dart';

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

/// Élément de la grille publique (GET /marketplace/products) — projection
/// volontairement limitée, jamais le propriétaire/l'adresse/le téléphone
/// (réservés au détail authentifié, voir MarketplaceProductDetail).
class MarketplaceProduct {
  const MarketplaceProduct({
    required this.id,
    required this.name,
    required this.imageUrl,
    required this.sellingPrice,
    required this.storeName,
  });

  factory MarketplaceProduct.fromJson(Map<String, dynamic> json) => MarketplaceProduct(
        id: json['id'] as int,
        name: json['name'] as String,
        imageUrl: json['imageUrl'] as String?,
        sellingPrice: _parseNum(json['sellingPrice']) ?? 0,
        storeName: json['storeName'] as String,
      );

  final int id;
  final String name;
  final String? imageUrl;
  final num sellingPrice;
  final String storeName;
}

class MarketplaceStoreInfo {
  const MarketplaceStoreInfo({
    required this.id,
    required this.name,
    required this.ownerName,
    required this.address,
    required this.phone,
  });

  factory MarketplaceStoreInfo.fromJson(Map<String, dynamic> json) => MarketplaceStoreInfo(
        id: json['id'] as int,
        name: json['name'] as String,
        ownerName: json['ownerName'] as String?,
        address: json['address'] as String?,
        phone: json['phone'] as String?,
      );

  final int id;
  final String name;
  final String? ownerName;
  final String? address;
  final String? phone;
}

/// Détail PUBLIC (GET /marketplace/products/:id) — seul endroit où les
/// coordonnées de la boutique sont exposées. `relatedProducts` : mêmes
/// éléments de grille que MarketplaceProduct (jamais le détail complet),
/// déjà triés par le backend (même catégorie d'abord, cf.
/// marketplace.service.js#getRelatedProducts).
class MarketplaceProductDetail {
  const MarketplaceProductDetail({
    required this.id,
    required this.name,
    required this.description,
    required this.attributes,
    required this.imageUrl,
    required this.sellingPrice,
    required this.priceTiers,
    required this.store,
    required this.relatedProducts,
  });

  factory MarketplaceProductDetail.fromJson(Map<String, dynamic> json) => MarketplaceProductDetail(
        id: json['id'] as int,
        name: json['name'] as String,
        description: json['description'] as String?,
        attributes: (json['attributes'] as Map<String, dynamic>? ?? {}).map(
          (key, value) => MapEntry(key, value.toString()),
        ),
        imageUrl: json['imageUrl'] as String?,
        sellingPrice: _parseNum(json['sellingPrice']) ?? 0,
        priceTiers: (json['priceTiers'] as List<dynamic>? ?? [])
            .map((e) => PriceTier.fromJson(e as Map<String, dynamic>))
            .toList(),
        store: MarketplaceStoreInfo.fromJson(json['store'] as Map<String, dynamic>),
        relatedProducts: (json['relatedProducts'] as List<dynamic>? ?? [])
            .map((e) => MarketplaceProduct.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final int id;
  final String name;
  final String? description;
  final Map<String, String> attributes;
  final String? imageUrl;
  final num sellingPrice;
  final List<PriceTier> priceTiers;
  final MarketplaceStoreInfo store;
  final List<MarketplaceProduct> relatedProducts;
}
