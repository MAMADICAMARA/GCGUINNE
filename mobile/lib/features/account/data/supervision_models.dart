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
    required this.planName,
    required this.planExpiresAt,
  });

  factory SupervisableStore.fromJson(Map<String, dynamic> json) =>
      SupervisableStore(
        id: json['id'] as int,
        name: json['name'] as String,
        city: json['city'] as String?,
        category: json['category'] as String?,
        supervisionAllowed: json['supervisionAllowed'] as bool,
        todayRevenue: _parseNum(json['todayRevenue']),
        todayProfit: _parseNum(json['todayProfit']),
        lowStockCount: json['lowStockCount'] == null
            ? null
            : (json['lowStockCount'] as num).toInt(),
        planName: json['planName'] as String?,
        planExpiresAt: json['planExpiresAt'] as String?,
      );

  final int id;
  final String name;
  final String? city;
  final String? category;
  final bool supervisionAllowed;
  final num? todayRevenue;
  final num? todayProfit;
  final int? lowStockCount;
  final String? planName;
  final String? planExpiresAt;
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
  const AuditLogListResult(
      {required this.logs,
      required this.total,
      required this.page,
      required this.pages});

  factory AuditLogListResult.fromJson(Map<String, dynamic> json) =>
      AuditLogListResult(
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

/// Résultat d'une boutique dans "Payer pour toutes"
/// (§52_lot_paiement_abonnement.sql, décidé en conversation) — une boutique
/// peut échouer indépendamment des autres (ex. demande déjà en attente),
/// jamais bloquant pour le reste du lot.
class BulkPaymentResult {
  const BulkPaymentResult({
    required this.storeId,
    required this.storeName,
    required this.success,
    required this.error,
  });

  factory BulkPaymentResult.fromJson(Map<String, dynamic> json) =>
      BulkPaymentResult(
        storeId: json['storeId'] as int,
        storeName: json['storeName'] as String,
        success: json['success'] as bool,
        error: json['error'] as String?,
      );

  final int storeId;
  final String storeName;
  final bool success;
  final String? error;
}

class BulkPaymentSubmitResult {
  const BulkPaymentSubmitResult({required this.batchId, required this.results});

  factory BulkPaymentSubmitResult.fromJson(Map<String, dynamic> json) =>
      BulkPaymentSubmitResult(
        batchId: json['batchId'] as String,
        results: (json['results'] as List<dynamic>? ?? [])
            .map((e) => BulkPaymentResult.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final String batchId;
  final List<BulkPaymentResult> results;
}
