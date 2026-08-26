/// Miroir de la réponse GET /dashboard/sales-report — voir
/// dashboard.service.js#getSalesReport pour le contrat exact.
library;

num _parseNum(Object? value) {
  if (value == null) return 0;
  if (value is num) return value;
  return num.tryParse(value.toString()) ?? 0;
}

class SalesReportProduct {
  const SalesReportProduct({required this.productId, required this.productName, required this.quantitySold, required this.revenue});

  factory SalesReportProduct.fromJson(Map<String, dynamic> json) => SalesReportProduct(
        productId: json['productId'] as int,
        productName: json['productName'] as String,
        quantitySold: (json['quantitySold'] as num).toInt(),
        revenue: _parseNum(json['revenue']),
      );

  final int productId;
  final String productName;
  final int quantitySold;
  final num revenue;
}

class SalesReport {
  const SalesReport({required this.startDate, required this.endDate, required this.totalRevenue, required this.products});

  factory SalesReport.fromJson(Map<String, dynamic> json) => SalesReport(
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        totalRevenue: _parseNum(json['totalRevenue']),
        products: (json['products'] as List<dynamic>? ?? [])
            .map((e) => SalesReportProduct.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final String startDate;
  final String endDate;
  final num totalRevenue;
  final List<SalesReportProduct> products;
}
