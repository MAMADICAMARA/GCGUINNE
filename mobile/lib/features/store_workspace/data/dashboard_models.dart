/// Miroir de la réponse GET /dashboard/stats — voir
/// backend/src/modules/dashboard/dashboard.service.js pour le contrat exact.
///
/// Les montants (revenue, profit) restent typés `num?` plutôt que `double`
/// non nullable : PostgreSQL les renvoie parfois en chaîne (NUMERIC/BIGINT
/// sérialisés par node-postgres), et `profit`/`bySeller` sont carrément
/// absents de la réponse pour un rôle Vendeur (restriction appliquée côté
/// serveur, jamais recalculable côté client) — `null` porte cette absence
/// fidèlement plutôt que de forcer une fausse valeur par défaut.
library;

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

int _parseInt(Object? value) => (value as num).toInt();

class DashboardStats {
  const DashboardStats({
    required this.todayRevenue,
    required this.todayOrdersCount,
    required this.todayItemsSold,
    required this.todayProfit,
    required this.lowStockCount,
    required this.topProducts,
    required this.revenueTrend,
    required this.bySeller,
  });

  factory DashboardStats.fromJson(Map<String, dynamic> json) {
    final today = json['today'] as Map<String, dynamic>;
    final bySellerRaw = json['bySeller'] as List<dynamic>?;
    return DashboardStats(
      todayRevenue: _parseNum(today['revenue']),
      todayOrdersCount: _parseInt(today['ordersCount']),
      todayItemsSold: _parseInt(today['itemsSold']),
      todayProfit: _parseNum(today['profit']),
      lowStockCount: _parseInt(json['lowStockCount']),
      topProducts: (json['topProducts'] as List<dynamic>)
          .map((e) => TopProduct.fromJson(e as Map<String, dynamic>))
          .toList(),
      revenueTrend: (json['revenueTrend'] as List<dynamic>)
          .map((e) => RevenuePoint.fromJson(e as Map<String, dynamic>))
          .toList(),
      bySeller: bySellerRaw
          ?.map((e) => SellerStat.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  final num? todayRevenue;
  final int todayOrdersCount;
  final int todayItemsSold;
  /// null si le rôle courant n'a pas accès au bénéfice (jamais le Vendeur).
  final num? todayProfit;
  final int lowStockCount;
  final List<TopProduct> topProducts;
  final List<RevenuePoint> revenueTrend;
  /// null pour un Vendeur — statistiques par vendeur réservées à l'Owner.
  final List<SellerStat>? bySeller;
}

class TopProduct {
  const TopProduct({required this.id, required this.name, required this.totalSold});

  factory TopProduct.fromJson(Map<String, dynamic> json) => TopProduct(
        id: json['id'] as int,
        name: json['name'] as String,
        totalSold: _parseInt(json['totalSold']),
      );

  final int id;
  final String name;
  final int totalSold;
}

class RevenuePoint {
  const RevenuePoint({required this.day, required this.revenue});

  factory RevenuePoint.fromJson(Map<String, dynamic> json) => RevenuePoint(
        day: json['day'] as Object?,
        revenue: _parseNum(json['revenue']) ?? 0,
      );

  /// Gardé brut (String ISO le plus souvent) : seul formatDate() sait le
  /// convertir de façon fiable, voir core/utils/formatters.dart.
  final Object? day;
  final num revenue;
}

class SellerStat {
  const SellerStat({
    required this.sellerId,
    required this.sellerName,
    required this.ordersCount,
    required this.revenue,
  });

  factory SellerStat.fromJson(Map<String, dynamic> json) => SellerStat(
        sellerId: json['sellerId'] as int,
        sellerName: json['sellerName'] as String,
        ordersCount: _parseInt(json['ordersCount']),
        revenue: _parseNum(json['revenue']) ?? 0,
      );

  final int sellerId;
  final String sellerName;
  final int ordersCount;
  final num revenue;
}
