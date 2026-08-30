/// Miroir d'un élément du tableau `stores` renvoyé par /auth/login,
/// /auth/register, /stores/mine et /stores (création).
///
/// Porte à la fois les infos de la boutique et le rôle de l'utilisateur
/// courant dans cette boutique (cf. table user_store côté backend).
class StoreRef {
  const StoreRef({
    required this.id,
    required this.name,
    required this.roleCode,
    this.city,
    this.region,
    this.category,
    this.status,
    this.isDefaultStore = false,
    this.defaultTaxPercent = 0,
  });

  factory StoreRef.fromJson(Map<String, dynamic> json) {
    return StoreRef(
      id: json['id'] as int,
      name: json['name'] as String,
      roleCode: json['roleCode'] as String,
      city: json['city'] as String?,
      region: json['region'] as String?,
      category: json['category'] as String?,
      status: json['status'] as String?,
      isDefaultStore: json['isDefaultStore'] as bool? ?? false,
      defaultTaxPercent: (json['defaultTaxPercent'] as num?) ?? 0,
    );
  }

  final int id;
  final String name;
  final String roleCode;
  final String? city;
  final String? region;
  final String? category;
  final String? status;
  final bool isDefaultStore;
  final num defaultTaxPercent;

  StoreRef copyWith({num? defaultTaxPercent}) => StoreRef(
        id: id,
        name: name,
        roleCode: roleCode,
        city: city,
        region: region,
        category: category,
        status: status,
        isDefaultStore: isDefaultStore,
        defaultTaxPercent: defaultTaxPercent ?? this.defaultTaxPercent,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'roleCode': roleCode,
        'city': city,
        'region': region,
        'category': category,
        'status': status,
        'isDefaultStore': isDefaultStore,
        'defaultTaxPercent': defaultTaxPercent,
      };
}
