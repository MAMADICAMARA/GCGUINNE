/// Modèles pour l'espace Superviser — miroir de supervision.service.js.
library;

num? _parseNum(Object? value) {
  if (value == null) return null;
  if (value is num) return value;
  return num.tryParse(value.toString());
}

/// Élément de GET /supervision/stores — boutique de tiers supervisée, avec
/// un aperçu chiffré du jour (null si l'abonnement de CETTE boutique
/// n'autorise plus la supervision, voir supervisionAllowed).
class SupervisableStore {
  const SupervisableStore({
    required this.id,
    required this.name,
    required this.city,
    required this.category,
    required this.supervisionAllowed,
    required this.todayRevenue,
    required this.todayProfit,
    required this.lowStockCount,
  });

  factory SupervisableStore.fromJson(Map<String, dynamic> json) => SupervisableStore(
        id: json['id'] as int,
        name: json['name'] as String,
        city: json['city'] as String?,
        category: json['category'] as String?,
        supervisionAllowed: json['supervisionAllowed'] as bool,
        todayRevenue: _parseNum(json['todayRevenue']),
        todayProfit: _parseNum(json['todayProfit']),
        lowStockCount: json['lowStockCount'] == null ? null : (json['lowStockCount'] as num).toInt(),
      );

  final int id;
  final String name;
  final String? city;
  final String? category;
  final bool supervisionAllowed;
  final num? todayRevenue;
  final num? todayProfit;
  final int? lowStockCount;
}

/// Une entrée du journal d'activité (system_logs) — voir
/// backend/src/utils/auditLog.js#listStoreAuditLog.
class AuditLogEntry {
  const AuditLogEntry({
    required this.id,
    required this.action,
    required this.details,
    required this.ipAddress,
    required this.createdAt,
    required this.userFullName,
    required this.userEmail,
  });

  factory AuditLogEntry.fromJson(Map<String, dynamic> json) => AuditLogEntry(
        id: json['id'] as int,
        action: json['action'] as String,
        details: json['details'] as Map<String, dynamic>?,
        ipAddress: json['ipAddress'] as String?,
        createdAt: json['createdAt'] as String?,
        userFullName: json['userFullName'] as String?,
        userEmail: json['userEmail'] as String?,
      );

  final int id;
  final String action;
  final Map<String, dynamic>? details;
  final String? ipAddress;
  final String? createdAt;
  final String? userFullName;
  final String? userEmail;
}

class AuditLogListResult {
  const AuditLogListResult({required this.logs, required this.total, required this.page, required this.pages});

  factory AuditLogListResult.fromJson(Map<String, dynamic> json) => AuditLogListResult(
        logs: (json['logs'] as List<dynamic>? ?? [])
            .map((e) => AuditLogEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        total: (json['total'] as num).toInt(),
        page: (json['page'] as num).toInt(),
        pages: (json['pages'] as num).toInt(),
      );

  final List<AuditLogEntry> logs;
  final int total;
  final int page;
  final int pages;
}
