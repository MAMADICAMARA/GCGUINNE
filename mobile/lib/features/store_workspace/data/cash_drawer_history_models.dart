/// Modèles Historique des caisses — miroir de cashDrawers.service.js
/// (§30_fond_de_caisse.sql). Réutilise [CashDrawer] (pos_models.dart), déjà
/// utilisé par la bannière d'ouverture/fermeture de la Caisse.
library;

import 'pos_models.dart';

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

class CashDrawerListResult {
  const CashDrawerListResult({required this.drawers, required this.total, required this.page, required this.pages});

  factory CashDrawerListResult.fromJson(Map<String, dynamic> json) => CashDrawerListResult(
        drawers: (json['drawers'] as List<dynamic>? ?? []).map((e) => CashDrawer.fromJson(e as Map<String, dynamic>)).toList(),
        total: json['total'] as int? ?? 0,
        page: json['page'] as int? ?? 1,
        pages: json['pages'] as int? ?? 1,
      );

  final List<CashDrawer> drawers;
  final int total;
  final int page;
  final int pages;
}

/// Vente en espèces rattachée à une session — juste de quoi expliquer un
/// écart, jamais un détail complet (déjà disponible via Historique des
/// ventes si besoin).
class CashDrawerOrderSummary {
  const CashDrawerOrderSummary({required this.id, required this.orderNumber, required this.totalAmount, required this.amountPaid, required this.status, required this.createdAt});

  factory CashDrawerOrderSummary.fromJson(Map<String, dynamic> json) => CashDrawerOrderSummary(
        id: json['id'] as int,
        orderNumber: json['orderNumber'] as String,
        totalAmount: _parseNum(json['totalAmount']) ?? 0,
        amountPaid: _parseNum(json['amountPaid']) ?? 0,
        status: json['status'] as String,
        createdAt: json['createdAt'] as String?,
      );

  final int id;
  final String orderNumber;
  final num totalAmount;
  final num amountPaid;
  final String status;
  final String? createdAt;
}

class CashDrawerDetail {
  const CashDrawerDetail({required this.drawer, required this.orders});

  factory CashDrawerDetail.fromJson(Map<String, dynamic> json) => CashDrawerDetail(
        drawer: CashDrawer.fromJson(json['drawer'] as Map<String, dynamic>),
        orders: (json['orders'] as List<dynamic>? ?? []).map((e) => CashDrawerOrderSummary.fromJson(e as Map<String, dynamic>)).toList(),
      );

  final CashDrawer drawer;
  final List<CashDrawerOrderSummary> orders;
}
